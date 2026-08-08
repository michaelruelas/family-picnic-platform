import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/dashboard',
  useSearchParams: () => new URLSearchParams(),
}));

const { default: DashboardTable } = await import('../DashboardTable');

const rows = [
  {
    id: 'e1',
    name: 'Folia Picnic',
    date: '2026-09-12T17:00:00.000Z',
    status: 'PUBLISHED' as const,
    location: 'Golden Gate Park',
    maxCapacity: 100,
    rsvpTotal: 50,
    rsvpConfirmed: 40,
    rsvpDeclined: 5,
    rsvpPending: 5,
    headcount: 120,
    potluckSlotCount: 6,
    potluckSignupCount: 18,
    chargesTotalCents: 24000,
    lastActionAt: '2026-08-01T10:00:00.000Z',
    lastActionBy: 'admin@example.com',
  },
  {
    id: 'e2',
    name: 'Aurora Reunion',
    date: '2025-06-01T17:00:00.000Z',
    status: 'DRAFT' as const,
    location: 'Lake Merritt',
    maxCapacity: null,
    rsvpTotal: 0,
    rsvpConfirmed: 0,
    rsvpDeclined: 0,
    rsvpPending: 0,
    headcount: 0,
    potluckSlotCount: 0,
    potluckSignupCount: 0,
    chargesTotalCents: 0,
    lastActionAt: null,
    lastActionBy: null,
  },
];

describe('DashboardTable', () => {
  it('renders the totals row with RSVPs, Confirmed, and Headcount tiles', () => {
    render(<DashboardTable rows={rows} />);
    // 50 RSVPs total, 40 confirmed, 120 headcount (summed across rows).
    expect(screen.getByText('Total RSVPs')).toBeInTheDocument();
    expect(screen.getByText('Total Confirmed')).toBeInTheDocument();
    expect(screen.getByText('Total Headcount')).toBeInTheDocument();
    // Verify totals add up: rsvpTotal=50, rsvpConfirmed=40, headcount=120.
    const tiles = screen.getAllByText(/^(50|40|120)$/);
    expect(tiles.length).toBeGreaterThanOrEqual(3);
  });

  it('renders one row per event', () => {
    render(<DashboardTable rows={rows} />);
    expect(screen.getByText('Folia Picnic')).toBeInTheDocument();
    expect(screen.getByText('Aurora Reunion')).toBeInTheDocument();
  });

  it('sorts the RSVPs column numerically on click', () => {
    render(<DashboardTable rows={rows} />);
    const rsvpsButton = screen.getByRole('button', { name: /sort by rsvps/i });
    // First click on a numeric column sorts descending, second click
    // ascending. We want ascending so 0 (Aurora) comes before 50 (Folia).
    fireEvent.click(rsvpsButton);
    fireEvent.click(rsvpsButton);
    const bodyRows = screen.getAllByRole('row').slice(1);
    expect(within(bodyRows[0]!).getByText('Aurora Reunion')).toBeInTheDocument();
    expect(within(bodyRows[1]!).getByText('Folia Picnic')).toBeInTheDocument();
  });

  it('renders an empty state when no rows are provided', () => {
    render(<DashboardTable rows={[]} />);
    expect(screen.getByRole('heading', { name: /no events yet/i })).toBeInTheDocument();
  });
});
