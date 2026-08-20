import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@stripe/stripe-js', () => ({
  loadStripe: vi.fn(async () => ({})),
}));

vi.mock('next-themes', () => ({
  // PaymentForm reads `resolvedTheme` to pick Stripe's night vs stripe
  // appearance. Tests render without a ThemeProvider, so we return a
  // stable light-mode value to avoid hook-count drift between renders.
  useTheme: () => ({ resolvedTheme: 'light', theme: 'light', setTheme: () => {} }),
}));

const mockElementsSpy = vi.fn();
const mockPaymentElementSpy = vi.fn();

const mockConfirmPayment = vi.fn().mockResolvedValue({ paymentIntent: { status: 'succeeded' } });

vi.mock('@stripe/react-stripe-js', () => ({
  Elements: (props: { children: React.ReactNode; stripe: unknown; options: unknown }) => {
    mockElementsSpy(props.options);
    return <div data-testid="elements-provider">{props.children}</div>;
  },
  PaymentElement: (props: unknown) => {
    mockPaymentElementSpy(props);
    return <div data-testid="payment-element" />;
  },
  useStripe: () => ({
    confirmPayment: mockConfirmPayment,
  }),
  useElements: () => ({
    submit: vi.fn().mockResolvedValue({}),
  }),
}));

interface IntentOutcome {
  clientSecret?: string;
  error?: Error;
  isPending?: boolean;
  isError?: boolean;
}

let intentOutcome: IntentOutcome = { clientSecret: 'pi_test_secret_xyz' };
// Optional per-call clientSecret overrides — when set, each successive
// `mutate()` call resolves with the next secret in the queue. Used by
// the StrictMode double-mount test to assert the form freezes on the
// first one and ignores the second.
const intentSecretQueue: string[] = [];

const mockMutate = vi.fn();

vi.mock('~/lib/trpc-client', () => ({
  trpc: {
    payment: {
      createPaymentIntent: {
        useMutation: vi.fn(
          (opts: { onSuccess?: (data: unknown) => void; onError?: (e: Error) => void }) => ({
            mutate: (input: { eventId: string }) => {
              mockMutate(input);
              if (intentOutcome.error) {
                opts?.onError?.(intentOutcome.error);
              } else {
                const queuedSecret = intentSecretQueue.shift();
                const secret = queuedSecret ?? intentOutcome.clientSecret;
                if (secret) opts?.onSuccess?.({ clientSecret: secret });
              }
            },
            get isPending() {
              return intentOutcome.isPending ?? false;
            },
            get isError() {
              return intentOutcome.isError ?? false;
            },
          }),
        ),
      },
    },
  },
}));

const { default: PaymentForm } = await import('../PaymentForm');

beforeEach(() => {
  mockMutate.mockClear();
  mockElementsSpy.mockClear();
  mockPaymentElementSpy.mockClear();
  mockConfirmPayment.mockClear();
  mockConfirmPayment.mockResolvedValue({ paymentIntent: { status: 'succeeded' } });
  intentOutcome = { clientSecret: 'pi_test_secret_xyz' };
  intentSecretQueue.length = 0;
});

const baseProps = {
  eventId: 'evt-1',
  eventName: 'Annual Picnic',
  amountCents: 1000,
  currency: 'usd',
  publishableKey: 'pk_test_abc',
  returnUrl: 'https://example.com/checkout/return',
};

describe('PaymentForm', () => {
  it('creates the intent before mounting the Stripe Elements provider', async () => {
    render(<PaymentForm {...baseProps} />);
    // The Elements provider must receive a `clientSecret` option that
    // came back from the intent mutation. Mounting without one is the
    // bug we're guarding against.
    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith({ eventId: 'evt-1' });
      expect(mockElementsSpy).toHaveBeenCalled();
      const options = mockElementsSpy.mock.calls[0]?.[0] as { clientSecret: string };
      expect(options.clientSecret).toBe('pi_test_secret_xyz');
    });
    expect(screen.getByTestId('payment-form')).toBeInTheDocument();
    expect(screen.getByTestId('payment-element')).toBeInTheDocument();
  });

  it('shows a loading state until the intent resolves', () => {
    intentOutcome = { isPending: true };
    render(<PaymentForm {...baseProps} />);
    expect(screen.getByTestId('payment-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('payment-form')).not.toBeInTheDocument();
  });

  it('surfaces a retryable error when the intent fails', async () => {
    intentOutcome = { error: new Error('Stripe is down'), isError: true };
    render(<PaymentForm {...baseProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('payment-error')).toHaveTextContent(/stripe is down/i);
    });
    expect(screen.queryByTestId('payment-form')).not.toBeInTheDocument();
  });

  it('locks the submit button while submitting', async () => {
    render(<PaymentForm {...baseProps} />);
    await waitFor(() => screen.getByTestId('payment-form'));
    const submit = screen.getByRole('button', { name: /pay \$10\.00/i });
    expect(submit).not.toBeDisabled();
    fireEvent.click(submit);
    await waitFor(() => expect(submit).toHaveTextContent(/processing/i));
  });

  it('confirms payment inline with redirect: if_required so 3DS stays on the page', async () => {
    const onSuccess = vi.fn();
    render(<PaymentForm {...baseProps} onSuccess={onSuccess} />);
    await waitFor(() => screen.getByTestId('payment-form'));
    fireEvent.click(screen.getByRole('button', { name: /pay \$10\.00/i }));
    await waitFor(() => expect(mockConfirmPayment).toHaveBeenCalledTimes(1));
    const options = mockConfirmPayment.mock.calls[0]?.[0] as {
      redirect?: string;
      confirmParams?: { return_url?: string };
    };
    // Without `redirect: 'if_required'`, Stripe.js defaults to
    // `'always'` and navigates the browser to `return_url` after a
    // successful confirmation, which tears the user off the page
    // and breaks the dynamic in-place update.
    expect(options.redirect).toBe('if_required');
    expect(options.confirmParams?.return_url).toBe(baseProps.returnUrl);
    await waitFor(() =>
      expect(onSuccess).toHaveBeenCalledWith({ status: 'succeeded', id: undefined }),
    );
  });

  it('surfaces Stripe errors inline without navigating away', async () => {
    mockConfirmPayment.mockResolvedValueOnce({ error: { message: 'Your card was declined.' } });
    render(<PaymentForm {...baseProps} />);
    await waitFor(() => screen.getByTestId('payment-form'));
    fireEvent.click(screen.getByRole('button', { name: /pay \$10\.00/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/card was declined/i));
    expect(mockConfirmPayment).toHaveBeenCalledTimes(1);
  });

  it('only fires createPaymentIntent once even if the setup effect re-runs (StrictMode dev double-mount)', async () => {
    render(<PaymentForm {...baseProps} />);
    // Wait long enough for a StrictMode double-mount to settle. The
    // bug we're guarding against is two `mutate()` calls when React
    // simulates a remount in dev mode.
    await waitFor(() => screen.getByTestId('payment-form'));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(mockMutate).toHaveBeenCalledWith({ eventId: 'evt-1' });
  });

  it('freezes the clientSecret on the first intent so a second concurrent response cannot switch Elements mid-flight', async () => {
    // Simulates the failure mode where tRPC somehow delivers two
    // distinct `createPaymentIntent` responses for the same component
    // instance. Without the freeze, <Elements> would receive
    // `clientSecret` as an updated prop and Stripe.js would throw
    // "Could not retrieve elements store" / "PaymentIntent is in a
    // terminal state". With the freeze, only the first response wins.
    intentSecretQueue.push('pi_first_secret', 'pi_second_secret');
    render(<PaymentForm {...baseProps} />);
    await waitFor(() => screen.getByTestId('payment-form'));
    const options = mockElementsSpy.mock.calls.at(-1)?.[0] as { clientSecret: string };
    expect(options.clientSecret).toBe('pi_first_secret');
  });
});
