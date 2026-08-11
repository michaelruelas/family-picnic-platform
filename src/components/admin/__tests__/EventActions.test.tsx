import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockRefresh = vi.fn();
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh, replace: vi.fn() }),
  usePathname: () => '/admin/events',
  useSearchParams: () => new URLSearchParams(),
}));

const fetchMock = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 })));
vi.stubGlobal('fetch', fetchMock);

const { default: EventActions } = await import('../EventActions');

describe('EventActions', () => {
  beforeEach(() => {
    fetchMock.mockClear();
    mockRefresh.mockClear();
  });

  it('renders a Re-open button for a CLOSED event (FPP-70)', () => {
    render(<EventActions eventId="e1" status="CLOSED" />);
    expect(screen.getByRole('button', { name: 'Re-open RSVPs' })).toBeInTheDocument();
  });

  it('does not render a Re-open button for an open (PUBLISHED) event', () => {
    render(<EventActions eventId="e1" status="PUBLISHED" />);
    expect(screen.queryByRole('button', { name: 'Re-open RSVPs' })).not.toBeInTheDocument();
  });

  it('calls the reopen endpoint and refreshes when Re-open is clicked', async () => {
    render(<EventActions eventId="e1" status="CLOSED" />);
    fireEvent.click(screen.getByRole('button', { name: 'Re-open RSVPs' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/admin/events/e1/reopen', { method: 'POST' });
    });
    expect(mockRefresh).toHaveBeenCalled();
  });
});
