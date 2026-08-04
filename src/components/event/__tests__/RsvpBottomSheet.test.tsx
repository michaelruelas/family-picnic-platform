import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockConfirm = { mutateAsync: vi.fn() };
const mockDecline = { mutateAsync: vi.fn() };
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
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh, push: vi.fn() }),
}));

vi.mock('react-dom', async () => {
  const actual = await vi.importActual<typeof import('react-dom')>('react-dom');
  return { ...actual, createPortal: (node: React.ReactNode) => node };
});

const { RsvpBottomSheet } = await import('../RsvpBottomSheet');

beforeEach(() => {
  mockConfirm.mutateAsync.mockReset();
  mockDecline.mutateAsync.mockReset();
  mockConfirm.mutateAsync.mockResolvedValue({ id: 'rsvp-1' });
  mockDecline.mutateAsync.mockResolvedValue({});
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

  it('pre-fills dietary notes from the existing RSVP', async () => {
    mockFormState.data = {
      householdId: 'h-1',
      members,
      rsvp: {
        id: 'rsvp-1',
        status: 'CONFIRMED',
        headcount: 1,
        dietaryNotes: 'vegan',
        memberAttendances: [],
      },
    };
    render(<RsvpBottomSheet {...baseProps} />);
    await waitFor(() => {
      const textarea = screen.getByPlaceholderText(/allergies/i) as HTMLTextAreaElement;
      expect(textarea.value).toBe('vegan');
    });
  });

  it('preserves a one-time guest through a confirm cycle', async () => {
    setRosterReady();
    render(<RsvpBottomSheet {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: /add a one-time guest/i }));
    const nameInput = screen.getByPlaceholderText(/^name$/i);
    fireEvent.change(nameInput, { target: { value: 'Cousin' } });
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

  it("calls the decline mutation when the user clicks Can't make it", async () => {
    setRosterReady();
    render(<RsvpBottomSheet {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: /can't make it/i }));
    await waitFor(() => {
      expect(mockDecline.mutateAsync).toHaveBeenCalledWith({ eventId: 'evt-1' });
    });
  });
});
