'use client';

import { useState } from 'react';
import { trpc } from '~/lib/trpc-client';
import { formatAmount } from '~/lib/currency';

interface PaymentBlockProps {
  eventId: string;
  amountCents: number;
  currency: string;
  /**
   * Optional hint surfaced under the buttons. Defaults to the standard
   * copy explaining the fee and the pay-later option.
   */
  deferredHint?: string;
  /**
   * Called when the user picks Pay now. The default (no handler)
   * navigates the browser to `/events/{id}/checkout`. Parents can
   * override this when they need to do bookkeeping before the
   * navigation (for tests, deep links, or analytics).
   */
  onPayNow?: () => void;
}

/**
 * FPP-123: embeds the fee choice inside the RSVP confirmation step
 * so the user never has to bounce through `/events/[id]/checkout`
 * unless they actually want to pay.
 *
 * Design contract:
 *
 * - Pay now is the primary action and takes the user straight to the
 *   checkout page (`onPayNow` defaults to a `window.location` assign).
 *   Pay later is not offered once Pay now is selected.
 * - Pay later is a de-emphasized secondary action that runs the
 *   `payment.payLater` mutation (cancels any active Charges, leaves
 *   the registration PENDING). Pay now is hidden once Pay later is
 *   selected.
 * - Save is never gated by the payment choice — the user can always
 *   submit the RSVP, paid or deferred.
 *
 * The component tracks the choice locally with a `choice` flag; a
 * separate `payLater` mutation success flips it to `'payLater'`, and
 * the Pay now handler sets it to `'payNow'` synchronously. Render the
 * block anywhere a fee applies.
 */
export default function PaymentBlock({
  eventId,
  amountCents,
  currency,
  deferredHint,
  onPayNow,
}: PaymentBlockProps) {
  const [choice, setChoice] = useState<'payNow' | 'payLater' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const payLater = trpc.payment.payLater.useMutation({
    onSuccess: () => {
      setChoice('payLater');
      setError(null);
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handlePayNow = () => {
    setError(null);
    setChoice('payNow');
    if (onPayNow) {
      onPayNow();
    } else if (typeof window !== 'undefined') {
      window.location.assign(`/events/${eventId}/checkout`);
    }
  };

  const handlePayLater = () => {
    setError(null);
    payLater.mutate({ eventId });
  };

  const hint =
    deferredHint ??
    `Pay ${formatAmount(amountCents, currency)} now or settle up later — the choice is yours.`;

  return (
    <div
      className="bg-sunlight/15 ring-sunlight/30 mt-3 rounded-sm px-4 py-3 text-sm ring-1"
      data-testid="rsvp-payment-block"
    >
      <p className="text-foreground font-semibold">
        Registration fee: {formatAmount(amountCents, currency)}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {choice !== 'payLater' && (
          <button
            type="button"
            onClick={handlePayNow}
            disabled={payLater.isPending}
            className="bg-terracotta shadow-soft press hover:bg-terracotta/90 rounded-sm px-4 py-2 text-sm font-semibold text-white transition-all disabled:opacity-60"
            data-testid="rsvp-payment-pay-now"
          >
            Pay now
          </button>
        )}
        {choice === 'payLater' && (
          <span
            className="bg-foreground/5 text-muted-foreground rounded-sm px-4 py-2 text-sm font-semibold"
            data-testid="rsvp-payment-deferred"
          >
            Saved — pay later
          </span>
        )}
        {choice !== 'payNow' && (
          <button
            type="button"
            onClick={handlePayLater}
            disabled={payLater.isPending}
            className="text-muted-foreground hover:text-foreground rounded-sm px-2 py-2 text-xs font-medium underline underline-offset-4 transition-colors disabled:opacity-60"
            data-testid="rsvp-payment-pay-later"
          >
            {payLater.isPending ? 'Saving…' : 'Pay later'}
          </button>
        )}
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