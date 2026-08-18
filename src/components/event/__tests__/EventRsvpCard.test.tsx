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
  useHouseholdNameMutation: () => ({
    updateName: { mutateAsync: vi.fn() },
  }),
  useHouseholdMemberNameMutation: () => ({
    updateName: { mutateAsync: vi.fn() },
  }),
  useUserProfileMutation: () => ({
    updatePreferences: { mutateAsync: vi.fn() },
  }),
}));

vi.mock('~/lib/trpc-client', () => ({
  trpc: {
    payment: {
      getMyRegistration: {
        useQuery: () => ({ data: null, isLoading: false, error: null }),
      },
    },
  },
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
  useSearchParams: () => new URLSearchParams(),
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

  describe('registration fee display (FPP-16)', () => {
    it('hides the fee line when the snapshot is zero', () => {
      render(
        <EventRsvpCard
          {...baseProps}
          existingRsvp={{ ...confirmedRsvp, registrationFeeCents: 0 }}
        />,
      );
      expect(screen.queryByText(/registration fee/i)).not.toBeInTheDocument();
    });

    it('omits the fee line when the snapshot is undefined (free event)', () => {
      render(<EventRsvpCard {...baseProps} existingRsvp={confirmedRsvp} />);
      expect(screen.queryByText(/registration fee/i)).not.toBeInTheDocument();
    });

    it('renders the snapshotted fee on the confirmed card', () => {
      render(
        <EventRsvpCard
          {...baseProps}
          existingRsvp={{
            ...confirmedRsvp,
            registrationFeeCents: 5000,
            registrationFeeCurrency: 'usd',
          }}
        />,
      );
      expect(screen.getByText(/first-charge total: \$50\.00/i)).toBeInTheDocument();
    });

    it('uses the snapshotted currency for the formatted fee', () => {
      render(
        <EventRsvpCard
          {...baseProps}
          existingRsvp={{
            ...confirmedRsvp,
            registrationFeeCents: 2500,
            registrationFeeCurrency: 'eur',
          }}
        />,
      );
      expect(screen.getByText(/€25\.00/)).toBeInTheDocument();
    });

    it('falls back to USD when no currency is set on the snapshot', () => {
      render(
        <EventRsvpCard
          {...baseProps}
          existingRsvp={{ ...confirmedRsvp, registrationFeeCents: 1000 }}
        />,
      );
      expect(screen.getByText(/first-charge total: \$10\.00/i)).toBeInTheDocument();
    });

    it('does not show the fee line on the DECLINED card even with a snapshot', () => {
      render(
        <EventRsvpCard
          {...baseProps}
          existingRsvp={{
            ...confirmedRsvp,
            status: 'DECLINED',
            headcount: 0,
            registrationFeeCents: 5000,
          }}
        />,
      );
      expect(screen.queryByText(/registration fee/i)).not.toBeInTheDocument();
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

  // FPP-35: a user who has not yet RSVPed can still decline
  // without going through the attendance form. FPP-89 changed the
  // no-RSVP branch from a primary "RSVP Now" CTA to an invitation-
  // only entry, but the "Can't make it" link survives — a user
  // without an invitation can still opt out without one.
  describe('no-RSVP decline path (FPP-35)', () => {
    it('shows a "Can\'t make it" link when no RSVP exists yet', () => {
      render(<EventRsvpCard {...baseProps} existingRsvp={null} />);
      const declineBtn = screen.getByTestId('rsvp-card-decline-link');
      expect(declineBtn).toBeInTheDocument();
      expect(declineBtn).toHaveTextContent(/Can.?t make it/);
    });

    it('calls the decline mutation when the no-RSVP user clicks the link', async () => {
      render(<EventRsvpCard {...baseProps} existingRsvp={null} />);
      fireEvent.click(screen.getByTestId('rsvp-card-decline-link'));
      await waitFor(() => {
        expect(mockDecline.mutateAsync).toHaveBeenCalledWith({ eventId: 'evt-1' });
      });
    });

    it('hides the decline link when the RSVP deadline has passed', () => {
      const pastDeadline = '2020-01-01T00:00:00Z';
      render(<EventRsvpCard {...baseProps} rsvpDeadline={pastDeadline} existingRsvp={null} />);
      expect(screen.queryByTestId('rsvp-card-decline-link')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /rsvp closed/i })).not.toBeInTheDocument();
    });

    it('still shows the decline link even when the event is full', () => {
      render(
        <EventRsvpCard {...baseProps} maxCapacity={10} currentAttending={10} existingRsvp={null} />,
      );
      expect(screen.getByRole('button', { name: /join waitlist/i })).toBeInTheDocument();
      expect(screen.getByTestId('rsvp-card-decline-link')).toBeInTheDocument();
    });
  });

  describe('universal direct RSVP', () => {
    it('renders the RSVP Now button when no RSVP exists yet', () => {
      render(<EventRsvpCard {...baseProps} existingRsvp={null} />);
      expect(screen.getByText(/are you coming/i)).toBeInTheDocument();
      expect(screen.getByTestId('rsvp-card-rsvp-button')).toHaveTextContent(/rsvp now/i);
    });

    it('renders Join Waitlist button when the event is at full capacity', () => {
      render(
        <EventRsvpCard {...baseProps} maxCapacity={10} currentAttending={10} existingRsvp={null} />,
      );
      expect(screen.getByTestId('rsvp-card-rsvp-button')).toHaveTextContent(/join waitlist/i);
    });
  });
});
