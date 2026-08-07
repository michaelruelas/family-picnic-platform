import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { ToastProvider } from '~/components/ui/Toast';

const mockAddToast = vi.fn();
let mockListChargesData: unknown = undefined;
let mockListChargesError: Error | null = null;
const mockRefetch = vi.fn();
const mockResendMutate = vi.fn();
let mockResendResult: { success: boolean; error?: string } | null = { success: true };

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/charges',
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

vi.mock('~/lib/trpc-client', () => ({
  trpc: {
    admin: {
      listCharges: {
        useQuery: () => ({
          data: mockListChargesData,
          error: mockListChargesError,
          isFetching: false,
          refetch: mockRefetch,
        }),
      },
      resendReceipt: {
        useMutation: (opts: {
          onSuccess?: (r: unknown) => void;
          onError?: (e: Error) => void;
        }) => ({
          mutate: (input: unknown) => {
            mockResendMutate(input);
            if (mockResendResult) opts.onSuccess?.(mockResendResult);
            else if (opts.onError) opts.onError(new Error('mutate failed'));
          },
          isPending: false,
        }),
      },
    },
  },
}));

const { default: ChargesTable } = await import('../ChargesTable');
import type { AdminChargeRow } from '../ChargesTable';

const nowIso = (d: string) => new Date(d).toISOString();

function makeCharge(overrides: Partial<AdminChargeRow> = {}): AdminChargeRow {
  return {
    id: 'c1',
    registrationId: 'r1',
    stripePaymentIntentId: 'pi_1',
    amountCents: 5000,
    currency: 'usd',
    status: 'SUCCEEDED' as AdminChargeRow['status'],
    receiptUrl: null,
    receiptSentAt: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    createdAt: nowIso('2026-08-01T10:00:00Z'),
    updatedAt: nowIso('2026-08-01T10:00:00Z'),
    registration: {
      id: 'r1',
      status: 'PAID' as AdminChargeRow['registration']['status'],
      refundedCents: 0,
      createdAt: nowIso('2026-08-01T10:00:00Z'),
      updatedAt: nowIso('2026-08-01T10:00:00Z'),
      user: { id: 'u1', name: 'Alice', email: 'alice@example.com' },
      event: { id: 'e1', name: 'Folia Picnic', date: nowIso('2026-09-12T17:00:00Z') },
    },
    refunds: [],
    ...overrides,
  };
}

function renderWithToast(ui: React.ReactNode) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

const events = [
  {
    id: 'e1',
    name: 'Folia Picnic',
    date: nowIso('2026-09-12T17:00:00Z'),
    registrationFeeCents: 5000,
  },
];

beforeEach(() => {
  mockAddToast.mockReset();
  mockRefetch.mockReset();
  mockResendMutate.mockReset();
  mockListChargesData = undefined;
  mockListChargesError = null;
  mockResendResult = { success: true };
});

describe('ChargesTable', () => {
  it('sorts the Event column by event name (alphabetical), not by registration object', () => {
    const c1 = makeCharge({
      id: 'c1',
      registration: {
        ...makeCharge().registration,
        event: { id: 'e1', name: 'Zephyr', date: nowIso('2026-09-12T17:00:00Z') },
      },
    });
    const c2 = makeCharge({
      id: 'c2',
      registration: {
        ...makeCharge().registration,
        event: { id: 'e2', name: 'Aurora', date: nowIso('2026-09-12T17:00:00Z') },
      },
    });
    const c3 = makeCharge({
      id: 'c3',
      registration: {
        ...makeCharge().registration,
        event: { id: 'e3', name: 'Marigold', date: nowIso('2026-09-12T17:00:00Z') },
      },
    });

    renderWithToast(<ChargesTable initialCharges={[c1, c2, c3]} events={events} />);

    const eventButton = screen.getByRole('button', { name: /sort by event/i });
    fireEvent.click(eventButton); // first click on a text column -> asc

    // The Event column is the 2nd column; the 1st is "When" (date).
    const bodyRows = screen.getAllByRole('row').slice(1);
    const eventCells = bodyRows.map((r) => r.querySelectorAll('td')[1]?.textContent ?? '');
    expect(eventCells[0]).toContain('Aurora');
    expect(eventCells[1]).toContain('Marigold');
    expect(eventCells[2]).toContain('Zephyr');
  });

  it('toasts an error when the refetch rejects', async () => {
    const initial = [makeCharge()];
    renderWithToast(<ChargesTable initialCharges={initial} events={events} />);

    mockRefetch.mockRejectedValueOnce(new Error('network down'));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /apply filter/i }));
    });

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('error', expect.stringMatching(/network down/i));
    });
  });

  it('does not update charges state when the refetch returns no data', async () => {
    const initial = [makeCharge({ id: 'original', amountCents: 7777 })];
    renderWithToast(<ChargesTable initialCharges={initial} events={events} />);
    // The original amount is rendered as $77.77; assert it's visible.
    expect(screen.getByText('$77.77')).toBeInTheDocument();

    mockRefetch.mockResolvedValueOnce({ data: undefined, error: null });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /apply filter/i }));
    });

    // The original row should still be visible; no new row appeared.
    expect(screen.getByText('$77.77')).toBeInTheDocument();
  });
});
