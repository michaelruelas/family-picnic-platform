'use client';

import { useMemo, useState } from 'react';
import type { ChargeStatus, RefundStatus, RegistrationStatus } from '~/lib/generated/enums';
import { trpc } from '~/lib/trpc-client';
import { formatAmount } from '~/lib/stripe';
import RefundDialog from './RefundDialog';
import ForfeitDialog from './ForfeitDialog';
import { useToast } from '~/components/ui/Toast';

type SerializedDate = string;

export interface AdminChargeRow {
  id: string;
  registrationId: string;
  stripePaymentIntentId: string;
  amountCents: number;
  currency: string;
  status: ChargeStatus;
  receiptUrl: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdAt: SerializedDate;
  updatedAt: SerializedDate;
  registration: {
    id: string;
    status: RegistrationStatus;
    refundedCents: number;
    receiptSentAt: SerializedDate | null;
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
          registration: {
            ...c.registration,
            createdAt: c.registration.createdAt.toISOString(),
            updatedAt: c.registration.updatedAt.toISOString(),
            receiptSentAt: c.registration.receiptSentAt?.toISOString() ?? null,
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

  const refundedCents = (row: AdminChargeRow) =>
    row.refunds.filter((r) => r.status === 'SUCCEEDED').reduce((sum, r) => sum + r.amountCents, 0);
  const balanceCents = (row: AdminChargeRow) => row.amountCents - refundedCents(row);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4 rounded-lg bg-white p-4 shadow-sm">
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
        <div className="flex items-end">
          <button
            type="button"
            onClick={refresh}
            disabled={listCharges.isFetching}
            className="bg-secondary text-foreground/85 rounded-lg px-4 py-2 text-sm font-medium"
          >
            {listCharges.isFetching ? 'Loading…' : 'Apply filter'}
          </button>
        </div>
        <div className="ml-auto text-sm">
          <span className="text-muted-foreground">Total rows: </span>
          <span className="text-foreground font-semibold">{filtered.length}</span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="min-w-full divide-y divide-stone-200">
          <thead className="bg-secondary/60">
            <tr>
              <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wider uppercase">
                When
              </th>
              <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wider uppercase">
                Event
              </th>
              <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wider uppercase">
                Attendee
              </th>
              <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wider uppercase">
                Amount
              </th>
              <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wider uppercase">
                Charge status
              </th>
              <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wider uppercase">
                Registration
              </th>
              <th className="text-muted-foreground px-4 py-3 text-right text-xs font-medium tracking-wider uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-muted-foreground px-4 py-12 text-center text-sm">
                  No charges match the current filters.
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className="hover:bg-secondary/40">
                  <td className="text-muted-foreground px-4 py-3 text-sm whitespace-nowrap">
                    {new Date(c.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="text-foreground font-medium">{c.registration.event.name}</div>
                    <div className="text-muted-foreground text-xs">
                      {new Date(c.registration.event.date).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="text-foreground">{c.registration.user.name}</div>
                    <div className="text-muted-foreground text-xs">{c.registration.user.email}</div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="text-foreground font-semibold">
                      {formatAmount(c.amountCents, c.currency)}
                    </div>
                    {refundedCents(c) > 0 ? (
                      <div className="text-muted-foreground text-xs">
                        Refunded {formatAmount(refundedCents(c), c.currency)} · Balance{' '}
                        {formatAmount(balanceCents(c), c.currency)}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <ChargeStatusBadge status={c.status} />
                    {c.lastErrorMessage ? (
                      <div className="text-destructive mt-1 text-xs">{c.lastErrorMessage}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <RegistrationStatusBadge status={c.registration.status} />
                    {c.refunds.length > 0 ? (
                      <details className="mt-1 text-xs">
                        <summary className="text-terracotta cursor-pointer">
                          {c.refunds.length} refund{c.refunds.length === 1 ? '' : 's'}
                        </summary>
                        <ul className="text-muted-foreground mt-1 space-y-1">
                          {c.refunds.map((r) => (
                            <li key={r.id}>
                              {formatAmount(r.amountCents, r.currency)} · {r.status} ·{' '}
                              {r.refundedBy.name} · {new Date(r.createdAt).toLocaleDateString()}
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    <div className="flex justify-end gap-2">
                      {c.status === 'SUCCEEDED' && balanceCents(c) > 0 ? (
                        <button
                          type="button"
                          onClick={() => setRefundTarget(c)}
                          className="bg-terracotta hover:bg-terracotta rounded-lg px-3 py-1.5 text-xs font-medium text-white"
                        >
                          Refund
                        </button>
                      ) : null}
                      {c.status === 'SUCCEEDED' && c.registration.status === 'PAID' ? (
                        <button
                          type="button"
                          onClick={() => setForfeitTarget(c)}
                          className="bg-secondary text-foreground/85 rounded-lg px-3 py-1.5 text-xs font-medium"
                        >
                          Forfeit
                        </button>
                      ) : null}
                      {c.status === 'SUCCEEDED' && !c.registration.receiptSentAt ? (
                        <button
                          type="button"
                          onClick={() => resendReceipt.mutate({ chargeId: c.id })}
                          disabled={resendReceipt.isPending}
                          className="bg-secondary text-foreground/85 rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                        >
                          {resendReceipt.isPending ? 'Sending…' : 'Resend receipt'}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

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
