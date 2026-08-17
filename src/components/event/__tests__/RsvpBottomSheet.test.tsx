import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockConfirm = { mutateAsync: vi.fn() };
const mockDecline = { mutateAsync: vi.fn() };
const mockUpdateName = { mutateAsync: vi.fn() };
const mockUpdateMemberName = { mutateAsync: vi.fn() };
const mockUpdatePreferences = { mutateAsync: vi.fn() };
const mockRefresh = vi.fn();
const mockRefetchFormState = vi.fn();

const mockFormState = {
  data: null as unknown,
  isLoading: false,
  error: null as Error | null,
  refetch: mockRefetchFormState,
};

vi.mock('~/hooks', () => ({
  useRsvpMutation: () => ({
    confirm: mockConfirm,
    decline: mockDecline,
  }),
  useRsvpFormState: () => mockFormState,
  useHouseholdNameMutation: () => ({
    updateName: mockUpdateName,
  }),
  useHouseholdMemberNameMutation: () => ({
    updateName: mockUpdateMemberName,
  }),
  useUserProfileMutation: () => ({
    updatePreferences: mockUpdatePreferences,
  }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('react-dom', async () => {
  const actual = await vi.importActual<typeof import('react-dom')>('react-dom');
  return { ...actual, createPortal: (node: React.ReactNode) => node };
});

const { RsvpBottomSheet } = await import('../RsvpBottomSheet');

beforeEach(() => {
  mockConfirm.mutateAsync.mockReset();
  mockDecline.mutateAsync.mockReset();
  mockUpdateName.mutateAsync.mockReset();
  mockUpdateMemberName.mutateAsync.mockReset();
  mockUpdatePreferences.mutateAsync.mockReset();
  mockConfirm.mutateAsync.mockResolvedValue({ id: 'rsvp-1' });
  mockDecline.mutateAsync.mockResolvedValue({});
  mockUpdateName.mutateAsync.mockResolvedValue({});
  mockUpdateMemberName.mutateAsync.mockResolvedValue({});
  mockUpdatePreferences.mutateAsync.mockResolvedValue({});
  mockRefresh.mockReset();
  mockRefetchFormState.mockReset();
  mockFormState.data = null;
  mockFormState.isLoading = false;
  mockFormState.error = null;
});

const baseProps = {
  isOpen: true,
  onClose: vi.fn(),
  eventId: 'evt-1',
  maxCapacity: null,
  currentAttending: 0,
};

const members = [
  { id: 'mem-1', name: 'Alice', age: 35, notes: null },
  { id: 'mem-2', name: 'Ben', age: 8, notes: null },
];

function setRosterReady() {
  mockFormState.data = {
    householdId: 'h-1',
    householdName: 'The Garcia Family',
    members,
    rsvp: null,
  };
}

describe('RsvpBottomSheet per-member attendance', () => {
  it('shows a loading state while the roster fetch is pending', () => {
    mockFormState.isLoading = true;
    mockFormState.data = null;
    render(<RsvpBottomSheet {...baseProps} />);
    expect(screen.getByText(/loading your household/i)).toBeInTheDocument();
  });

  it('shows a retryable error state when the roster fetch fails', () => {
    mockFormState.error = new Error('network down');
    render(<RsvpBottomSheet {...baseProps} />);
    expect(screen.getByText(/we couldn.?t load your household/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(mockRefetchFormState).toHaveBeenCalledTimes(1);
  });

  it('renders one attendance row per household member', () => {
    setRosterReady();
    render(<RsvpBottomSheet {...baseProps} />);
    expect(screen.getByLabelText('Attendance for Alice')).toBeInTheDocument();
    expect(screen.getByLabelText('Attendance for Ben')).toBeInTheDocument();
  });

  it('defaults every member to Going', () => {
    setRosterReady();
    render(<RsvpBottomSheet {...baseProps} />);
    const aliceSelect = screen.getByLabelText('Attendance for Alice') as HTMLSelectElement;
    const benSelect = screen.getByLabelText('Attendance for Ben') as HTMLSelectElement;
    expect(aliceSelect.value).toBe('YES');
    expect(benSelect.value).toBe('YES');
  });

  it('lets the user flip a member to Not going', () => {
    setRosterReady();
    render(<RsvpBottomSheet {...baseProps} />);
    const aliceSelect = screen.getByLabelText('Attendance for Alice') as HTMLSelectElement;
    fireEvent.change(aliceSelect, { target: { value: 'NO' } });
    expect(aliceSelect.value).toBe('NO');
  });

  it('disables submit when every member is Not going', () => {
    setRosterReady();
    render(<RsvpBottomSheet {...baseProps} />);
    fireEvent.change(screen.getByLabelText('Attendance for Alice'), { target: { value: 'NO' } });
    fireEvent.change(screen.getByLabelText('Attendance for Ben'), { target: { value: 'NO' } });
    const submit = screen.getByRole('button', { name: /confirm 0 guests/i });
    expect(submit).toBeDisabled();
  });

  it('sends memberAttendances on confirm', async () => {
    setRosterReady();
    render(<RsvpBottomSheet {...baseProps} />);
    await waitFor(() => {
      expect(screen.getByLabelText('Attendance for Alice')).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText('Attendance for Alice'), { target: { value: 'YES' } });
    fireEvent.change(screen.getByLabelText('Attendance for Ben'), { target: { value: 'NO' } });
    fireEvent.click(screen.getByRole('button', { name: /confirm 1 guest/i }));
    await waitFor(() => {
      expect(mockConfirm.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: 'evt-1',
          memberAttendances: expect.arrayContaining([
            expect.objectContaining({ householdMemberId: 'mem-1', attending: 'YES' }),
            expect.objectContaining({ householdMemberId: 'mem-2', attending: 'NO' }),
          ]),
        }),
      );
      const lastCall = mockConfirm.mutateAsync.mock.calls.at(-1)?.[0];
      expect(lastCall?.memberAttendances).toHaveLength(2);
    });
  });

  it('adds a household member and persists them', async () => {
    setRosterReady();
    render(<RsvpBottomSheet {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: /add household member/i }));
    const memberNameInput = screen.getByLabelText(/member name/i);
    fireEvent.change(memberNameInput, { target: { value: 'Grandma' } });
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));
    expect(screen.getByLabelText('Attendance for Grandma')).toBeInTheDocument();
  });

  it('preserves a one-time guest through a confirm cycle', async () => {
    setRosterReady();
    render(<RsvpBottomSheet {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: /add a one-time guest/i }));
    // FPP-36: the per-slot attendee inputs also have `Name` as a
    // placeholder, so grab the guest-add input by its aria-label.
    const guestNameInput = screen.getByLabelText(/guest name/i);
    fireEvent.change(guestNameInput, { target: { value: 'Cousin' } });
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));
    expect(screen.getByLabelText('Attendance for Cousin')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /confirm 3 guests/i }));
    await waitFor(() => {
      expect(mockConfirm.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          memberAttendances: expect.arrayContaining([
            expect.objectContaining({
              householdMemberId: null,
              memberName: 'Cousin',
              attending: 'YES',
            }),
          ]),
        }),
      );
      const lastCall = mockConfirm.mutateAsync.mock.calls.at(-1)?.[0];
      expect(lastCall?.memberAttendances).toHaveLength(3);
    });
  });

  it('lets the head of household (ad-hoc row) set their age', async () => {
    // FPP-113 / head-of-household: when the caller has no household
    // members yet, the sheet seeds a row for the user's own name with
    // `householdMemberId: null`. That row must offer the same "Set
    // age" affordance as roster members so the fee can be computed.
    mockFormState.data = {
      householdId: null,
      householdName: null,
      members: [],
      rsvp: null,
      userName: 'Maria Garcia',
      hasHousehold: false,
    };
    render(<RsvpBottomSheet {...baseProps} />);
    const nameInput = screen.getByLabelText(/name for maria garcia/i) as HTMLInputElement;
    expect(nameInput).toBeInTheDocument();
    const setAgeButton = screen.getByRole('button', { name: /set age/i });
    fireEvent.click(setAgeButton);
    const ageInput = screen.getByLabelText(/edit age/i) as HTMLInputElement;
    fireEvent.change(ageInput, { target: { value: '40' } });
    fireEvent.keyDown(ageInput, { key: 'Enter' });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /edit age/i })).toHaveTextContent('40 yrs');
    });
  });

  it("calls the decline mutation when the user clicks Can't make it", async () => {
    setRosterReady();
    render(<RsvpBottomSheet {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: /can't make it/i }));
    await waitFor(() => {
      expect(mockDecline.mutateAsync).toHaveBeenCalledWith({ eventId: 'evt-1' });
    });
  });

  describe('live registration fee (FPP-16)', () => {
    it('hides the fee line when no fee config is provided', () => {
      setRosterReady();
      render(<RsvpBottomSheet {...baseProps} />);
      expect(screen.queryByText(/registration fee:/i)).not.toBeInTheDocument();
    });

    it('hides the fee line when amountCents is 0 (free event)', () => {
      setRosterReady();
      render(
        <RsvpBottomSheet
          {...baseProps}
          registrationFeeConfig={{ amountCents: 0, minAge: 0, currency: 'usd' }}
        />,
      );
      expect(screen.queryByText(/registration fee:/i)).not.toBeInTheDocument();
    });

    it('renders the live fee total based on YES attendees', () => {
      setRosterReady();
      render(
        <RsvpBottomSheet
          {...baseProps}
          registrationFeeConfig={{ amountCents: 1000, minAge: 0, currency: 'usd' }}
        />,
      );
      // Both Alice (35) and Ben (8) are YES, minAge 0 → 2 × $10 = $20
      expect(screen.getByText(/registration fee: \$20\.00/i)).toBeInTheDocument();
      expect(screen.getByText(/2 attendees at \$10\.00/i)).toBeInTheDocument();
    });

    it('skips attendees below the minAge threshold', () => {
      setRosterReady();
      render(
        <RsvpBottomSheet
          {...baseProps}
          registrationFeeConfig={{ amountCents: 1000, minAge: 13, currency: 'usd' }}
        />,
      );
      // Only Alice (35) qualifies; Ben (8) is free
      expect(screen.getByText(/registration fee: \$10\.00/i)).toBeInTheDocument();
      expect(screen.getByText(/1 attendee at \$10\.00/i)).toBeInTheDocument();
    });

    it('recomputes the total when a member is flipped to NO', () => {
      setRosterReady();
      render(
        <RsvpBottomSheet
          {...baseProps}
          registrationFeeConfig={{ amountCents: 1000, minAge: 0, currency: 'usd' }}
        />,
      );
      expect(screen.getByText(/registration fee: \$20\.00/i)).toBeInTheDocument();
      fireEvent.change(screen.getByLabelText('Attendance for Ben'), {
        target: { value: 'NO' },
      });
      expect(screen.getByText(/registration fee: \$10\.00/i)).toBeInTheDocument();
      expect(screen.getByText(/1 attendee at \$10\.00/i)).toBeInTheDocument();
    });

    it('renders $0 when every YES attendee is below minAge', () => {
      setRosterReady();
      render(
        <RsvpBottomSheet
          {...baseProps}
          registrationFeeConfig={{ amountCents: 1000, minAge: 99, currency: 'usd' }}
        />,
      );
      expect(screen.queryByText(/registration fee: \$/i)).not.toBeInTheDocument();
    });

    it('uses the supplied currency code', () => {
      setRosterReady();
      render(
        <RsvpBottomSheet
          {...baseProps}
          registrationFeeConfig={{ amountCents: 1000, minAge: 0, currency: 'eur' }}
        />,
      );
      expect(screen.getByText(/registration fee: €20\.00/i)).toBeInTheDocument();
    });
  });

  describe('household name editing (FPP-80)', () => {
    it('renders a household-name input seeded from the snapshot, above the per-member list', () => {
      setRosterReady();
      const { container } = render(<RsvpBottomSheet {...baseProps} />);
      const field = screen.getByTestId('rsvp-household-name-field');
      const input = screen.getByLabelText(/household name/i) as HTMLInputElement;
      expect(input.value).toBe('The Garcia Family');
      expect(input).toHaveAttribute('maxLength', '80');
      expect(input).toHaveAttribute('id', 'rsvp-household-name');

      // The field must render before the per-member list so guests
      // see the rename path first. jsdom reports every getBoundingClientRect
      // as zeros, so we assert document order: the field precedes
      // (i.e. is "before" in tree order) the first attendance row.
      const aliceSelect = screen.getByLabelText('Attendance for Alice');
      expect(
        field.compareDocumentPosition(aliceSelect) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();

      expect(container).toMatchSnapshot();
    });

    it('renders the household-name input when the caller has no household yet', () => {
      mockFormState.data = {
        householdId: null,
        householdName: null,
        userName: 'Maria Garcia',
        members: [],
        rsvp: null,
      };
      render(<RsvpBottomSheet {...baseProps} />);
      expect(screen.getByTestId('rsvp-household-name-field')).toBeInTheDocument();
      expect(screen.getByLabelText(/household name/i)).toBeInTheDocument();
    });

    it('rejects an empty name with the same Zod message as the profile path', async () => {
      setRosterReady();
      const { container } = render(<RsvpBottomSheet {...baseProps} />);
      const input = screen.getByLabelText(/household name/i) as HTMLInputElement;
      fireEvent.change(input, { target: { value: '   ' } });
      fireEvent.click(screen.getByRole('button', { name: /confirm 2 guests/i }));

      await waitFor(() => {
        expect(screen.getByText('Household name is required')).toBeInTheDocument();
      });
      // The submit was aborted before the rename or confirm fired.
      expect(mockUpdateName.mutateAsync).not.toHaveBeenCalled();
      expect(mockConfirm.mutateAsync).not.toHaveBeenCalled();

      expect(container).toMatchSnapshot('empty-name-rejection');
    });

    it('renames the household when the name changes before submitting the RSVP', async () => {
      setRosterReady();
      render(<RsvpBottomSheet {...baseProps} />);
      const input = screen.getByLabelText(/household name/i) as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'The Garcia-Martinez Family' } });
      fireEvent.click(screen.getByRole('button', { name: /confirm 2 guests/i }));

      await waitFor(() => {
        expect(mockUpdateName.mutateAsync).toHaveBeenCalledWith({
          id: 'h-1',
          name: 'The Garcia-Martinez Family',
        });
      });
      // Rename runs before the confirm, and confirm still fires.
      await waitFor(() => {
        expect(mockConfirm.mutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({ eventId: 'evt-1' }),
        );
      });
      // Pin the rename-before-confirm ordering: a refactor that
      // swaps them would break the spec, so the assertion checks
      // the call order Vitest assigns to each invocation.
      const renameOrder = mockUpdateName.mutateAsync.mock.invocationCallOrder[0]!;
      const confirmOrder = mockConfirm.mutateAsync.mock.invocationCallOrder[0]!;
      expect(renameOrder).toBeLessThan(confirmOrder);
    });

    it('skips the rename when the name is unchanged', async () => {
      setRosterReady();
      render(<RsvpBottomSheet {...baseProps} />);
      // No edit; the user clicks confirm with the same name.
      fireEvent.click(screen.getByRole('button', { name: /confirm 2 guests/i }));
      await waitFor(() => {
        expect(mockUpdateName.mutateAsync).not.toHaveBeenCalled();
        expect(mockConfirm.mutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({ eventId: 'evt-1' }),
        );
      });
    });

    it('surfaces server-side rename errors (e.g. duplicate name) without submitting the RSVP', async () => {
      setRosterReady();
      mockUpdateName.mutateAsync.mockRejectedValueOnce(
        new Error('A household with this name already exists'),
      );
      render(<RsvpBottomSheet {...baseProps} />);
      const input = screen.getByLabelText(/household name/i) as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'The Smith Family' } });
      fireEvent.click(screen.getByRole('button', { name: /confirm 2 guests/i }));

      await waitFor(() => {
        expect(screen.getByText('A household with this name already exists')).toBeInTheDocument();
      });
      expect(mockConfirm.mutateAsync).not.toHaveBeenCalled();
    });
  });

  describe('per-slot attendee name (FPP-36)', () => {
    it('renders an editable name input for every roster member', () => {
      setRosterReady();
      render(<RsvpBottomSheet {...baseProps} />);
      const inputs = screen.getAllByTestId('rsvp-attendee-name');
      expect(inputs).toHaveLength(2);
      expect((inputs[0] as HTMLInputElement).value).toBe('Alice');
      expect((inputs[1] as HTMLInputElement).value).toBe('Ben');
    });

    it('lets the user rename a slot in place', () => {
      setRosterReady();
      render(<RsvpBottomSheet {...baseProps} />);
      const inputs = screen.getAllByTestId('rsvp-attendee-name') as HTMLInputElement[];
      fireEvent.change(inputs[0]!, { target: { value: 'Alicia' } });
      expect(inputs[0]!.value).toBe('Alicia');
    });

    it('Patches the household member and confirms the RSVP with the new name', async () => {
      setRosterReady();
      render(<RsvpBottomSheet {...baseProps} />);
      const inputs = screen.getAllByTestId('rsvp-attendee-name') as HTMLInputElement[];
      fireEvent.change(inputs[0]!, { target: { value: 'Alicia' } });
      fireEvent.click(screen.getByRole('button', { name: /confirm 2 guests/i }));

      await waitFor(() => {
        expect(mockUpdateMemberName.mutateAsync).toHaveBeenCalledWith({
          id: 'mem-1',
          name: 'Alicia',
        });
      });
      await waitFor(() => {
        expect(mockConfirm.mutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({
            eventId: 'evt-1',
            memberAttendances: expect.arrayContaining([
              expect.objectContaining({ householdMemberId: 'mem-1', memberName: 'Alicia' }),
            ]),
          }),
        );
      });
    });

    it('skips the PATCH when no slot name changed', async () => {
      setRosterReady();
      render(<RsvpBottomSheet {...baseProps} />);
      fireEvent.click(screen.getByRole('button', { name: /confirm 2 guests/i }));
      await waitFor(() => {
        expect(mockUpdateMemberName.mutateAsync).not.toHaveBeenCalled();
        expect(mockConfirm.mutateAsync).toHaveBeenCalled();
      });
    });

    it('blocks confirm when a slot name is empty', async () => {
      setRosterReady();
      render(<RsvpBottomSheet {...baseProps} />);
      const inputs = screen.getAllByTestId('rsvp-attendee-name') as HTMLInputElement[];
      fireEvent.change(inputs[0]!, { target: { value: '   ' } });
      const submit = screen.getByRole('button', { name: /confirm 2 guests/i });
      expect(submit).toBeDisabled();
      expect(screen.getByTestId('rsvp-attendee-name-error').textContent).toMatch(
        /name is required/i,
      );
      expect(mockUpdateMemberName.mutateAsync).not.toHaveBeenCalled();
      expect(mockConfirm.mutateAsync).not.toHaveBeenCalled();
    });

    // FPP-36 review finding 4: the input strips trailing
    // whitespace on blur so the visible value matches what gets
    // persisted.
    it('trims trailing whitespace on blur', () => {
      setRosterReady();
      render(<RsvpBottomSheet {...baseProps} />);
      const inputs = screen.getAllByTestId('rsvp-attendee-name') as HTMLInputElement[];
      fireEvent.change(inputs[0]!, { target: { value: 'Alicia   ' } });
      fireEvent.blur(inputs[0]!);
      expect(inputs[0]!.value).toBe('Alicia');
    });

    // FPP-36 review finding 3: the aria-label is sourced from the
    // validated snapshot, so a control-character payload never
    // leaks into the accessible name.
    it('does not surface control characters in the aria-label', () => {
      setRosterReady();
      render(<RsvpBottomSheet {...baseProps} />);
      const inputs = screen.getAllByTestId('rsvp-attendee-name') as HTMLInputElement[];
      // Type a string that the schema would reject.
      fireEvent.change(inputs[0]!, { target: { value: 'Alice\u2028Bob' } });
      // The aria-label still references the snapshot ("Alice"),
      // never the live value, so screen readers never announce
      // the control character.
      expect(inputs[0]!.getAttribute('aria-label')).toBe('Name for Alice');
    });

    // FPP-36 re-review observation: when the secondary fallback
    // (`draft.memberName.trim()`) returns an empty string, the
    // tertiary tier (`slot N`) must take over so screen readers
    // do not announce "Name for" with an empty suffix. Switching
    // `??` to `||` on the secondary tier closes this gap.
    it('falls back to a slot label when the live name is empty (guest path)', async () => {
      setRosterReady();
      render(<RsvpBottomSheet {...baseProps} />);
      // Add a guest (no `originalMemberName`) and then clear the
      // input to exercise the empty-string fallback.
      fireEvent.click(screen.getByRole('button', { name: /add a one-time guest/i }));
      const guestNameInput = screen.getByLabelText(/guest name/i);
      fireEvent.change(guestNameInput, { target: { value: 'Cousin' } });
      fireEvent.click(screen.getByRole('button', { name: /^add$/i }));

      // Wait for the guest row to mount.
      await waitFor(() => {
        expect(screen.getByLabelText('Attendance for Cousin')).toBeInTheDocument();
      });
      const guestInput = (await waitFor(() => {
        const all = screen.getAllByTestId('rsvp-attendee-name') as HTMLInputElement[];
        const guest = all.find((input) => input.value === 'Cousin');
        expect(guest).toBeDefined();
        return guest!;
      })) as HTMLInputElement;
      fireEvent.change(guestInput, { target: { value: '' } });
      // The aria-label falls through to the slot label rather than
      // rendering "Name for " with nothing after. Re-query the input
      // so the assertion runs against the post-render DOM.
      await waitFor(() => {
        const all = screen.getAllByTestId('rsvp-attendee-name') as HTMLInputElement[];
        const guest = all.find((input) => input.value === '');
        expect(guest?.getAttribute('aria-label')).toBe('Name for slot 3');
      });
    });

    // BoopPr finding F2: when the live name on a guest row has a
    // forbidden character (a line separator, for example), the
    // trimmed value still contains it because trim() does not strip
    // control characters. The accessible name must fall back to the
    // generic slot label rather than surface the forbidden character
    // to a screen reader.
    it('falls back to a slot label when a guest types a forbidden character', async () => {
      setRosterReady();
      render(<RsvpBottomSheet {...baseProps} />);
      fireEvent.click(screen.getByRole('button', { name: /add a one-time guest/i }));
      const guestNameInput = screen.getByLabelText(/guest name/i);
      fireEvent.change(guestNameInput, { target: { value: 'Cousin' } });
      fireEvent.click(screen.getByRole('button', { name: /^add$/i }));

      await waitFor(() => {
        expect(screen.getByLabelText('Attendance for Cousin')).toBeInTheDocument();
      });
      const guestInput = (await waitFor(() => {
        const all = screen.getAllByTestId('rsvp-attendee-name') as HTMLInputElement[];
        const guest = all.find((input) => input.value === 'Cousin');
        expect(guest).toBeDefined();
        return guest!;
      })) as HTMLInputElement;
      // Type a string with a U+2028 line separator. The schema
      // blocks submit, but the aria-label must not surface the
      // control character to a screen reader in the meantime.
      fireEvent.change(guestInput, { target: { value: 'Cousin\u2028Bob' } });
      await waitFor(() => {
        const all = screen.getAllByTestId('rsvp-attendee-name') as HTMLInputElement[];
        const guest = all.find((input) => input.value === 'Cousin\u2028Bob');
        expect(guest?.getAttribute('aria-label')).toBe('Name for slot 3');
      });
    });

    // BoopPr finding F1: when the rename loop fails midway, the
    // error message must surface which rows succeeded so the user
    // knows what state the household is in.
    it('reports renamed members in the error message when a later rename fails', async () => {
      setRosterReady();
      // First rename succeeds; second rejects with a server error.
      mockUpdateMemberName.mutateAsync
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('Forbidden: duplicate name'));
      render(<RsvpBottomSheet {...baseProps} />);
      const inputs = screen.getAllByTestId('rsvp-attendee-name') as HTMLInputElement[];
      fireEvent.change(inputs[0]!, { target: { value: 'Alicia' } });
      fireEvent.change(inputs[1]!, { target: { value: 'Benjamin' } });
      fireEvent.click(screen.getByRole('button', { name: /confirm 2 guests/i }));

      // Confirm was not called because the second rename failed.
      await waitFor(() => {
        expect(mockConfirm.mutateAsync).not.toHaveBeenCalled();
      });
      // The error message names the renamed member using the
      // `from → to` format so two renames that land on the same
      // value do not collapse into an ambiguous list.
      await waitFor(() => {
        expect(
          screen.getByText(/Renamed 1 member \(Alice → Alicia\) before the error/i),
        ).toBeInTheDocument();
      });
      expect(mockUpdateMemberName.mutateAsync).toHaveBeenCalledTimes(2);
    });

    // BoopPr finding F1: two renames that collide on the new
    // value must still be disambiguated by the original name in
    // the summary.
    it('disambiguates colliding rename targets with the original name', async () => {
      setRosterReady();
      // Rename Alice → Alicia and Ben → Alicia. Both mocks succeed
      // so we land on the confirmed phase, then we inspect the
      // tracked renames via a synthetic failure on the confirm.
      mockConfirm.mutateAsync.mockRejectedValueOnce(new Error('payment offline'));
      render(<RsvpBottomSheet {...baseProps} />);
      const inputs = screen.getAllByTestId('rsvp-attendee-name') as HTMLInputElement[];
      fireEvent.change(inputs[0]!, { target: { value: 'Alicia' } });
      fireEvent.change(inputs[1]!, { target: { value: 'Alicia' } });
      fireEvent.click(screen.getByRole('button', { name: /confirm 2 guests/i }));

      // The summary names both rows with their original names so
      // the user can tell which household members were renamed
      // even when the new names collide.
      await waitFor(() => {
        expect(screen.getByText(/Alice → Alicia, Ben → Alicia/i)).toBeInTheDocument();
      });
    });
  });
});
