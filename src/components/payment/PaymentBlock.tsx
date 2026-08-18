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
  /**
   * If provided, the Pay now button is rendered as a regular button
   * (not a link) that calls this handler synchronously. Used when the
   * parent needs to know the user clicked Pay now — for example, to
   * unlock the Save button before confirm.
   */
  onPayNow?: () => void;
  /**
   * Called after the payLater mutation succeeds. Use this to record
   * the choice locally so the RSVP Save button is enabled. Failures
   * do not invoke the callback, so parents can rely on it as a
   * "deferred is confirmed" signal.
   */
  onPayLater?: () => void;
}

/**
 * FPP-123: embeds the fee choice inside the RSVP confirmation step
 * so the user never has to bounce through `/events/[id]/checkout`
 * unless they actually want to pay. Two CTAs:
 *
 * - Pay now → defaults to a link to the hosted Payment Element page,
 *   but parents can supply `onPayNow` to swap in a button (used by
 *   the RSVP sheet to gate Save on the choice).
 * - Pay later → keeps the registration PENDING and cancels any
 *   active Charges so a later Pay Now attempt starts from a clean
 *   intent.
 *
 * Render the block on the Attendance tab of the RSVP sheet when a
 * fee applies. Parents that gate Save on a payment choice pass
 * `onPayNow` / `onPayLater` to be notified synchronously.
 */
export default function PaymentBlock({
  eventId,
  eventName,
  amountCents,
  currency,
  deferredHint,
  onPayNow,
  onPayLater,
}: PaymentBlockProps) {
  const [deferred, setDeferred] = useState(false);
  const [payNowChosen, setPayNowChosen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const payLater = trpc.payment.payLater.useMutation({
    onSuccess: () => {
      setDeferred(true);
      setError(null);
      onPayLater?.();
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handlePayNow = () => {
    setError(null);
    setPayNowChosen(true);
    onPayNow?.();
  };

  const hint =
    deferredHint ??
    `You can pay ${formatAmount(amountCents, currency)} for ${eventName} any time before the event.`;

  const payNowClass =
    'bg-terracotta shadow-soft press hover:bg-terracotta/90 rounded-sm px-4 py-2 text-sm font-semibold text-white transition-all disabled:opacity-60';
  const payLaterClass =
    'border-border bg-card text-foreground hover:border-foreground rounded-sm border px-4 py-2 text-sm font-semibold transition-all disabled:opacity-60';

  return (
    <div
      className="bg-sunlight/15 ring-sunlight/30 mt-3 rounded-sm px-4 py-3 text-sm ring-1"
      data-testid="rsvp-payment-block"
    >
      <p className="text-foreground font-semibold">
        Registration fee: {formatAmount(amountCents, currency)}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {onPayNow ? (
          <button
            type="button"
            onClick={handlePayNow}
            disabled={payNowChosen || payLater.isPending}
            className={payNowClass}
            data-testid="rsvp-payment-pay-now"
          >
            {payNowChosen ? 'Continue to payment →' : 'Pay now'}
          </button>
        ) : (
          <a
            href={`/events/${eventId}/checkout`}
            className={payNowClass}
            data-testid="rsvp-payment-pay-now"
          >
            Pay now
          </a>
        )}
        <button
          type="button"
          onClick={() => {
            setError(null);
            payLater.mutate({ eventId });
          }}
          disabled={deferred || payLater.isPending}
          className={payLaterClass}
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
        <p className="text-destructive mt-2 text-xs" data-testid="rsvp-payment-error">
          {error}
        </p>
      )}
    </div>
  );
}