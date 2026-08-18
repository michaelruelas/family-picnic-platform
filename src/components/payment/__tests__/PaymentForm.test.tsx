import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@stripe/stripe-js', () => ({
  loadStripe: vi.fn(async () => ({})),
}));

const mockElementsSpy = vi.fn();
const mockPaymentElementSpy = vi.fn();

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
    confirmPayment: vi.fn().mockResolvedValue({}),
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
              } else if (intentOutcome.clientSecret) {
                opts?.onSuccess?.({ clientSecret: intentOutcome.clientSecret });
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
  intentOutcome = { clientSecret: 'pi_test_secret_xyz' };
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
});