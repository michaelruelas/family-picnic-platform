import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';

const mockPush = vi.fn();
const mockRefresh = vi.fn();
const mockAddToast = vi.fn();
const fetchMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh, replace: vi.fn() }),
  usePathname: () => '/admin/events',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('~/components/ui/Toast', () => ({
  useToast: () => ({ addToast: mockAddToast, removeToast: vi.fn(), toasts: [] }),
}));

vi.stubGlobal('fetch', fetchMock);

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
    // FPP-68: future events are not archived.
    archivedAt: null,
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
    // FPP-68: archived legacy event surfaces here with the archive
    // timestamp so the "Archived on" column renders it.
    archivedAt: '2025-06-15T12:00:00.000Z',
  },
];

describe('EventsTable', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockRefresh.mockReset();
    mockAddToast.mockReset();
    fetchMock.mockReset();
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

  it('FPP-68: archive button hits /api/admin/events/[id]/archive and refreshes on success', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response);
    render(<EventsTable initialEvents={events} />);

    // e2 (past-dated) gets the Archive button on the active table.
    const archiveButtons = screen.getAllByRole('button', { name: /^archive$/i });
    fireEvent.click(archiveButtons[0]!);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/admin/events/e2/archive', {
        method: 'POST',
      });
      expect(mockRefresh).toHaveBeenCalled();
      expect(mockAddToast).not.toHaveBeenCalled();
    });
  });

  it('FPP-68: archive button surfaces an error toast on a 500 response', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Internal server error' }),
    } as unknown as Response);
    render(<EventsTable initialEvents={events} />);

    const archiveButtons = screen.getAllByRole('button', { name: /^archive$/i });
    fireEvent.click(archiveButtons[0]!);

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('error', 'Internal server error');
      expect(mockRefresh).not.toHaveBeenCalled();
    });
  });

  it('FPP-68: archive button uses a generic toast when the body is not JSON', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => {
        throw new Error('parse error');
      },
    } as unknown as Response);
    render(<EventsTable initialEvents={events} />);

    const archiveButtons = screen.getAllByRole('button', { name: /^archive$/i });
    fireEvent.click(archiveButtons[0]!);

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('error', 'Could not archive the event');
    });
  });

  it('FPP-68: archive button surfaces a network error toast on fetch rejection', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    render(<EventsTable initialEvents={events} />);

    const archiveButtons = screen.getAllByRole('button', { name: /^archive$/i });
    fireEvent.click(archiveButtons[0]!);

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('error', 'offline');
    });
  });

  it('FPP-68: past table renders Restore buttons and refreshes on success', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response);
    render(<EventsTable initialEvents={events} mode="past" />);

    const restoreButtons = screen.getAllByRole('button', { name: /^restore$/i });
    expect(restoreButtons.length).toBeGreaterThan(0);
    fireEvent.click(restoreButtons[0]!);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/admin/events/e1/unarchive', {
        method: 'POST',
      });
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it('FPP-68: restore button surfaces an error toast on a non-ok response', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Forbidden' }),
    } as unknown as Response);
    render(<EventsTable initialEvents={events} mode="past" />);

    const restoreButtons = screen.getAllByRole('button', { name: /^restore$/i });
    fireEvent.click(restoreButtons[0]!);

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('error', 'Forbidden');
      expect(mockRefresh).not.toHaveBeenCalled();
    });
  });
});
