'use client';

import { useState } from 'react';
import Modal from '~/components/ui/Modal';
import { trpc } from '~/lib/trpc-client';
import { formatAmount } from '~/lib/currency';
import type { AdminChargeRow } from './ChargesTable';

interface RefundDialogProps {
  charge: AdminChargeRow;
  balanceCents: number;
  onClose: () => void;
  onComplete: () => void;
}

export default function RefundDialog({
  charge,
  balanceCents,
  onClose,
  onComplete,
}: RefundDialogProps) {
  const [amountDollars, setAmountDollars] = useState((balanceCents / 100).toFixed(2));
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const refund = trpc.admin.refund.useMutation({
    onSuccess: () => onComplete(),
    onError: (err) => setError(err.message),
  });

  const parsedCents = Math.round(Number(amountDollars) * 100);
  const isFull = parsedCents >= balanceCents;
  const valid = parsedCents > 0 && parsedCents <= balanceCents;

  return (
    <Modal isOpen onClose={onClose} title="Issue refund" size="md">
      <div className="space-y-4">
        <div>
          <p className="text-foreground font-semibold">{charge.registration.event.name}</p>
          <p className="text-muted-foreground text-sm">
            {charge.registration.user.name} · {charge.registration.user.email}
          </p>
        </div>

        <div className="bg-secondary rounded-lg p-3 text-sm">
          <div className="flex justify-between">
            <span>Original charge</span>
            <span>{formatAmount(charge.amountCents, charge.currency)}</span>
          </div>
          <div className="text-muted-foreground flex justify-between text-xs">
            <span>Already refunded</span>
            <span>{formatAmount(charge.amountCents - balanceCents, charge.currency)}</span>
          </div>
          <div className="mt-1 flex justify-between border-t pt-1 font-semibold">
            <span>Remaining balance</span>
            <span>{formatAmount(balanceCents, charge.currency)}</span>
          </div>
        </div>

        <label className="block">
          <span className="text-foreground text-sm font-medium">Refund amount (USD)</span>
          <input
            type="number"
            min="0.01"
            max={(balanceCents / 100).toFixed(2)}
            step="0.01"
            value={amountDollars}
            onChange={(e) => setAmountDollars(e.target.value)}
            className="border-border mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            data-testid="refund-amount-input"
          />
          <span className="text-muted-foreground mt-1 block text-xs">
            {isFull ? 'Full refund' : 'Partial refund'}
          </span>
        </label>

        <label className="block">
          <span className="text-foreground text-sm font-medium">Reason (optional)</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={500}
            className="border-border mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="requested_by_customer, duplicate, etc."
          />
        </label>

        {error ? <p className="text-destructive text-sm">{error}</p> : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="bg-secondary text-foreground/85 rounded-lg px-4 py-2 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              refund.mutate({
                chargeId: charge.id,
                amountCents: parsedCents,
                ...(reason ? { reason } : {}),
              })
            }
            disabled={!valid || refund.isPending}
            className="bg-terracotta hover:bg-terracotta rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            data-testid="refund-submit"
          >
            {refund.isPending
              ? 'Refunding…'
              : isFull
                ? `Refund ${formatAmount(balanceCents, charge.currency)}`
                : `Refund ${formatAmount(parsedCents, charge.currency)}`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
