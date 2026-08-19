import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EventSectionTabs } from '../EventSectionTabs';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => '/events/event-123',
  useSearchParams: () => new URLSearchParams(),
}));

describe('EventSectionTabs (FPP-154)', () => {
  it('renders every section as a stacked <section> with an anchor id', () => {
    render(
      <EventSectionTabs
        eventId="event-123"
        headerPanel={<div>Header Content</div>}
        itineraryItems={[]}
        additionalInfo="Some additional info"
        eventName="Test Event"
      />,
    );

    const overview = screen.getByRole('region', { name: 'Overview' });
    expect(overview).toBeInTheDocument();
    expect(overview).toHaveTextContent('Header Content');

    const itinerary = screen.getByRole('region', { name: 'Itinerary' });
    expect(itinerary).toBeInTheDocument();

    const additionalInfo = screen.getByRole('region', { name: 'Additional Info' });
    expect(additionalInfo).toBeInTheDocument();
  });

  it('anchors each section so direct deep-links via #hash work', () => {
    render(
      <EventSectionTabs
        eventId="event-123"
        headerPanel={<div>Header Content</div>}
        itineraryItems={[]}
        additionalInfo="Some additional info"
        eventName="Test Event"
      />,
    );

    expect(document.getElementById('event-section-header')).not.toBeNull();
    expect(document.getElementById('event-section-itinerary')).not.toBeNull();
    expect(document.getElementById('event-section-additional-info')).not.toBeNull();
  });

  it('shows the anchor nav with all section labels', () => {
    render(
      <EventSectionTabs
        eventId="event-123"
        headerPanel={<div>Header Content</div>}
        itineraryItems={[]}
        additionalInfo="Some additional info"
        eventName="Test Event"
      />,
    );

    const nav = screen.getByRole('navigation', { name: 'Jump to event section' });
    expect(nav).toBeInTheDocument();

    expect(screen.getByTestId('event-anchor-header')).toHaveAttribute(
      'href',
      '#event-section-header',
    );
    expect(screen.getByTestId('event-anchor-itinerary')).toHaveAttribute(
      'href',
      '#event-section-itinerary',
    );
    expect(screen.getByTestId('event-anchor-additional-info')).toHaveAttribute(
      'href',
      '#event-section-additional-info',
    );
  });

  it('does not render a Gallery tab or section (FPP-135)', () => {
    render(
      <EventSectionTabs
        eventId="event-123"
        headerPanel={<div>Header Content</div>}
        itineraryItems={[]}
        additionalInfo="Some additional info"
        eventName="Test Event"
      />,
    );

    expect(screen.queryByText('Gallery')).not.toBeInTheDocument();
    expect(screen.queryByTestId('event-anchor-gallery')).not.toBeInTheDocument();
  });

  // FPP-151: Who's coming section shows up only when at least one
  // household is in the publicAttendees prop. Empty/missing prop
  // means early-lifecycle events stay quiet.
  it('renders a "Who\'s coming" section with attendee details when publicAttendees is non-empty and the viewer is logged in', () => {
    render(
      <EventSectionTabs
        eventId="event-123"
        headerPanel={<div>Header Content</div>}
        itineraryItems={[]}
        additionalInfo="Some additional info"
        publicAttendees={[{ householdName: 'The Garcia Family', attendingFirstNames: ['Maria'] }]}
        eventName="Test Event"
        isLoggedIn={true}
      />,
    );

    expect(screen.getByRole('region', { name: /who.s coming/i })).toBeInTheDocument();
    expect(document.getElementById('event-section-attendees')).not.toBeNull();
    expect(screen.getByTestId('event-anchor-attendees')).toHaveAttribute(
      'href',
      '#event-section-attendees',
    );
    expect(screen.getByText('The Garcia Family')).toBeInTheDocument();
  });

  it('hides the "Who\'s coming" section when publicAttendees is empty', () => {
    render(
      <EventSectionTabs
        eventId="event-123"
        headerPanel={<div>Header Content</div>}
        itineraryItems={[]}
        additionalInfo="Some additional info"
        publicAttendees={[]}
        eventName="Test Event"
      />,
    );

    expect(screen.queryByRole('region', { name: /who.s coming/i })).not.toBeInTheDocument();
    expect(document.getElementById('event-section-attendees')).toBeNull();
    expect(screen.queryByTestId('event-anchor-attendees')).not.toBeInTheDocument();
  });

  it('hides the "Who\'s coming" section when publicAttendees is omitted', () => {
    render(
      <EventSectionTabs
        eventId="event-123"
        headerPanel={<div>Header Content</div>}
        itineraryItems={[]}
        additionalInfo="Some additional info"
        eventName="Test Event"
      />,
    );

    expect(document.getElementById('event-section-attendees')).toBeNull();
  });

  // Auth gate: anonymous viewers must NOT see household names /
  // member first names. The section still surfaces (the anchor
  // nav + region are present) but renders a SignInPrompt instead
  // of PublicAttendeeList so the data isn't silently absent.
  it('replaces the attendee list with a SignInPrompt when the viewer is logged out', () => {
    render(
      <EventSectionTabs
        eventId="event-123"
        headerPanel={<div>Header Content</div>}
        itineraryItems={[]}
        additionalInfo="Some additional info"
        publicAttendees={[
          { householdName: 'The Garcia Family', attendingFirstNames: ['Maria'] },
          { householdName: 'The Thompson Family', attendingFirstNames: ['Lisa', 'Bob'] },
        ]}
        eventName="Test Event"
        isLoggedIn={false}
      />,
    );

    // The section + anchor entry stay visible so logged-out
    // guests can discover what's behind the gate.
    expect(screen.getByRole('region', { name: /who.s coming/i })).toBeInTheDocument();
    expect(document.getElementById('event-section-attendees')).not.toBeNull();
    expect(screen.getByTestId('event-anchor-attendees')).toHaveAttribute(
      'href',
      '#event-section-attendees',
    );

    // Personal data is hidden — household names + first names
    // must NOT appear.
    expect(screen.queryByText('The Garcia Family')).not.toBeInTheDocument();
    expect(screen.queryByText('The Thompson Family')).not.toBeInTheDocument();
    expect(screen.queryByText('Maria')).not.toBeInTheDocument();
    expect(screen.queryByText('Lisa')).not.toBeInTheDocument();
    expect(screen.queryByText('Bob')).not.toBeInTheDocument();
    expect(screen.queryByTestId('public-attendee-table')).not.toBeInTheDocument();

    // The SignInPrompt takes its place with a sign-in link.
    expect(
      screen.getByRole('heading', { name: /who.s coming is just for family/i }),
    ).toBeInTheDocument();
    const signInLink = screen.getByRole('link', { name: /sign in/i });
    expect(signInLink).toHaveAttribute('href', '/login');
  });

  it('still hides the attendee section when publicAttendees is empty AND the viewer is logged out', () => {
    // When there are no RSVPs yet the section should stay quiet
    // even for anonymous viewers — early-lifecycle events do not
    // need a "sign in to see no one" prompt.
    render(
      <EventSectionTabs
        eventId="event-123"
        headerPanel={<div>Header Content</div>}
        itineraryItems={[]}
        additionalInfo="Some additional info"
        publicAttendees={[]}
        eventName="Test Event"
        isLoggedIn={false}
      />,
    );

    expect(document.getElementById('event-section-attendees')).toBeNull();
    expect(
      screen.queryByRole('heading', { name: /who.s coming is just for family/i }),
    ).not.toBeInTheDocument();
  });

  it('defaults to treating the viewer as logged out when isLoggedIn is omitted', () => {
    // Defensive default — callers that haven't been updated yet
    // should still gate personal data behind the prompt.
    render(
      <EventSectionTabs
        eventId="event-123"
        headerPanel={<div>Header Content</div>}
        itineraryItems={[]}
        additionalInfo="Some additional info"
        publicAttendees={[{ householdName: 'The Garcia Family', attendingFirstNames: ['Maria'] }]}
        eventName="Test Event"
      />,
    );

    expect(screen.queryByText('The Garcia Family')).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /who.s coming is just for family/i }),
    ).toBeInTheDocument();
  });
});
