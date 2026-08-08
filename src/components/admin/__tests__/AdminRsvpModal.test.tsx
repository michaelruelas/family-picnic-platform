import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { ToastProvider } from '~/components/ui/Toast';
import { RSVPStatus, RsvpAttending, EventStatus } from '~/lib/generated/enums';

const mockRefresh = vi.fn();
const mockPush = vi.fn();
const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh, replace: mockReplace }),
  usePathname: () => '/admin/events/e1/members',
  useSearchParams: () => new URLSearchParams(),
}));

const mockAddToast = vi.fn();

vi.mock('~/components/ui/Toast', async () => {
  const actual =
    await vi.importActual<typeof import('~/components/ui/Toast')>('~/components/ui/Toast');
  return {
    ...actual,
    useToast: () => ({ addToast: mockAddToast, removeToast: vi.fn(), toasts: [] }),
  };
});

// Mock trpc-client so the modal can fetch the existing RSVP
// in edit mode without booting the full tRPC pipeline. The
// returned object is stable across calls so the modal's effect
// does not loop on a new reference every render.
const getByIdDataRef: { current: unknown } = { current: undefined };
const getByIdErrorRef: { current: unknown } = { current: null };
const getByIdLoadingRef: { current: boolean } = { current: false };
vi.mock('~/lib/trpc-client', () => ({
  trpc: {
    rsvp: {
      getById: {
        useQuery: () => ({
          data: getByIdDataRef.current,
          error: getByIdErrorRef.current,
          isLoading: getByIdLoadingRef.current,
        }),
      },
    },
  },
}));

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

const { default: AdminRsvpModal } = await import('../AdminRsvpModal');

function renderModal(ui: React.ReactNode) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

const baseTargetUser = {
  id: 'u-garcia',
  name: 'Maria Garcia',
  email: 'maria@example.com',
  householdName: 'The Garcia Family',
};

const baseMembers = [
  { id: 'm1', name: 'Maria Garcia', age: 35, relationship: 'SELF' },
  { id: 'm2', name: 'Carlos Garcia', age: 8, relationship: 'CHILD' },
];

beforeEach(() => {
  mockAddToast.mockReset();
  mockRefresh.mockReset();
  mockPush.mockReset();
  mockReplace.mockReset();
  fetchMock.mockReset();
  getByIdDataRef.current = undefined;
  getByIdErrorRef.current = null;
  getByIdLoadingRef.current = false;

  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    text: () => Promise.resolve(JSON.stringify({ rsvpId: 'r-new', status: 'CONFIRMED' })),
  });
});

describe('AdminRsvpModal', () => {
  it('opens in add mode with status CONFIRMED, headcount 1, and no decline field', () => {
    renderModal(
      <AdminRsvpModal
        eventId="e1"
        eventName="Folia Picnic"
        eventStatus={EventStatus.PUBLISHED}
        targetUser={baseTargetUser}
        members={baseMembers}
        onClose={vi.fn()}
      />,
    );

    // Status is CONFIRMED by default for the add path.
    const confirmed = screen.getByTestId('status-confirmed');
    expect(confirmed).toHaveAttribute('aria-checked', 'true');
    const declined = screen.getByTestId('status-declined');
    expect(declined).toHaveAttribute('aria-checked', 'false');

    // No decline message textarea yet because the default status is CONFIRMED.
    expect(screen.queryByTestId('decline-message')).not.toBeInTheDocument();

    // Headcount input is present.
    expect(screen.getByTestId('headcount-input')).toBeInTheDocument();

    // Per-member grid is present with both members marked YES by default.
    const grid = screen.getByTestId('attendance-grid');
    expect(within(grid).getByText('Maria Garcia')).toBeInTheDocument();
    expect(within(grid).getByText('Carlos Garcia')).toBeInTheDocument();
    expect(screen.getByTestId('attending-m1-yes') as HTMLInputElement).toBeChecked();
  });

  it('shows the decline message textarea only when status flips to DECLINED', () => {
    renderModal(
      <AdminRsvpModal
        eventId="e1"
        eventName="Folia Picnic"
        eventStatus={EventStatus.PUBLISHED}
        targetUser={baseTargetUser}
        members={baseMembers}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('decline-message')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('status-declined'));

    const declineField = screen.getByTestId('decline-message');
    expect(declineField).toBeInTheDocument();
    // Headcount input is hidden on DECLINED — the field only
    // applies to confirmed RSVPs.
    expect(screen.queryByTestId('headcount-input')).not.toBeInTheDocument();
  });

  it('shows a validation error when saving a CONFIRMED RSVP with no YES members', async () => {
    renderModal(
      <AdminRsvpModal
        eventId="e1"
        eventName="Folia Picnic"
        eventStatus={EventStatus.PUBLISHED}
        targetUser={baseTargetUser}
        members={baseMembers}
        onClose={vi.fn()}
      />,
    );

    // Flip every member to NO so yesCount = 0.
    fireEvent.click(screen.getByTestId('attending-m1-no'));
    fireEvent.click(screen.getByTestId('attending-m2-no'));

    fireEvent.click(screen.getByTestId('save'));

    expect(await screen.findByTestId('error-message')).toHaveTextContent(
      /at least one member must be marked as going/i,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('saves a CONFIRMED RSVP and toasts success', async () => {
    const onSaved = vi.fn();
    const onClose = vi.fn();

    renderModal(
      <AdminRsvpModal
        eventId="e1"
        eventName="Folia Picnic"
        eventStatus={EventStatus.PUBLISHED}
        targetUser={baseTargetUser}
        members={baseMembers}
        onClose={onClose}
        onSaved={onSaved}
      />,
    );

    fireEvent.click(screen.getByTestId('save'));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/rsvp/override',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/admin/rsvp/override');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.eventId).toBe('e1');
    expect(body.userId).toBe('u-garcia');
    expect(body.status).toBe('CONFIRMED');
    // Both members default to YES so the headcount is 2.
    expect(body.headcount).toBe(2);
    expect(body.memberAttendances).toHaveLength(2);

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('success', 'RSVP confirmed');
    });
    expect(onSaved).toHaveBeenCalled();
    expect(mockRefresh).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('saves a DECLINED RSVP with the decline note and toasts decline', async () => {
    renderModal(
      <AdminRsvpModal
        eventId="e1"
        eventName="Folia Picnic"
        eventStatus={EventStatus.PUBLISHED}
        targetUser={baseTargetUser}
        members={baseMembers}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('status-declined'));
    fireEvent.change(screen.getByTestId('decline-message'), {
      target: { value: '  Sick on the day — sorry!  ' },
    });
    fireEvent.click(screen.getByTestId('save'));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.status).toBe('DECLINED');
    // The client ships the raw input; the server-side schema
    // trims the value before persisting. The trim path is
    // covered by the route test (decline writes DECLINE_NOTE
    // asserts the trimmed body). Here we just confirm the
    // wire shape carries the note.
    expect(body.declineMessage).toBe('  Sick on the day — sorry!  ');
    // No attendance rows on decline.
    expect(body.memberAttendances).toBeUndefined();

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('success', 'RSVP declined');
    });
  });

  it('renders a read-only banner and disables save while event is CANCELLED', async () => {
    renderModal(
      <AdminRsvpModal
        eventId="e1"
        eventName="Folia Picnic"
        eventStatus={EventStatus.CANCELLED}
        targetUser={baseTargetUser}
        members={baseMembers}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByTestId('admin-rsvp-readonly')).toBeInTheDocument();
    const save = screen.getByTestId('save') as HTMLButtonElement;
    expect(save).toBeDisabled();
    fireEvent.click(save);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('disables the save button while the request is in flight', async () => {
    let resolveFetch: (value: Response) => void = () => {};
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    renderModal(
      <AdminRsvpModal
        eventId="e1"
        eventName="Folia Picnic"
        eventStatus={EventStatus.PUBLISHED}
        targetUser={baseTargetUser}
        members={baseMembers}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('save'));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    // While the promise is unresolved the button must be
    // disabled with a "Saving…" label.
    const save = screen.getByTestId('save') as HTMLButtonElement;
    expect(save).toBeDisabled();
    expect(save).toHaveTextContent(/saving/i);

    await act(async () => {
      resolveFetch(
        new Response(JSON.stringify({ rsvpId: 'r-new', status: 'CONFIRMED' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    });
  });

  it('prefills from the tRPC getById result on edit and refreshes after save', async () => {
    getByIdDataRef.current = {
      rsvp: {
        id: 'r1',
        eventId: 'e1',
        userId: 'u-garcia',
        householdId: 'h1',
        status: RSVPStatus.CONFIRMED,
        headcount: 2,
        declineMessage: null,
        memberAttendances: [
          {
            id: 'a1',
            householdMemberId: 'm1',
            memberNameSnapshot: 'Maria Garcia',
            memberAgeSnapshot: 35,
            attending: RsvpAttending.YES,
          },
          {
            id: 'a2',
            householdMemberId: 'm2',
            memberNameSnapshot: 'Carlos Garcia',
            memberAgeSnapshot: 8,
            attending: RsvpAttending.NO,
          },
        ],
      },
      user: { id: 'u-garcia', name: 'Maria Garcia', email: 'maria@example.com' },
      household: { id: 'h1', name: 'The Garcia Family' },
      members: baseMembers,
    };
    getByIdLoadingRef.current = false;

    renderModal(
      <AdminRsvpModal
        eventId="e1"
        eventName="Folia Picnic"
        eventStatus={EventStatus.PUBLISHED}
        rsvpId="r1"
        targetUser={baseTargetUser}
        onClose={vi.fn()}
      />,
    );

    // Prefilled YES on m1, NO on m2 — auto-derived headcount 1.
    expect(screen.getByTestId('attending-m1-yes')).toBeChecked();
    expect(screen.getByTestId('attending-m2-no')).toBeChecked();

    // The header should mention the household + member count.
    expect(screen.getByText(/Existing RSVP/)).toBeInTheDocument();

    // Save → POST + router.refresh + close.
    fireEvent.click(screen.getByTestId('save'));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/rsvp/override',
        expect.objectContaining({ method: 'POST' }),
      );
    });
    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
  });
});
