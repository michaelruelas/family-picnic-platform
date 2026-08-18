'use client';

import { useState } from 'react';
import { trpc } from '~/lib/trpc-client';
import { formatAmount } from '~/lib/currency';
import PaymentForm from './PaymentForm';

export type PaymentChoice = 'payLater' | 'payNow' | null;

interface PaymentRegistration {
  status: 'PENDING' | 'PAID' | 'REFUNDED' | 'FORFEITED' | 'CANCELLED';
  amountCents: number;
  currency: string;
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
}: PaymentBlockProps) {
  const [error, setError] = useState<string | null>(null);
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
  const isFormMode = choice === 'payNow' && !isPaid;
  const isPayLaterMode = choice === 'payLater' && !isPaid;

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
    // The webhook flips status to PAID; invalidating the cache
    // causes the parent (and this block, via the registration
    // prop) to re-render the paid badge and unlock Save. No
    // setState round-trip is needed here.
    await utils.payment.getMyRegistration.invalidate({ eventId });
    onChoiceChange?.(null);
  };

  const handleCancelForm = () => {
    setError(null);
    onChoiceChange?.(null);
  };

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
