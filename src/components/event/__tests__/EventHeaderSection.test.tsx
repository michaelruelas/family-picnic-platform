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
    expect(screen.getByText('42 attending')).toBeInTheDocument();
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
});
