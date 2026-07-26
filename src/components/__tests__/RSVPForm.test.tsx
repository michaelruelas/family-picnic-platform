import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockConfirm = { mutateAsync: vi.fn() };
const mockDecline = { mutateAsync: vi.fn() };

vi.mock('~/hooks', () => ({
  useOffline: () => ({ isOnline: true, lastOnline: new Date() }),
  useRsvpMutation: () => ({
    confirm: mockConfirm,
    decline: mockDecline,
  }),
}));

const { default: RSVPForm } = await import('../RSVPForm');

beforeEach(() => {
  mockConfirm.mutateAsync.mockReset();
  mockDecline.mutateAsync.mockReset();
  mockConfirm.mutateAsync.mockResolvedValue({});
  mockDecline.mutateAsync.mockResolvedValue({});
});

describe('RSVPForm', () => {
  it('shows past event message when isPast', () => {
    render(<RSVPForm eventId="e1" isPast={true} currentAttending={0} />);
    expect(screen.getByText(/already taken place/i)).toBeInTheDocument();
  });

  it('shows "You attended" for confirmed past event', () => {
    render(
      <RSVPForm
        eventId="e1"
        isPast={true}
        currentAttending={0}
        existingRsvp={{ status: 'CONFIRMED', headcount: 1, dietaryNotes: null }}
      />,
    );
    expect(screen.getByText(/You attended/i)).toBeInTheDocument();
  });

  it('renders confirm/decline buttons for new RSVPs', () => {
    render(<RSVPForm eventId="e1" isPast={false} currentAttending={0} />);
    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /decline/i })).toBeInTheDocument();
  });

  it('calls confirm mutation on confirm click', async () => {
    render(<RSVPForm eventId="e1" isPast={false} currentAttending={0} />);
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    await waitFor(() => {
      expect(mockConfirm.mutateAsync).toHaveBeenCalledWith({
        eventId: 'e1',
        headcount: 1,
        dietaryNotes: undefined,
      });
    });
  });

  it('calls decline mutation after decline confirm', async () => {
    render(<RSVPForm eventId="e1" isPast={false} currentAttending={0} />);
    const declineBtn = screen.getAllByRole('button', { name: /decline/i })[0]!;
    fireEvent.click(declineBtn);
    await waitFor(() => {
      expect(screen.getByText(/Are you sure/i)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Yes, Decline/i }));
    await waitFor(() => {
      expect(mockDecline.mutateAsync).toHaveBeenCalledWith({ eventId: 'e1' });
    });
  });

  it('shows error message when confirm fails', async () => {
    mockConfirm.mutateAsync.mockRejectedValue(new Error('RSVP failed'));
    render(<RSVPForm eventId="e1" isPast={false} currentAttending={0} />);
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    await waitFor(() => {
      expect(screen.getByText(/RSVP failed/i)).toBeInTheDocument();
    });
  });

  it('shows existing confirmed status', () => {
    render(
      <RSVPForm
        eventId="e1"
        isPast={false}
        currentAttending={1}
        existingRsvp={{ status: 'CONFIRMED', headcount: 2, dietaryNotes: 'vegetarian' }}
      />,
    );
    expect(screen.getByText(/You.*Attending/i)).toBeInTheDocument();
  });

  it('shows existing declined status', () => {
    render(
      <RSVPForm
        eventId="e1"
        isPast={false}
        currentAttending={0}
        existingRsvp={{ status: 'DECLINED', headcount: 0, dietaryNotes: null }}
      />,
    );
    expect(screen.getByText(/You Declined/i)).toBeInTheDocument();
  });

  it('shows waitlist status with position', () => {
    render(
      <RSVPForm
        eventId="e1"
        isPast={false}
        currentAttending={50}
        maxCapacity={50}
        existingRsvp={{ status: 'WAITLISTED', headcount: 1, dietaryNotes: null, waitlistPosition: 3 }}
      />,
    );
    expect(screen.getByText(/On Waitlist/i)).toBeInTheDocument();
  });

  it('shows full event message when capacity reached', () => {
    render(
      <RSVPForm
        eventId="e1"
        isPast={false}
        currentAttending={50}
        maxCapacity={50}
      />,
    );
    expect(screen.getByText(/This event is full/i)).toBeInTheDocument();
  });
});
