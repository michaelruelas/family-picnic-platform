'use client';

import { useMemo, useState } from 'react';
import type { ChargeStatus, RefundStatus, RegistrationStatus } from '~/lib/generated/enums';
import { trpc } from '~/lib/trpc-client';
import { formatAmount } from '~/lib/currency';
import RefundDialog from './RefundDialog';
import ForfeitDialog from './ForfeitDialog';
import { useToast } from '~/components/ui/Toast';
import DataTable, { type DataTableColumn } from '~/components/ui/DataTable';

type SerializedDate = string;

export interface AdminChargeRow {
  id: string;
  registrationId: string;
  stripePaymentIntentId: string;
  amountCents: number;
  currency: string;
  status: ChargeStatus;
  receiptUrl: string | null;
  receiptSentAt: SerializedDate | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdAt: SerializedDate;
  updatedAt: SerializedDate;
  registration: {
    id: string;
    status: RegistrationStatus;
    refundedCents: number;
    createdAt: SerializedDate;
    updatedAt: SerializedDate;
    user: { id: string; name: string; email: string };
    event: { id: string; name: string; date: SerializedDate };
  };
  refunds: Array<{
    id: string;
    amountCents: number;
    currency: string;
    status: RefundStatus;
    reason: string | null;
    createdAt: SerializedDate;
    updatedAt: SerializedDate;
    refundedBy: { id: string; name: string };
  }>;
}

interface EventLite {
  id: string;
  name: string;
  date: SerializedDate;
  registrationFeeCents: number | null;
}

function refundedCents(row: AdminChargeRow): number {
  return row.refunds
    .filter((r) => r.status === 'SUCCEEDED')
    .reduce((sum, r) => sum + r.amountCents, 0);
}

function balanceCents(row: AdminChargeRow): number {
  return row.amountCents - refundedCents(row);
}

interface ChargesTableProps {
  initialCharges: AdminChargeRow[];
  events: EventLite[];
}

export default function ChargesTable({ initialCharges, events }: ChargesTableProps) {
  const toast = useToast();
  const [charges, setCharges] = useState(initialCharges);
  const [eventId, setEventId] = useState('');
  const [statusFilter, setStatusFilter] = useState<ChargeStatus | ''>('');
  const [refundTarget, setRefundTarget] = useState<AdminChargeRow | null>(null);
  const [forfeitTarget, setForfeitTarget] = useState<AdminChargeRow | null>(null);

  const resendReceipt = trpc.admin.resendReceipt.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.addToast('success', 'Receipt re-sent');
      } else {
        toast.addToast('error', result.error);
      }
      void refresh();
    },
    onError: (err) => toast.addToast('error', err.message),
  });
  const resendReceiptPending = resendReceipt.isPending;

  const listCharges = trpc.admin.listCharges.useQuery(
    {
      ...(eventId ? { eventId } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
    },
    { enabled: false },
  );

  async function refresh() {
    const result = await listCharges.refetch();
    if (result.data) {
      setCharges(
        result.data.map((c) => ({
          ...c,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
          receiptSentAt: c.receiptSentAt?.toISOString() ?? null,
          registration: {
            ...c.registration,
            createdAt: c.registration.createdAt.toISOString(),
            updatedAt: c.registration.updatedAt.toISOString(),
            event: {
              ...c.registration.event,
              date: c.registration.event.date.toISOString(),
            },
          },
          refunds: c.refunds.map((r) => ({
            ...r,
            createdAt: r.createdAt.toISOString(),
            updatedAt: r.updatedAt.toISOString(),
          })),
        })),
      );
    }
  }

  const filtered = useMemo(() => {
    return charges.filter((c) => {
      if (eventId && c.registration.event.id !== eventId) return false;
      if (statusFilter && c.status !== statusFilter) return false;
      return true;
    });
  }, [charges, eventId, statusFilter]);

  const columns = useMemo<DataTableColumn<AdminChargeRow>[]>(
    () => [
      {
        id: 'when',
        header: 'When',
        accessorKey: 'createdAt',
        enableSorting: true,
        sortFn: 'datetime',
        cell: ({ value }) => (
          <span className="text-muted-foreground whitespace-nowrap">
            {new Date(String(value)).toLocaleString()}
          </span>
        ),
      },
      {
        id: 'event',
        header: 'Event',
        accessorKey: 'registration',
        enableSorting: true,
        cell: ({ row }) => (
          <div>
            <div className="text-foreground font-medium">{row.registration.event.name}</div>
            <div className="text-muted-foreground text-xs">
              {new Date(row.registration.event.date).toLocaleDateString()}
            </div>
          </div>
        ),
      },
      {
        id: 'attendee',
        header: 'Attendee',
        accessorKey: 'registration',
        cell: ({ row }) => (
          <div>
            <div className="text-foreground">{row.registration.user.name}</div>
            <div className="text-muted-foreground text-xs">{row.registration.user.email}</div>
          </div>
        ),
      },
      {
        id: 'amount',
        header: 'Amount',
        accessorKey: 'amountCents',
        enableSorting: true,
        sortFn: 'basic',
        align: 'right',
        cell: ({ row }) => (
          <div>
            <div className="text-foreground font-semibold">
              {formatAmount(row.amountCents, row.currency)}
            </div>
            {refundedCents(row) > 0 ? (
              <div className="text-muted-foreground text-xs">
                Refunded {formatAmount(refundedCents(row), row.currency)} · Balance{' '}
                {formatAmount(balanceCents(row), row.currency)}
              </div>
            ) : null}
          </div>
        ),
      },
      {
        id: 'chargeStatus',
        header: 'Charge status',
        accessorKey: 'status',
        enableSorting: true,
        cell: ({ row }) => (
          <div>
            <ChargeStatusBadge status={row.status} />
            {row.lastErrorMessage ? (
              <div className="text-destructive mt-1 text-xs">{row.lastErrorMessage}</div>
            ) : null}
          </div>
        ),
      },
      {
        id: 'registration',
        header: 'Registration',
        accessorKey: 'registration',
        cell: ({ row }) => (
          <div>
            <RegistrationStatusBadge status={row.registration.status} />
            {row.refunds.length > 0 ? (
              <details className="mt-1 text-xs">
                <summary className="text-terracotta cursor-pointer">
                  {row.refunds.length} refund{row.refunds.length === 1 ? '' : 's'}
                </summary>
                <ul className="text-muted-foreground mt-1 space-y-1">
                  {row.refunds.map((r) => (
                    <li key={r.id}>
                      {formatAmount(r.amountCents, r.currency)} · {r.status} · {r.refundedBy.name} ·{' '}
                      {new Date(r.createdAt).toLocaleDateString()}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        align: 'right',
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex justify-end gap-2">
            {row.status === 'SUCCEEDED' && balanceCents(row) > 0 ? (
              <button
                type="button"
                onClick={() => setRefundTarget(row)}
                className="bg-terracotta hover:bg-terracotta rounded-lg px-3 py-1.5 text-xs font-medium text-white"
              >
                Refund
              </button>
            ) : null}
            {row.status === 'SUCCEEDED' && row.registration.status === 'PAID' ? (
              <button
                type="button"
                onClick={() => setForfeitTarget(row)}
                className="bg-secondary text-foreground/85 rounded-lg px-3 py-1.5 text-xs font-medium"
              >
                Forfeit
              </button>
            ) : null}
            {row.status === 'SUCCEEDED' && !row.receiptSentAt ? (
              <button
                type="button"
                onClick={() => resendReceipt.mutate({ chargeId: row.id })}
                disabled={resendReceiptPending}
                className="bg-secondary text-foreground/85 rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50"
              >
                {resendReceiptPending ? 'Sending…' : 'Resend receipt'}
              </button>
            ) : null}
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resendReceiptPending],
  );

  return (
    <div className="space-y-4">
      <DataTable
        columns={columns}
        data={filtered}
        rowKey="id"
        pageSize={50}
        emptyState={{
          title: 'No charges match the current filters.',
          description: 'Try changing the event or status filter.',
          icon: 'search',
        }}
        toolbar={
          <>
            <div>
              <label className="text-muted-foreground block text-sm font-medium">Event</label>
              <select
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                className="border-border mt-1 rounded-lg border px-3 py-2 text-sm"
              >
                <option value="">All events</option>
                {events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-muted-foreground block text-sm font-medium">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as ChargeStatus | '')}
                className="border-border mt-1 rounded-lg border px-3 py-2 text-sm"
              >
                <option value="">All</option>
                <option value="SUCCEEDED">Succeeded</option>
                <option value="PENDING">Pending</option>
                <option value="FAILED">Failed</option>
                <option value="CANCELED">Canceled</option>
                <option value="REQUIRES_PAYMENT_METHOD">Awaiting card</option>
                <option value="REQUIRES_ACTION">Needs action</option>
                <option value="PROCESSING">Processing</option>
              </select>
            </div>
            <button
              type="button"
              onClick={refresh}
              disabled={listCharges.isFetching}
              className="bg-secondary text-foreground/85 self-end rounded-lg px-4 py-2 text-sm font-medium"
            >
              {listCharges.isFetching ? 'Loading…' : 'Apply filter'}
            </button>
            <div className="ml-auto self-end text-sm">
              <span className="text-muted-foreground">Total rows: </span>
              <span className="text-foreground font-semibold" data-testid="charges-total">
                {filtered.length}
              </span>
            </div>
          </>
        }
      />

      {refundTarget ? (
        <RefundDialog
          charge={refundTarget}
          balanceCents={balanceCents(refundTarget)}
          onClose={() => setRefundTarget(null)}
          onComplete={() => {
            setRefundTarget(null);
            toast.addToast('success', 'Refund issued');
            void refresh();
          }}
        />
      ) : null}
      {forfeitTarget ? (
        <ForfeitDialog
          registrationId={forfeitTarget.registration.id}
          eventName={forfeitTarget.registration.event.name}
          attendeeName={forfeitTarget.registration.user.name}
          onClose={() => setForfeitTarget(null)}
          onComplete={() => {
            setForfeitTarget(null);
            toast.addToast('success', 'Registration forfeited');
            void refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function ChargeStatusBadge({ status }: { status: ChargeStatus }) {
  const palette: Record<ChargeStatus, string> = {
    SUCCEEDED: 'bg-sage/20 text-sage',
    PROCESSING: 'bg-secondary text-foreground/85',
    REQUIRES_PAYMENT_METHOD: 'bg-secondary text-foreground/85',
    REQUIRES_CONFIRMATION: 'bg-secondary text-foreground/85',
    REQUIRES_ACTION: 'bg-terracotta/20 text-terracotta',
    REQUIRES_CAPTURE: 'bg-secondary text-foreground/85',
    CANCELED: 'bg-secondary text-muted-foreground',
    FAILED: 'bg-destructive/20 text-destructive',
  };
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${palette[status] ?? 'bg-secondary'}`}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function RegistrationStatusBadge({ status }: { status: RegistrationStatus }) {
  const palette: Record<RegistrationStatus, string> = {
    PENDING: 'bg-secondary text-foreground/85',
    PAID: 'bg-sage/20 text-sage',
    REFUNDED: 'bg-terracotta/20 text-terracotta',
    FORFEITED: 'bg-destructive/20 text-destructive',
    CANCELLED: 'bg-secondary text-muted-foreground',
  };
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${palette[status] ?? 'bg-secondary'}`}
    >
      {status}
    </span>
  );
}
