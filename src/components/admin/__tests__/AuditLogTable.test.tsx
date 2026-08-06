import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { ToastProvider } from '~/components/ui/Toast';

const mockAddToast = vi.fn();
let mockFetchResponse: { ok: boolean; status: number; json: () => Promise<unknown> } | null = null;

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/audit-log',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('~/components/ui/Toast', async () => {
  const actual =
    await vi.importActual<typeof import('~/components/ui/Toast')>('~/components/ui/Toast');
  return {
    ...actual,
    useToast: () => ({ addToast: mockAddToast, removeToast: vi.fn(), toasts: [] }),
  };
});

const originalFetch = global.fetch;
beforeEach(() => {
  mockAddToast.mockReset();
  mockFetchResponse = null;
  if (mockFetchResponse) {
    global.fetch = vi.fn(() => Promise.resolve(mockFetchResponse)) as unknown as typeof fetch;
  } else {
    global.fetch = vi.fn(() =>
      Promise.reject(new Error('fetch not configured')),
    ) as unknown as typeof fetch;
  }
});
afterEach(() => {
  global.fetch = originalFetch;
});

const { default: AuditLogTable } = await import('../AuditLogTable');
import type { AdminAuditLog, Event, User } from '~/lib/generated/client';

type Log = AdminAuditLog & {
  user: Pick<User, 'id' | 'name' | 'email'>;
  event: Pick<Event, 'id' | 'name'> | null;
};

function makeLog(overrides: Partial<Log> = {}): Log {
  return {
    id: 'l1',
    action: 'event.create',
    oldValue: null,
    newValue: null,
    eventId: null,
    userId: 'u1',
    createdAt: new Date('2026-08-01T10:00:00Z'),
    user: { id: 'u1', name: 'Admin', email: 'admin@example.com' },
    event: null,
    ...overrides,
  } as unknown as Log;
}

function renderWithToast(ui: React.ReactNode) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

describe('AuditLogTable', () => {
  it('toasts an error when the server returns a non-2xx status', async () => {
    const fetchSpy = vi.fn(() =>
      Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) }),
    );
    global.fetch = fetchSpy as unknown as typeof fetch;

    renderWithToast(<AuditLogTable initialLogs={[makeLog()]} events={[]} users={[]} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /filter/i }));
    });

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('error', expect.stringMatching(/500/));
    });
  });

  it('toasts an error when the network request throws', async () => {
    const fetchSpy = vi.fn(() => Promise.reject(new Error('network down')));
    global.fetch = fetchSpy as unknown as typeof fetch;

    renderWithToast(<AuditLogTable initialLogs={[makeLog()]} events={[]} users={[]} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /filter/i }));
    });

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('error', expect.stringMatching(/network down/i));
    });
  });

  it('updates the table when the server returns data', async () => {
    const newLog = makeLog({ id: 'l2', action: 'event.publish' });
    const fetchSpy = vi.fn(() =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([newLog]) }),
    );
    global.fetch = fetchSpy as unknown as typeof fetch;

    renderWithToast(
      <AuditLogTable
        initialLogs={[makeLog({ id: 'l1', action: 'event.create' })]}
        events={[]}
        users={[]}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /filter/i }));
    });

    await waitFor(() => {
      expect(screen.getByText('event.publish')).toBeInTheDocument();
    });
  });
});
