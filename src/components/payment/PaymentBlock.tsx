'use client';

import { useEffect, useState } from 'react';
import { trpc } from '~/lib/trpc-client';
import { formatAmount } from '~/lib/currency';
import PaymentForm from './PaymentForm';

export type PaymentChoice = 'payLater' | 'payNow' | null;

interface PaymentRegistration {
  status: 'PENDING' | 'PAID' | 'REFUNDED' | 'FORFEITED' | 'CANCELLED';
  amountCents: number;
  currency: string;
  /**
   * FPP-124: net of SUCCEEDED charges minus SUCCEEDED refunds. Used to
   * derive the remaining balance against the live fee (event config +
   * roster) when the user adds attendees after paying. Defaults to 0
   * when the caller does not yet have the new field (e.g. older
   * callers that pass a hand-built registration prop).
   */
  netPaidCents?: number;
}

interface PaymentBreakdown {
  qualifyingAttendees: number;
  perAttendeeCents: number;
}

interface PaymentBlockProps {
  eventId: string;
  eventName: string;
  amountCents: number;
  currency: string;
  /**
   * Per-attendee fee breakdown, e.g. "2 attendees at $5.00".
   * Rendered as small print under the headline fee.
   */
  breakdown?: PaymentBreakdown;
  /**
   * Caller's existing registration for this event. When `null` the
   * user has not yet started payment. When `status === 'PAID'` the
   * block collapses to a paid badge so we do not re-prompt for
   * money. Other statuses render the buttons so the user can pay or
   * defer.
   */
  registration: PaymentRegistration | null;
  /**
   * Parent-tracked payment choice. `null` = no decision yet,
   * `'payLater'` = Pay later was clicked (sticky badge replaces the
   * buttons), `'payNow'` = inline form is mounted. The Paid badge
   * is rendered from the `registration` prop, not from this state,
   * so a user who paid on a previous visit lands on the right view
   * without any local-state dance.
   */
  choice?: PaymentChoice;
  /**
   * Notifies the parent of a new payment choice after each user
   * action. Use this to gate the surrounding "Save" button.
   */
  onChoiceChange?: (choice: PaymentChoice) => void;
  /**
   * Optional hint copy rendered under the buttons or paid badge.
   * Defaults to a generic "now or later" line.
   */
  hint?: string;
  /**
   * Path Stripe redirects to when an off-session step (3DS) is
   * required. Defaults to `/events/{eventId}/checkout/return`,
   * resolved against `NEXTAUTH_URL` (Stripe requires an absolute
   * URL here, so we cannot pass the path by itself).
   */
  returnUrl?: string;
  /**
   * FPP-124: when true, the Pay button is disabled until the caller
   * commits the attendance drafts. The server-side fee is computed
   * from the saved RSVP roster, so paying before the user clicks
   * Save would either under-charge or throw "already registered"
   * when the live fee has grown. The block swaps the Pay button
   * for an inline hint that points at the surrounding Save
   * control so the user knows what to do next.
   */
  payRequiresSave?: boolean;
}

function defaultReturnUrl(eventId: string): string {
  const base = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}/events/${eventId}/checkout/return`;
}

/**
 * FPP-123 + inline payment: embeds the fee choice inside the RSVP
 * confirmation step. The block is now a single container so the
 * outer "Registration fee" label and the buttons live in the same
 * box (no double-nested ring). Pay now expands the Stripe Elements
 * form inline so the user never leaves the sheet; Pay later marks
 * the choice locally and on the server, then collapses the buttons
 * into a sticky "Saved — pay later" badge. When the caller has an
 * existing PAID registration, the block collapses to a "Paid"
 * badge so we do not re-prompt for money.
 */
export default function PaymentBlock({
  eventId,
  eventName,
  amountCents,
  currency,
  breakdown,
  registration,
  choice = null,
  onChoiceChange,
  hint,
  returnUrl,
  payRequiresSave = false,
}: PaymentBlockProps) {
  const [error, setError] = useState<string | null>(null);
  // FPP-124: set when Stripe confirms a payment client-side but the
  // webhook has not yet flipped the registration status. Without this
  // state the block reverts to "Pay $X" the moment `handlePaid`
  // clears `choice`, which makes the user think the payment failed
  // and reach for the browser refresh button. Keeping a sticky
  // "payment received" panel until the cache refetch lands the new
  // PAID status closes that gap.
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const utils = trpc.useUtils();

  const publishableKeyQuery = trpc.payment.getPublishableKey.useQuery();
  const publishableKey = publishableKeyQuery.data?.publishableKey ?? null;

  const payLater = trpc.payment.payLater.useMutation({
    onSuccess: async () => {
      setError(null);
      // Refresh the registration snapshot so the parent sees the
      // latest status (payLater cancels active charges but keeps
      // the row PENDING; the cache may have gone stale).
      await utils.payment.getMyRegistration.invalidate({ eventId });
      onChoiceChange?.('payLater');
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const isPaid = registration?.status === 'PAID';

  // FPP-124: when the registration is PAID but the live fee has grown
  // (user added attendees, admin raised the per-attendee fee), surface
  // the outstanding balance instead of collapsing to the Paid badge.
  // When `netPaidCents` is missing (older callers or hand-built test
  // props), fall back to `registration.amountCents` so a PAID row
  // without the new field still renders the Paid badge — that matches
  // the historical "snapshot at charge time" semantics of amountCents.
  const netPaid = registration?.netPaidCents ?? registration?.amountCents ?? 0;
  const outstandingCents = isPaid && amountCents > netPaid ? amountCents - netPaid : 0;
  const overpaidCents = isPaid && netPaid > amountCents ? netPaid - amountCents : 0;
  const hasOutstanding = outstandingCents > 0;

  // The form mounts in two cases — the legacy "fresh registration"
  // flow (`payNow` while not yet paid) and the new "settle the
  // outstanding delta" flow (`payNow` while paid but still owing).
  // The block-level branches below decide which copy to render once
  // the form is up.
  const isFormMode = choice === 'payNow' && (!isPaid || hasOutstanding);
  // Deferring is meaningless when there is an outstanding balance —
  // the user needs to settle up, not push the work forward.
  const isPayLaterMode = choice === 'payLater' && !isPaid && !hasOutstanding;

  const handlePayNow = () => {
    setError(null);
    onChoiceChange?.('payNow');
  };

  const handlePayLater = () => {
    setError(null);
    payLater.mutate({ eventId });
  };

  const handlePaid = async () => {
    setError(null);
    // Stripe just confirmed the payment client-side. We don't yet
    // know the registration is PAID — that arrives on the webhook
    // asynchronously — so hold the block in a "Payment received"
    // state instead of bouncing the user out to a stale "Pay $X"
    // button that would tempt them to retry.
    setPaymentProcessing(true);
    await utils.payment.getMyRegistration.invalidate({ eventId });
  };

  const handleCancelForm = () => {
    setError(null);
    setPaymentProcessing(false);
    onChoiceChange?.(null);
  };

  // FPP-124: clear the "Payment received" panel once the cache
  // refetch reflects the new charge. The webhook flips the Charge
  // to SUCCEEDED on Stripe's side, the cache refetch picks up the
  // updated `netPaidCents`, the outstanding drops to zero, and the
  // regular Paid badge (or overpaid note) takes over without a
  // flash of the old Pay button.
  useEffect(() => {
    if (paymentProcessing && isPaid && outstandingCents === 0) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setPaymentProcessing(false);
      onChoiceChange?.(null);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [paymentProcessing, isPaid, outstandingCents, onChoiceChange]);

  if (paymentProcessing) {
    // FPP-124: Stripe confirmed a payment client-side but the webhook
    // that flips the registration status / outstanding has not yet
    // landed. Show a sticky panel so the user does not retry on
    // what looks like a stale UI. Cleared by the useEffect above
    // once the cache refetch reflects the new SUCCEEDED charge.
    return (
      <div
        className="bg-sage/15 ring-sage/30 mt-3 rounded-sm px-4 py-3 text-sm ring-1"
        data-testid="rsvp-payment-processing"
        data-payment-processing="true"
      >
        <p className="text-foreground flex items-center gap-2 font-semibold">
          <span className="bg-sage/30 text-sage inline-flex h-5 w-5 items-center justify-center rounded-sm text-xs font-bold">
            ✓
          </span>
          Payment received
        </p>
        <p className="text-muted-foreground mt-2 text-xs">
          Thanks — your payment is on its way. We&apos;re confirming it with Stripe now; this
          message will switch to &quot;Paid&quot; as soon as the confirmation lands (usually a few
          seconds).
        </p>
        <button
          type="button"
          onClick={handleCancelForm}
          className="text-muted-foreground hover:text-foreground mt-2 text-xs font-medium underline underline-offset-4"
          data-testid="rsvp-payment-cancel-processing"
        >
          Close
        </button>
      </div>
    );
  }

  if (isPaid && hasOutstanding) {
    return (
      <div
        className="bg-sunlight/15 ring-sunlight/30 mt-3 rounded-sm px-4 py-3 text-sm ring-1"
        data-testid="rsvp-payment-block"
        data-amount-due="true"
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-foreground font-semibold">
            Amount due: {formatAmount(outstandingCents, currency)}
          </span>
          <span
            className="bg-foreground/5 text-muted-foreground rounded-sm px-2 py-0.5 text-xs font-semibold"
            data-testid="rsvp-payment-amount-due-badge"
          >
            Balance owed
          </span>
        </div>
        <p className="text-muted-foreground mt-1 text-xs">
          {breakdown && (
            <>
              Total registration fee: {formatAmount(amountCents, currency)} (
              {breakdown.qualifyingAttendees}{' '}
              {breakdown.qualifyingAttendees === 1 ? 'attendee' : 'attendees'} at{' '}
              {formatAmount(breakdown.perAttendeeCents, currency)}). Paid so far:{' '}
              {formatAmount(netPaid, currency)}.
            </>
          )}
          {!breakdown && (
            <>
              Total registration fee: {formatAmount(amountCents, currency)}. Paid so far:{' '}
              {formatAmount(netPaid, currency)}.
            </>
          )}
        </p>

        {payRequiresSave ? (
          <p
            className="text-muted-foreground mt-3 text-xs italic"
            data-testid="rsvp-payment-save-first-hint"
          >
            Save your attendance changes first — the new total needs to be on file before we can
            take the top-up payment.
          </p>
        ) : isFormMode ? (
          <div className="mt-3" data-testid="rsvp-payment-form-wrapper">
            {publishableKey ? (
              <PaymentForm
                eventId={eventId}
                eventName={eventName}
                amountCents={outstandingCents}
                currency={currency}
                publishableKey={publishableKey}
                returnUrl={returnUrl ?? defaultReturnUrl(eventId)}
                onSuccess={handlePaid}
              />
            ) : (
              <div
                className="bg-card rounded-sm p-4 text-sm"
                data-testid="rsvp-payment-form-loading"
              >
                <p className="text-muted-foreground">
                  {publishableKeyQuery.isLoading
                    ? 'Loading payment form…'
                    : 'Online payment is not available right now. Contact an admin to settle up.'}
                </p>
              </div>
            )}
            <button
              type="button"
              onClick={handleCancelForm}
              className="text-muted-foreground hover:text-foreground mt-2 w-full text-center text-xs font-medium underline underline-offset-4"
              data-testid="rsvp-payment-cancel-form"
            >
              Cancel and go back
            </button>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handlePayNow}
              disabled={!publishableKey}
              className="bg-terracotta shadow-soft press hover:bg-terracotta/90 rounded-sm px-4 py-2 text-sm font-semibold text-white transition-all disabled:opacity-60"
              data-testid="rsvp-payment-pay-now"
            >
              Pay {formatAmount(outstandingCents, currency)}
            </button>
          </div>
        )}
        {error && (
          <p className="text-destructive mt-2 text-xs" data-testid="rsvp-payment-error">
            {error}
          </p>
        )}
      </div>
    );
  }

  if (isPaid) {
    return (
      <div
        className="bg-sunlight/15 ring-sunlight/30 mt-3 rounded-sm px-4 py-3 text-sm ring-1"
        data-testid="rsvp-payment-block"
        data-paid="true"
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-foreground font-semibold">
            Registration fee: {formatAmount(amountCents, currency)}
          </span>
          <span
            className="bg-sage/30 text-sage rounded-sm px-2 py-0.5 text-xs font-semibold"
            data-testid="rsvp-payment-paid-badge"
          >
            Paid
          </span>
        </div>
        {breakdown && (
          <p className="text-muted-foreground mt-1 text-xs">
            ({breakdown.qualifyingAttendees}{' '}
            {breakdown.qualifyingAttendees === 1 ? 'attendee' : 'attendees'} at{' '}
            {formatAmount(breakdown.perAttendeeCents, currency)})
          </p>
        )}
        <p className="text-muted-foreground mt-2 text-xs">
          {hint ?? 'Your registration is paid. You\u2019re all set.'}
        </p>
        {overpaidCents > 0 && (
          <p
            className="text-muted-foreground mt-2 text-xs italic"
            data-testid="rsvp-payment-overpaid-note"
          >
            You paid {formatAmount(overpaidCents, currency)} more than the current fee. Contact the
            organizer if you&apos;d like a refund.
          </p>
        )}
      </div>
    );
  }

  if (isPayLaterMode) {
    return (
      <div
        className="bg-sunlight/15 ring-sunlight/30 mt-3 rounded-sm px-4 py-3 text-sm ring-1"
        data-testid="rsvp-payment-block"
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-foreground font-semibold">
            Registration fee: {formatAmount(amountCents, currency)}
          </span>
          <span
            className="bg-foreground/5 text-muted-foreground rounded-sm px-2 py-0.5 text-xs font-semibold"
            data-testid="rsvp-payment-deferred"
          >
            Saved — pay later
          </span>
        </div>
        {breakdown && (
          <p className="text-muted-foreground mt-1 text-xs">
            ({breakdown.qualifyingAttendees}{' '}
            {breakdown.qualifyingAttendees === 1 ? 'attendee' : 'attendees'} at{' '}
            {formatAmount(breakdown.perAttendeeCents, currency)})
          </p>
        )}
        <p className="text-muted-foreground mt-2 text-xs">
          {hint ??
            `You can pay ${formatAmount(amountCents, currency)} for ${eventName} any time before the event.`}
        </p>
        <button
          type="button"
          onClick={handleCancelForm}
          className="text-muted-foreground hover:text-foreground mt-2 text-xs font-medium underline underline-offset-4"
          data-testid="rsvp-payment-cancel-deferred"
        >
          Cancel and go back
        </button>
      </div>
    );
  }

  return (
    <div
      className="bg-sunlight/15 ring-sunlight/30 mt-3 rounded-sm px-4 py-3 text-sm ring-1"
      data-testid="rsvp-payment-block"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-foreground font-semibold">
          Registration fee: {formatAmount(amountCents, currency)}
        </span>
      </div>
      {breakdown && (
        <p className="text-muted-foreground mt-1 text-xs">
          ({breakdown.qualifyingAttendees}{' '}
          {breakdown.qualifyingAttendees === 1 ? 'attendee' : 'attendees'} at{' '}
          {formatAmount(breakdown.perAttendeeCents, currency)})
        </p>
      )}

      {isFormMode ? (
        <div className="mt-3" data-testid="rsvp-payment-form-wrapper">
          {publishableKey ? (
            <PaymentForm
              eventId={eventId}
              eventName={eventName}
              amountCents={amountCents}
              currency={currency}
              publishableKey={publishableKey}
              returnUrl={returnUrl ?? defaultReturnUrl(eventId)}
              onSuccess={handlePaid}
            />
          ) : (
            <div className="bg-card rounded-sm p-4 text-sm" data-testid="rsvp-payment-form-loading">
              <p className="text-muted-foreground">
                {publishableKeyQuery.isLoading
                  ? 'Loading payment form…'
                  : 'Online payment is not available right now. Choose Pay later instead.'}
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={handleCancelForm}
            className="text-muted-foreground hover:text-foreground mt-2 w-full text-center text-xs font-medium underline underline-offset-4"
            data-testid="rsvp-payment-cancel-form"
          >
            Cancel and go back
          </button>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handlePayNow}
            disabled={payLater.isPending || !publishableKey}
            className="bg-terracotta shadow-soft press hover:bg-terracotta/90 rounded-sm px-4 py-2 text-sm font-semibold text-white transition-all disabled:opacity-60"
            data-testid="rsvp-payment-pay-now"
          >
            Pay now
          </button>
          <button
            type="button"
            onClick={handlePayLater}
            disabled={payLater.isPending}
            className="text-muted-foreground hover:text-foreground rounded-sm px-2 py-2 text-xs font-medium underline underline-offset-4 transition-colors disabled:opacity-60"
            data-testid="rsvp-payment-pay-later"
          >
            {payLater.isPending ? 'Saving…' : 'Pay later'}
          </button>
        </div>
      )}
      <p className="text-muted-foreground mt-2 text-xs">
        {hint ??
          `Pay ${formatAmount(amountCents, currency)} now or settle up later — the choice is yours.`}
      </p>
      {error && (
        <p className="text-destructive mt-2 text-xs" data-testid="rsvp-payment-error">
          {error}
        </p>
      )}
    </div>
  );
}
