import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { EventItinerarySection } from '../EventItinerarySection';

/**
 * FPP-4 / QUB-31.3 — render itinerary items on the public event page
 * Itinerary tab. The component is a presentational list that consumes
 * the pre-ordered rows from `src/app/events/[id]/page.tsx` and
 * surfaces them to guests. These tests lock in the two acceptance
 * criteria:
 *
 *   1. Itinerary renders in the event page Itinerary tab (QUB-30.3).
 *      → Component renders an "Itinerary" heading and surfaces each
 *        item's time / title / description. Empty state covers the
 *        case where the host has not added any rows yet.
 *
 *   2. Items shown in stored order.
 *      → The component renders rows in array order. The page-level
 *        query (`orderBy: [{ order: 'asc' }, { time: 'asc' }]`) is
 *        responsible for sorting; this component's contract is
 *        "render in the order I'm given". The test passes a list
 *        with gaps and non-sorted `order` values to confirm the
 *        component does not re-sort.
 */
describe('EventItinerarySection (FPP-4 / QUB-31.3)', () => {
  it('renders the Itinerary heading so guests can identify the tab', () => {
    render(<EventItinerarySection items={[]} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Itinerary' })).toBeInTheDocument();
  });

  it('falls back to a friendly empty state when the host has not added rows', () => {
    render(<EventItinerarySection items={[]} />);
    expect(screen.getByText('The schedule is still being planned')).toBeInTheDocument();
    // The empty-state branch swaps the <ol> for an EmptyState card,
    // so the list container is intentionally absent. Just confirm no
    // row was rendered.
    expect(screen.queryByTestId('event-itinerary-list')).not.toBeInTheDocument();
    expect(screen.queryAllByTestId('event-itinerary-item')).toHaveLength(0);
  });

  it('renders a single item with time, title, and description', () => {
    render(
      <EventItinerarySection
        items={[
          {
            id: 'i-1',
            time: '10:00 AM',
            title: 'Doors open',
            description: 'Coffee and pastries in the lobby.',
          },
        ]}
      />,
    );

    const list = screen.getByTestId('event-itinerary-list');
    const items = within(list).getAllByTestId('event-itinerary-item');
    expect(items).toHaveLength(1);

    expect(
      within(items[0]!).getByRole('heading', { level: 3, name: 'Doors open' }),
    ).toBeInTheDocument();
    expect(within(items[0]!).getByText('Coffee and pastries in the lobby.')).toBeInTheDocument();
    // 10:00 AM should split into a numeric portion ("10:00") and the
    // meridian badge ("AM").
    expect(within(items[0]!).getByText('10:00')).toBeInTheDocument();
    expect(within(items[0]!).getByText('AM')).toBeInTheDocument();
  });

  it('hides the description paragraph when the description is null', () => {
    render(
      <EventItinerarySection
        items={[{ id: 'i-1', time: '12:00 PM', title: 'Lunch', description: null }]}
      />,
    );
    const item = screen.getByTestId('event-itinerary-item');
    expect(within(item).getByRole('heading', { level: 3, name: 'Lunch' })).toBeInTheDocument();
    // No <p> inside the row body for the description — only the title heading.
    expect(item.querySelector('p')).toBeNull();
  });

  it('shows a "Soon" badge when the item has no wall-clock time', () => {
    render(
      <EventItinerarySection
        items={[{ id: 'i-1', time: null, title: 'Surprise guest', description: null }]}
      />,
    );
    const item = screen.getByTestId('event-itinerary-item');
    expect(within(item).getByText('Soon')).toBeInTheDocument();
    // No time badge components (no "AM" / "PM" badge text).
    expect(within(item).queryByText('AM')).not.toBeInTheDocument();
    expect(within(item).queryByText('PM')).not.toBeInTheDocument();
  });

  it('renders items in the order provided (FPP-4 acceptance: stored order)', () => {
    // The page-level query sorts by `(order asc, time asc)`; this
    // component does NOT re-sort. The test passes a list whose array
    // index is intentionally not sorted by `order` to prove the
    // component trusts its input. If a future refactor adds a sort
    // here, this test will fail and force the author to either keep
    // the contract or update it deliberately.
    const items = [
      { id: 'i-3', time: '2:00 PM', title: 'Third', description: null, order: 2 },
      { id: 'i-1', time: '10:00 AM', title: 'First', description: null, order: 0 },
      { id: 'i-2', time: '12:00 PM', title: 'Second', description: null, order: 1 },
    ];

    render(<EventItinerarySection items={items} />);

    const rendered = screen.getAllByTestId('event-itinerary-item');
    expect(rendered).toHaveLength(3);
    expect(within(rendered[0]!).getByText('Third')).toBeInTheDocument();
    expect(within(rendered[1]!).getByText('First')).toBeInTheDocument();
    expect(within(rendered[2]!).getByText('Second')).toBeInTheDocument();
  });

  it('renders the description for every row independently', () => {
    render(
      <EventItinerarySection
        items={[
          { id: 'i-1', time: '10:00 AM', title: 'Setup', description: 'Bring coolers.' },
          { id: 'i-2', time: '11:00 AM', title: 'Games', description: 'Capture the flag.' },
        ]}
      />,
    );

    const rendered = screen.getAllByTestId('event-itinerary-item');
    expect(within(rendered[0]!).getByText('Bring coolers.')).toBeInTheDocument();
    expect(within(rendered[1]!).getByText('Capture the flag.')).toBeInTheDocument();
  });
});
