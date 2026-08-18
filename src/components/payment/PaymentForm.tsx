'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { loadStripe, type Stripe as StripeJs } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { trpc } from '~/lib/trpc-client';
import { track } from '~/lib/analytics';
import { formatAmount } from '~/lib/currency';
import Spinner from '~/components/ui/Spinner';

interface PaymentFormProps {
  eventId: string;
  eventName: string;
  amountCents: number;
  currency: string;
  publishableKey: string;
  returnUrl: string;
  /**
   * Fires when Stripe confirms the payment inline (card flows,
   * including 3DS challenges). The parent uses this to invalidate
   * its registration cache and collapse the surrounding payment
   * block into a paid state. `redirect: 'if_required'` keeps the
   * user on this page for card and 3DS flows; only true redirect-
   * based payment methods (e.g. bank redirects) would still
   * navigate to `returnUrl`.
   */
  onSuccess?: (paymentIntent: { status: string; id?: string }) => void;
}

export default function PaymentForm(props: PaymentFormProps) {
  return <PaymentFormSetup {...props} />;
}

/**
 * Wraps the intent creation so the `<Elements>` provider (and the
 * `<PaymentElement>` it hosts) only mounts once a `clientSecret` is
 * available. Stripe throws if you mount a Payment Element without
 * one, so we have to fetch the intent before instantiating Stripe
 * Elements. The setup wrapper is the only place that owns the
 * `createIntent` mutation; `PaymentFormInner` below just renders the
 * confirmation form once Stripe is ready.
 */
function PaymentFormSetup(props: PaymentFormProps) {
  const stripePromise = useMemo<Promise<StripeJs | null>>(
    () => loadStripe(props.publishableKey),
    [props.publishableKey],
  );

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Defense-in-depth: even though the server reconciles stale
  // terminal-state intents, we still want <Elements> to mount exactly
  // once per form lifecycle. React 18+ StrictMode dev mode re-runs
  // effects and tRPC's `httpBatchLink` would happily bundle two
  // `createPaymentIntent` calls into one HTTP request. The ref guard
  // keeps both sides from racing the same setup. The functional
  // updater in onSuccess then freezes on whichever secret wins the
  // network race, so <Elements> never receives a `clientSecret`
  // change after first mount.
  const intentRequestedRef = useRef(false);

  const createIntent = trpc.payment.createPaymentIntent.useMutation({
    onSuccess: (data) => {
      setClientSecret((current) => current ?? data.clientSecret);
      setError(null);
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  useEffect(() => {
    if (intentRequestedRef.current) return;
    intentRequestedRef.current = true;
    createIntent.mutate({ eventId: props.eventId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!stripePromise) {
    return (
      <div className="bg-card rounded-sm p-6 shadow-sm" data-testid="payment-loading">
        <p className="text-foreground">Loading payment form…</p>
      </div>
    );
  }

  if (createIntent.isPending && !clientSecret) {
    return (
      <div className="bg-card rounded-sm p-8 shadow-sm" data-testid="payment-loading">
        <Spinner />
        <p className="text-muted-foreground mt-3">Preparing secure payment…</p>
      </div>
    );
  }

  if (createIntent.isError) {
    return (
      <div className="bg-card rounded-sm p-6 shadow-sm" data-testid="payment-error">
        <p className="text-destructive">
          {error ?? 'Could not start the payment. Please try again or contact an admin.'}
        </p>
        <button
          type="button"
          onClick={() => {
            // Allow an explicit user retry to fire a fresh mutation.
            // We deliberately reset the guard here only so a StrictMode
            // re-mount can't leak through.
            intentRequestedRef.current = false;
            setError(null);
            createIntent.mutate({ eventId: props.eventId });
          }}
          className="bg-terracotta hover:bg-terracotta mt-4 rounded-sm px-4 py-2 text-sm font-medium text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!clientSecret) {
    return null;
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        // Lock the Payment Element to the intent created for this
        // event so the clientSecret matches the Stripe session.
        clientSecret,
        appearance: { theme: 'stripe' },
      }}
    >
      <PaymentFormInner
        eventId={props.eventId}
        eventName={props.eventName}
        amountCents={props.amountCents}
        currency={props.currency}
        returnUrl={props.returnUrl}
        clientSecret={clientSecret}
        onSuccess={props.onSuccess}
      />
    </Elements>
  );
}

interface PaymentFormInnerProps {
  eventId: string;
  eventName: string;
  amountCents: number;
  currency: string;
  returnUrl: string;
  clientSecret: string;
  onSuccess?: (paymentIntent: { status: string; id?: string }) => void;
}

function PaymentFormInner(props: PaymentFormInnerProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);

    track('payment_initiated', {
      eventId: props.eventId,
      amountCents: props.amountCents,
      currency: props.currency,
    });

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message ?? 'Payment form is invalid');
      setSubmitting(false);
      return;
    }

    // `redirect: 'if_required'` keeps the user on this page for
    // card payments and 3DS challenges — Stripe.js renders the 3DS
    // dialog inline and resolves the PaymentIntent here. Only
    // redirect-based payment methods (e.g. bank redirects) will
    // still navigate to `return_url`. The result is always a
    // `PaymentIntentResult` (or an error) so we can inspect both
    // halves explicitly with a typed shape; Stripe's TypeScript
    // types narrow `paymentIntent` away on the error branch.
    //
    // Note: do NOT also pass `clientSecret` at the top level — the
    // Elements instance from `<Elements clientSecret={...}>` already
    // carries the secret, and re-passing it triggers Stripe.js'
    // "Could not retrieve elements store" path.
    type PaymentIntentLike = { status?: string; id?: string };
    type ConfirmResult = { error?: unknown; paymentIntent?: PaymentIntentLike | null };
    const result = (await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: props.returnUrl,
      },
      redirect: 'if_required',
    })) as ConfirmResult;
    const confirmError = result.error as { message?: string; code?: string } | undefined;
    const paymentIntent = result.paymentIntent ?? null;

    if (confirmError) {
      track('payment_failed', {
        eventId: props.eventId,
        error: confirmError.message,
        code: confirmError.code,
      });
      setError(confirmError.message ?? 'Payment failed');
      setSubmitting(false);
      return;
    }

    track('payment_completed', {
      eventId: props.eventId,
      amountCents: props.amountCents,
      currency: props.currency,
    });

    if (paymentIntent && paymentIntent.status === 'succeeded') {
      setSubmitting(false);
      props.onSuccess?.({ status: paymentIntent.status, id: paymentIntent.id });
      return;
    }

    // `redirect: 'if_required'` returned a non-succeeded status
    // (e.g. `processing`) without an error: Stripe is handling
    // authentication inline (3DS modal). Leave the spinner
    // running so the user sees feedback until the next poll /
    // resolve fires `onSuccess`.
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-card space-y-6 rounded-sm p-6 shadow-sm"
      data-testid="payment-form"
    >
      <div className="border-border flex items-baseline justify-between border-b pb-4">
        <span className="text-foreground text-lg font-semibold">{props.eventName}</span>
        <span className="text-foreground text-2xl font-bold">
          {formatAmount(props.amountCents, props.currency)}
        </span>
      </div>

      <PaymentElement options={{ layout: 'tabs' }} />

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={!stripe || !elements || submitting}
        className="bg-terracotta hover:bg-terracotta w-full rounded-sm px-6 py-3 text-base font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? 'Processing…' : `Pay ${formatAmount(props.amountCents, props.currency)}`}
      </button>

      <p className="text-muted-foreground text-xs">
        Card details go directly to Stripe. We never see or store your card number.
      </p>
    </form>
  );
}
