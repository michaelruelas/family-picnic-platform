import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EventHeaderSection } from '../EventHeaderSection';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/events/evt-1',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('~/hooks', () => ({
  useRsvpMutation: () => ({
    confirm: { mutateAsync: vi.fn(), isPending: false },
    decline: { mutateAsync: vi.fn(), isPending: false },
  }),
}));

// FPP-144 helper: build a potluck slot array with `count` fake signups
// so the dishes-claimed aggregation can be exercised deterministically.
function makePotluckSlots(count: number) {
  return [
    {
      id: 'slot-1',
      category: 'MAIN',
      signups: Array.from({ length: count }, (_, i) => ({
        id: `signup-${i}`,
        dishName: `Dish ${i}`,
        servings: 4,
        rsvp: { user: { name: `User ${i}`, household: null } },
      })),
    },
  ];
}

describe('EventHeaderSection (FPP-140 / FPP-139)', () => {
  const baseProps = {
    eventId: 'evt-1',
    eventName: 'Annual Folia Family Picnic',
    eventDescription: 'Welcome to our annual gathering!',
    eventDate: new Date('2026-08-15T10:30:00.000Z'),
    eventLocation: 'Golden Gate Park, San Francisco, CA',
    eventLat: null,
    eventLng: null,
    isPast: false,
    isLoggedIn: false,
    rsvpDeadline: null,
    maxCapacity: 100,
    currentAttending: 42,
    registrationFeeCents: 0,
    registrationFeeMinAge: 0,
    currency: 'usd',
    potluckSlots: [],
    existingRsvp: null,
    userRsvpStatus: null,
    hosts: [
      {
        id: 'user-host',
        name: 'Maria Garcia',
        email: 'maria@example.com',
        phoneNumber: '555-1234',
      },
    ],
    attachments: [],
  };

  it('consolidates date, time, and location prominently under event title (FPP-140)', () => {
    render(<EventHeaderSection {...baseProps} />);
    expect(
      screen.getByRole('heading', { level: 2, name: 'Annual Folia Family Picnic' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Golden Gate Park, San Francisco, CA/)).toBeInTheDocument();
    expect(screen.getByText('42 people attending')).toBeInTheDocument();
  });

  // FPP-144: attendees count now lives directly under the date/time/
  // location strip, grouping the at-a-glance engagement signals
  // with the event main details (not buried below the RSVP card).
  it('renders the meta strip as a sibling of the main details strip', () => {
    render(<EventHeaderSection {...baseProps} />);
    const meta = screen.getByTestId('event-meta-strip');
    expect(meta).toBeInTheDocument();
    expect(screen.getByText('42 people attending')).toBeInTheDocument();
  });

  // FPP-144: RSVP deadline joins attendees + dishes in the
  // secondary strip under the main details.
  it('surfaces the RSVP deadline in the secondary strip when in the future', () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days out
    render(
      <EventHeaderSection
        {...baseProps}
        rsvpDeadline={future}
        potluckSlots={makePotluckSlots(2)}
      />,
    );
    const deadlineNode = screen.getByTestId('event-meta-rsvp-deadline');
    expect(deadlineNode).toBeInTheDocument();
    expect(deadlineNode).toHaveTextContent(/RSVP by /);
  });

  it('hides the RSVP deadline when it has passed', () => {
    const past = new Date(Date.now() - 1000 * 60 * 60 * 24);
    render(<EventHeaderSection {...baseProps} rsvpDeadline={past} />);
    expect(screen.queryByTestId('event-meta-rsvp-deadline')).not.toBeInTheDocument();
  });

  it('hides the entire meta strip when nothing meaningful to show', () => {
    render(
      <EventHeaderSection
        {...baseProps}
        currentAttending={0}
        potluckSlots={[]}
        rsvpDeadline={null}
      />,
    );
    expect(screen.queryByTestId('event-meta-strip')).not.toBeInTheDocument();
  });

  it('uses "person" for a single attendee (FPP-144 pluralization)', () => {
    render(<EventHeaderSection {...baseProps} currentAttending={1} />);
    expect(screen.getByText('1 person attending')).toBeInTheDocument();
  });

  it('does not render potluck slider preview carousel on Overview tab (FPP-139)', () => {
    render(<EventHeaderSection {...baseProps} />);
    expect(screen.queryByTestId('event-detail-potluck-cta')).not.toBeInTheDocument();
    expect(screen.queryByText(/The menu is still being planned/i)).not.toBeInTheDocument();
  });

  it('renders host block when hosts are provided', () => {
    render(<EventHeaderSection {...baseProps} />);
    expect(screen.getByTestId('host-contact-block')).toBeInTheDocument();
    expect(screen.getByText('Hosted by Maria Garcia')).toBeInTheDocument();
  });

  it('renders host note HTML from the editor with rich formatting', () => {
    const html = '<p>Welcome! <strong>Bold note</strong></p><h2>Heading</h2><ul><li>One</li></ul>';
    render(<EventHeaderSection {...baseProps} eventDescription={html} />);
    const note = screen.getByTestId('host-note');
    expect(note.querySelector('strong')?.textContent).toBe('Bold note');
    expect(note.querySelector('h2')?.textContent).toBe('Heading');
    expect(note.querySelectorAll('li').length).toBe(1);
  });

  it('preserves line breaks for plain-text descriptions (legacy data)', () => {
    const legacy = 'Line one.\nLine two.\n\nNew paragraph.';
    render(<EventHeaderSection {...baseProps} eventDescription={legacy} />);
    const note = screen.getByTestId('host-note');
    expect(note.innerHTML).toContain('Line one.');
    expect(note.querySelectorAll('br').length).toBeGreaterThan(0);
  });

  it('strips script tags and dangerous attributes from the host note', () => {
    const hostile =
      '<p>Hi <script>alert(1)</script></p><p><a href="javascript:alert(1)">click</a></p>';
    render(<EventHeaderSection {...baseProps} eventDescription={hostile} />);
    const note = screen.getByTestId('host-note');
    expect(note.querySelector('script')).toBeNull();
    expect(note.querySelector('a')?.getAttribute('href')).toBeNull();
  });

  // The public event page no longer surfaces the Google Places
  // resolved address below the host's custom title — the custom
  // title is the only location line guests see in the header
  // strip. The map's iframe + visible label still use the
  // resolved address so directions remain accurate.
  describe('location display', () => {
    it('shows only the custom title even when the resolved address differs', () => {
      render(
        <EventHeaderSection
          {...baseProps}
          eventLocation="Shaver Lake - Camp Edison Tannenager Site"
          eventResolvedLocation="Shaver Lake, Shaver Lake, CA 93664, USA"
        />,
      );
      expect(screen.getByText('Shaver Lake - Camp Edison Tannenager Site')).toBeInTheDocument();
      expect(screen.queryByTestId('event-location-resolved-subline')).not.toBeInTheDocument();
      expect(screen.queryByText('Shaver Lake, Shaver Lake, CA 93664, USA')).not.toBeInTheDocument();
    });

    it('shows only the custom title when the resolved address matches', () => {
      render(
        <EventHeaderSection
          {...baseProps}
          eventLocation="Central Park"
          eventResolvedLocation="Central Park"
        />,
      );
      expect(screen.getByText('Central Park')).toBeInTheDocument();
      expect(screen.queryByTestId('event-location-resolved-subline')).not.toBeInTheDocument();
    });

    it('shows only the custom title when no resolved address was passed', () => {
      render(
        <EventHeaderSection
          {...baseProps}
          eventLocation="Custom Title Only"
          eventResolvedLocation=""
        />,
      );
      expect(screen.getByText('Custom Title Only')).toBeInTheDocument();
      expect(screen.queryByTestId('event-location-resolved-subline')).not.toBeInTheDocument();
    });

    it('falls back to the resolved address as the single line when no custom title was provided', () => {
      render(
        <EventHeaderSection
          {...baseProps}
          eventLocation="Central Park, NY"
          eventResolvedLocation="Central Park, NY"
        />,
      );
      expect(screen.getByText('Central Park, NY')).toBeInTheDocument();
      expect(screen.queryByTestId('event-location-resolved-subline')).not.toBeInTheDocument();
    });
  });
});
