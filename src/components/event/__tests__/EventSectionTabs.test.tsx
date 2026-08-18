import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EventSectionTabs } from '../EventSectionTabs';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => '/events/event-123',
  useSearchParams: () => new URLSearchParams(),
}));

describe('EventSectionTabs (FPP-135)', () => {
  it('renders Overview, Itinerary, and Additional Info tabs without Gallery tab', () => {
    render(
      <EventSectionTabs
        eventId="event-123"
        initialTab="header"
        headerPanel={<div>Header Content</div>}
        itineraryItems={[]}
        additionalInfo="Some additional info"
        photos={[]}
        eventName="Test Event"
      />,
    );

    expect(screen.getByRole('tab', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Itinerary' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Additional Info' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Gallery' })).not.toBeInTheDocument();
  });
});
