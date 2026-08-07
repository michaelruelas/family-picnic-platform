import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { ToastProvider } from '~/components/ui/Toast';

const mockAddToast = vi.fn();

// The mock holds its own state so re-renders after external state changes
// (like setting `mockError` after the click) pick up the new value.
let mockError: Error | null = null;
let mockIsFetching = false;
let refetchResolve: (() => void) | null = null;
const mockRefetch = vi.fn(() => {
  mockIsFetching = true;
  // Wait for the test to call `setError` and then resolve this.
  return new Promise<{ data: undefined; error: Error | null }>((resolve) => {
    refetchResolve = () => {
      mockIsFetching = false;
      resolve({ data: undefined, error: mockError });
    };
  });
});

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

vi.mock('~/lib/trpc-client', () => {
  // Inner component wrapper that subscribes to mock state so re-renders
  // pick up updates when the test mutates the mock between events.
  return {
    trpc: {
      admin: {
        auditLog: {
          useQuery: () => {
            const [, setTick] = useState(0);
            (globalThis as unknown as { __bumpAuditLog?: () => void }).__bumpAuditLog = () =>
              setTick((t) => t + 1);
            return {
              data: undefined,
              error: mockError,
              isFetching: mockIsFetching,
              refetch: mockRefetch,
            };
          },
        },
      },
    },
  };
});

const bumpAuditLog = () =>
  (globalThis as unknown as { __bumpAuditLog?: () => void }).__bumpAuditLog?.();

const { default: AuditLogTable } = await import('../AuditLogTable');
import type { AuditLogEntryView } from '~/lib/schemas/audit';

// FPP-50 review: the merged audit-log table now consumes
// `AuditLogEntryView[]` (which tags each row with `source: 'admin' |
// 'domain'` and may carry `subjectType`/`subjectId`/`payload`
// instead of `oldValue`/`newValue`). These tests only assert shell
// behaviour (mount, error toast, filter button), so a minimal
// admin entry is enough.
function makeLog(overrides: Partial<AuditLogEntryView> = {}): AuditLogEntryView {
  return {
    id: 'l1',
    source: 'admin',
    action: 'event.create',
    occurredAt: new Date('2026-08-01T10:00:00Z').toISOString(),
    actor: { id: 'u1', name: 'Admin', email: 'admin@example.com' },
    ...overrides,
  };
}

function renderWithToast(ui: React.ReactNode) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

beforeEach(() => {
  mockAddToast.mockReset();
  mockRefetch.mockClear();
  mockError = null;
  mockIsFetching = false;
  refetchResolve = null;
});

describe('AuditLogTable (tRPC)', () => {
  it('renders the initial data on mount without a refetch', () => {
    renderWithToast(
      <AuditLogTable initialLogs={[makeLog({ action: 'event.create' })]} events={[]} users={[]} />,
    );
    expect(screen.getByText('event.create')).toBeInTheDocument();
    expect(mockRefetch).not.toHaveBeenCalled();
  });

  it('toasts an error when the query resolves with an error', async () => {
    renderWithToast(<AuditLogTable initialLogs={[makeLog()]} events={[]} users={[]} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /filter/i }));
    });

    // Set the error while the refetch is in flight, then re-render and
    // resolve the refetch; the consumer's useEffect toasts on the transition
    // from `isFetching: true, error: "..."` to `isFetching: false, error: "..."`.
    mockError = new Error('server down');
    act(() => {
      bumpAuditLog();
    });
    await act(async () => {
      refetchResolve?.();
      bumpAuditLog();
    });

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('error', expect.stringMatching(/server down/i));
    });
  });

  it('shows the loading state on the Filter button while a refetch is in flight', async () => {
    renderWithToast(<AuditLogTable initialLogs={[makeLog()]} events={[]} users={[]} />);
    mockIsFetching = true;
    act(() => {
      bumpAuditLog();
    });

    const btn = screen.getByRole('button', { name: /loading/i });
    expect(btn).toBeDisabled();
  });

  it('calls refetch when the Filter button is clicked', async () => {
    renderWithToast(<AuditLogTable initialLogs={[makeLog()]} events={[]} users={[]} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /filter/i }));
    });
    expect(mockRefetch).toHaveBeenCalled();
  });
});
