import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockDecline = { mutateAsync: vi.fn() };

vi.mock('~/hooks', () => ({
  useRsvpMutation: () => ({
    confirm: { mutateAsync: vi.fn() },
    decline: mockDecline,
  }),
  useRsvpFormState: () => ({
    data: null,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock('react-dom', async () => {
  const actual = await vi.importActual<typeof import('react-dom')>('react-dom');
  return { ...actual, createPortal: (node: React.ReactNode) => node };
});

const { EventRsvpCard } = await import('../EventRsvpCard');

beforeEach(() => {
  mockDecline.mutateAsync.mockReset();
  mockDecline.mutateAsync.mockResolvedValue({});
});

const baseProps = {
  eventId: 'evt-1',
  eventName: 'Annual Picnic',
  eventDate: new Date('2026-09-01T17:00:00Z'),
  location: 'Central Park, New York',
  isPast: false,
  isLoggedIn: true,
  rsvpDeadline: null,
  maxCapacity: 100,
  currentAttending: 10,
};

const memberAttendances = [
  {
    id: 'att-1',
    householdMemberId: 'mem-1',
    memberName: 'Alice',
    memberAge: 35,
    attending: 'YES' as const,
  },
  {
    id: 'att-2',
    householdMemberId: 'mem-2',
    memberName: 'Ben',
    memberAge: 8,
    attending: 'NO' as const,
  },
];

const confirmedRsvp = {
  id: 'rsvp-1',
  status: 'CONFIRMED' as const,
  headcount: 2,
  dietaryNotes: null,
  modifiedAt: '2026-07-01T12:00:00Z',
  memberAttendances,
};

describe('EventRsvpCard', () => {
  describe('rendering by state', () => {
    it('shows a sign-in prompt when not logged in', () => {
      render(<EventRsvpCard {...baseProps} isLoggedIn={false} existingRsvp={null} />);
      expect(screen.getByText(/join the gathering/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument();
    });

    it('shows a past-event message for past events', () => {
      render(
        <EventRsvpCard
          {...baseProps}
          isPast
          existingRsvp={{ ...confirmedRsvp, status: 'CONFIRMED' }}
        />,
      );
      expect(screen.getByText(/this gathering has passed/i)).toBeInTheDocument();
      expect(screen.getByText(/wonderful time/i)).toBeInTheDocument();
    });

    it('shows the CONFIRMED card with the "You are in" badge', () => {
      render(<EventRsvpCard {...baseProps} existingRsvp={confirmedRsvp} />);
      expect(screen.getByText(/you're in/i)).toBeInTheDocument();
      expect(screen.getByText(/see you at annual picnic/i)).toBeInTheDocument();
      expect(screen.getByText(/2 people on the way/i)).toBeInTheDocument();
    });

    it('shows the DECLINED card with the change-your-mind copy', () => {
      render(
        <EventRsvpCard
          {...baseProps}
          existingRsvp={{ ...confirmedRsvp, status: 'DECLINED', headcount: 0 }}
        />,
      );
      expect(screen.getByText(/you declined/i)).toBeInTheDocument();
      expect(screen.getByText(/changed your mind/i)).toBeInTheDocument();
    });

    it('shows the WAITLISTED card with update copy when isRsvpOpen', () => {
      render(
        <EventRsvpCard
          {...baseProps}
          existingRsvp={{ ...confirmedRsvp, status: 'WAITLISTED', headcount: 1 }}
        />,
      );
      expect(screen.getByText(/we.?ll let you know/i)).toBeInTheDocument();
    });
  });

  describe('per-member attendance', () => {
    it('renders one row per attendance entry with the human-readable label', () => {
      render(<EventRsvpCard {...baseProps} existingRsvp={confirmedRsvp} />);
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Ben')).toBeInTheDocument();
      expect(screen.getByText('Going')).toBeInTheDocument();
      expect(screen.getByText('Not going')).toBeInTheDocument();
    });

    it('omits the per-member list when the array is empty', () => {
      render(
        <EventRsvpCard {...baseProps} existingRsvp={{ ...confirmedRsvp, memberAttendances: [] }} />,
      );
      expect(screen.queryByText('Going')).not.toBeInTheDocument();
      expect(screen.queryByText('Not going')).not.toBeInTheDocument();
    });

    it('omits the per-member list when RSVP is closed', () => {
      const pastDeadline = '2020-01-01T00:00:00Z';
      render(
        <EventRsvpCard {...baseProps} rsvpDeadline={pastDeadline} existingRsvp={confirmedRsvp} />,
      );
      expect(screen.queryByText('Going')).not.toBeInTheDocument();
      expect(screen.queryByText('View confirmation')).not.toBeInTheDocument();
    });
  });

  describe('confirmation link', () => {
    it('links the "View confirmation" button to /my-events/<rsvpId>/confirmation', () => {
      render(<EventRsvpCard {...baseProps} existingRsvp={confirmedRsvp} />);
      const link = screen.getByRole('link', { name: /view confirmation/i });
      expect(link).toHaveAttribute('href', '/my-events/rsvp-1/confirmation');
    });
  });

  describe('actions', () => {
    it("calls the decline mutation when the user clicks Can't make it", async () => {
      render(<EventRsvpCard {...baseProps} existingRsvp={confirmedRsvp} />);
      const declineBtn = await screen.findByRole('button', { name: /make it/i });
      fireEvent.click(declineBtn);
      await waitFor(() => {
        expect(mockDecline.mutateAsync).toHaveBeenCalledWith({ eventId: 'evt-1' });
      });
    });
  });
});
