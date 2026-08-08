import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/events',
  useSearchParams: () => new URLSearchParams(),
}));

const { default: EventsTable } = await import('../EventsTable');

const events = [
  {
    id: 'e1',
    name: 'Folia Picnic',
    date: '2026-09-12T17:00:00.000Z',
    status: 'PUBLISHED' as const,
    location: 'Golden Gate Park',
    rsvpCount: 24,
    potluckSlotCount: 6,
    maxCapacity: 100,
    rsvpDeadline: '2026-08-25T17:00:00.000Z',
  },
  {
    id: 'e2',
    name: 'Aurora Reunion',
    date: '2025-06-01T17:00:00.000Z',
    status: 'DRAFT' as const,
    location: 'Lake Merritt',
    rsvpCount: 3,
    potluckSlotCount: 0,
    maxCapacity: null,
    rsvpDeadline: null,
  },
];

describe('EventsTable', () => {
  beforeEach(() => {
    mockPush.mockReset();
  });

  it('renders one row per event with name + status', () => {
    render(<EventsTable initialEvents={events} />);
    expect(screen.getByText('Folia Picnic')).toBeInTheDocument();
    expect(screen.getByText('Aurora Reunion')).toBeInTheDocument();
    // Both events show their statuses via EventStatusBadge.
    expect(screen.getByText('Published')).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('renders an Edit button per row linking to /admin/events/[id]/edit', () => {
    render(<EventsTable initialEvents={events} />);
    const links = screen.getAllByRole('link', { name: /edit/i });
    const hrefs = links.map((l) => l.getAttribute('href')).filter(Boolean);
    expect(hrefs).toContain('/admin/events/e1/edit');
    expect(hrefs).toContain('/admin/events/e2/edit');
  });

  it('renders the empty state when no events are provided', () => {
    render(<EventsTable initialEvents={[]} />);
    expect(screen.getByRole('heading', { name: /no events yet/i })).toBeInTheDocument();
  });

  it('sorts the Name column alphabetically on click', () => {
    render(<EventsTable initialEvents={events} />);
    const nameButton = screen.getByRole('button', { name: /sort by name/i });
    fireEvent.click(nameButton);
    const rows = screen.getAllByRole('row').slice(1); // skip header
    expect(within(rows[0]!).getByText('Aurora Reunion')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('Folia Picnic')).toBeInTheDocument();
  });
});
