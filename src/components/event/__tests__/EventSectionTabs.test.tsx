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
  it('renders a "Who\'s coming" section when publicAttendees is non-empty', () => {
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
});
