'use client';

import { useState } from 'react';
import { trpc } from '~/lib/trpc-client';
import { formatAmount } from '~/lib/currency';

interface PaymentBlockProps {
  eventId: string;
  eventName: string;
  amountCents: number;
  currency: string;
  /**
   * Optional refund hint surfaced under the Pay Later button.
   * Defaults to the standard copy.
   */
  deferredHint?: string;
}

/**
 * FPP-123: embeds the fee choice inside the RSVP confirmation step
 * so the user never has to bounce through `/events/[id]/checkout`
 * unless they actually want to pay. Two CTAs:
 *
 * - Pay now → links to the hosted Payment Element page.
 * - Pay later → keeps the registration PENDING and cancels any
 *   active Charges so a later Pay Now attempt starts from a clean
 *   intent.
 *
 * Render the block inside the bottom sheet (and on the EventRsvpCard)
 * once the user has confirmed attendance with a positive fee.
 */
export default function PaymentBlock({
  eventId,
  eventName,
  amountCents,
  currency,
  deferredHint,
}: PaymentBlockProps) {
  const [deferred, setDeferred] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const payLater = trpc.payment.payLater.useMutation({
    onSuccess: () => {
      setDeferred(true);
      setError(null);
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const hint =
    deferredHint ??
    `You can pay ${formatAmount(amountCents, currency)} for ${eventName} any time before the event.`;

  return (
    <div
      className="bg-sunlight/15 ring-sunlight/30 mt-3 rounded-sm px-4 py-3 text-sm ring-1"
      data-testid="rsvp-payment-block"
    >
      <p className="text-foreground font-semibold">
        Registration fee: {formatAmount(amountCents, currency)}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={`/events/${eventId}/checkout`}
          className="bg-terracotta shadow-soft press hover:bg-terracotta/90 rounded-sm px-4 py-2 text-sm font-semibold text-white transition-all"
          data-testid="rsvp-payment-pay-now"
        >
          Pay now
        </a>
        <button
          type="button"
          onClick={() => {
            setError(null);
            payLater.mutate({ eventId });
          }}
          disabled={deferred || payLater.isPending}
          className="border-border bg-card text-foreground hover:border-foreground rounded-sm border px-4 py-2 text-sm font-semibold transition-all disabled:opacity-60"
          data-testid="rsvp-payment-pay-later"
        >
          {payLater.isPending
            ? 'Saving…'
            : deferred
              ? 'Saved — pay later'
              : 'Pay later'}
        </button>
      </div>
      <p className="text-muted-foreground mt-2 text-xs">{hint}</p>
      {error && (
        <p
          className="text-destructive mt-2 text-xs"
          data-testid="rsvp-payment-error"
        >
          {error}
        </p>
      )}
    </div>
  );
}