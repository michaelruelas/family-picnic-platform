'use client';

import { useEffect, useMemo, useState } from 'react';
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

  const createIntent = trpc.payment.createPaymentIntent.useMutation({
    onSuccess: (data) => {
      setClientSecret(data.clientSecret);
      setError(null);
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  useEffect(() => {
    if (clientSecret) return;
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
          onClick={() => createIntent.mutate({ eventId: props.eventId })}
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

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      clientSecret: props.clientSecret,
      confirmParams: {
        return_url: props.returnUrl,
      },
    });

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
    // If we reach here without an error, Stripe is redirecting to the
    // return_url. Show a spinner until the navigation completes.
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