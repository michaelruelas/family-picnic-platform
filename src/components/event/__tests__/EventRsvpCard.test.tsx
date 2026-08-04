import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const mockConfirm = { mutateAsync: vi.fn() };
const mockDecline = { mutateAsync: vi.fn() };
const mockRefresh = vi.fn();

vi.mock('~/hooks', () => ({
  useRsvpMutation: () => ({
    confirm: mockConfirm,
    decline: mockDecline,
  }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

vi.mock('react-dom', async () => {
  const actual = await vi.importActual<typeof import('react-dom')>('react-dom');
  return { ...actual, createPortal: (node: React.ReactNode) => node };
});

const { EventRsvpCard } = await import('../EventRsvpCard');

beforeEach(() => {
  mockConfirm.mutateAsync.mockReset();
  mockDecline.mutateAsync.mockReset();
  mockConfirm.mutateAsync.mockResolvedValue({});
  mockDecline.mutateAsync.mockResolvedValue({});
  mockRefresh.mockReset();
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

const confirmedRsvp = {
  status: 'CONFIRMED' as const,
  headcount: 3,
  dietaryNotes: 'vegetarian',
  modifiedAt: '2026-07-01T12:00:00Z',
};

const declinedRsvp = {
  status: 'DECLINED' as const,
  headcount: 0,
  dietaryNotes: null,
  modifiedAt: '2026-07-01T12:00:00Z',
};

const waitlistedRsvp = {
  status: 'WAITLISTED' as const,
  headcount: 2,
  dietaryNotes: null,
  modifiedAt: '2026-07-01T12:00:00Z',
};

describe('EventRsvpCard', () => {
  describe('LastUpdated', () => {
    it('renders the modifiedAt timestamp when there is an existing RSVP', () => {
      render(<EventRsvpCard {...baseProps} existingRsvp={confirmedRsvp} />);

      const time = screen.getByText(/Last updated/i).querySelector('time');
      expect(time).not.toBeNull();
      expect(time).toHaveAttribute('datetime', confirmedRsvp.modifiedAt);
    });

    it('does not render LastUpdated when there is no existing RSVP', () => {
      render(<EventRsvpCard {...baseProps} existingRsvp={null} />);

      expect(screen.queryByText(/Last updated/i)).not.toBeInTheDocument();
    });
  });

  describe('Edit RSVP routing', () => {
    it('opens the bottom sheet (not the inline panel) when a CONFIRMED user clicks Edit RSVP', () => {
      render(<EventRsvpCard {...baseProps} existingRsvp={confirmedRsvp} />);

      fireEvent.click(screen.getByRole('button', { name: /edit rsvp/i }));

      expect(screen.getByRole('heading', { name: /update your party/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /save changes for 3/i })).toBeInTheDocument();
      expect(screen.queryByText(/Number of people/i)).not.toBeInTheDocument();
    });

    it('opens the bottom sheet when a DECLINED user clicks RSVP again', () => {
      render(<EventRsvpCard {...baseProps} existingRsvp={declinedRsvp} />);

      fireEvent.click(screen.getByRole('button', { name: /rsvp again/i }));

      expect(screen.getByRole('heading', { name: /who's coming/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /confirm 1 guest/i })).toBeInTheDocument();
    });

    it('opens the bottom sheet when a WAITLISTED user clicks Update your RSVP', () => {
      render(<EventRsvpCard {...baseProps} existingRsvp={waitlistedRsvp} />);

      fireEvent.click(screen.getByRole('button', { name: /update your rsvp/i }));

      expect(screen.getByRole('heading', { name: /update your party/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /save changes for 2/i })).toBeInTheDocument();
    });

    it('does not show the inline edit panel for any existing RSVP state', () => {
      const { rerender } = render(<EventRsvpCard {...baseProps} existingRsvp={confirmedRsvp} />);
      expect(screen.queryByText(/Edit your RSVP/i)).not.toBeInTheDocument();

      rerender(<EventRsvpCard {...baseProps} existingRsvp={declinedRsvp} />);
      expect(screen.queryByText(/Edit your RSVP/i)).not.toBeInTheDocument();

      rerender(<EventRsvpCard {...baseProps} existingRsvp={waitlistedRsvp} />);
      expect(screen.queryByText(/Edit your RSVP/i)).not.toBeInTheDocument();
    });
  });

  describe('decline', () => {
    it('calls the decline mutation when a CONFIRMED user clicks Can&apos;t make it', () => {
      render(<EventRsvpCard {...baseProps} existingRsvp={confirmedRsvp} />);

      const buttons = screen.getAllByRole('button', { name: /Can(&apos;|')t make it/i });
      fireEvent.click(buttons[0]!);

      expect(mockDecline.mutateAsync).toHaveBeenCalledWith({ eventId: baseProps.eventId });
    });
  });

  describe('new RSVP', () => {
    it('renders the Join the gathering card when there is no existing RSVP', () => {
      render(<EventRsvpCard {...baseProps} existingRsvp={null} />);

      expect(screen.getByRole('heading', { name: /join the gathering/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /rsvp now/i })).toBeInTheDocument();
    });

    it('opens the sheet with default values when there is no existing RSVP', () => {
      render(<EventRsvpCard {...baseProps} existingRsvp={null} />);

      fireEvent.click(screen.getByRole('button', { name: /rsvp now/i }));

      expect(screen.getByRole('heading', { name: /who's coming/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /confirm 1 guest/i })).toBeInTheDocument();
    });
  });

  describe('not logged in', () => {
    it('renders the Sign in prompt instead of the sheet', () => {
      render(<EventRsvpCard {...baseProps} isLoggedIn={false} existingRsvp={null} />);

      expect(screen.getByRole('heading', { name: /join the gathering/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /rsvp now/i })).not.toBeInTheDocument();
    });
  });

  describe('past event', () => {
    it('renders the past event message when the event has passed', () => {
      render(<EventRsvpCard {...baseProps} isPast={true} existingRsvp={confirmedRsvp} />);

      expect(screen.getByText(/this gathering has passed/i)).toBeInTheDocument();
    });
  });
});
