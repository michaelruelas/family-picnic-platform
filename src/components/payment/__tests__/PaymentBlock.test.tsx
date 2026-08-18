import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { PaymentChoice } from '../PaymentBlock';

const mockMutateAsync = vi.fn();
const mockInvalidate = vi.fn();
const mockUseUtils = vi.fn(() => ({
  payment: {
    payLater: { invalidate: mockInvalidate },
    getMyRegistration: { invalidate: mockInvalidate },
  },
}));

type PaymentMutationOptions = {
  onSuccess?: (data: unknown) => void;
  onError?: (err: Error) => void;
};

const mockPublishableKey = vi.fn(() => ({ publishableKey: 'pk_test_abc' }));

const mockPayment = {
  payLater: {
    useMutation: vi.fn((opts: PaymentMutationOptions) => ({
      mutate: (input: { eventId: string }) => {
        opts?.onSuccess?.({ changed: true, status: 'PENDING' });
        return mockMutateAsync(input);
      },
      isPending: false,
    })),
  },
  getPublishableKey: {
    useQuery: () => ({ data: mockPublishableKey(), isLoading: false, error: null }),
  },
};

vi.mock('~/lib/trpc-client', () => ({
  trpc: {
    payment: mockPayment,
    useUtils: mockUseUtils,
  },
}));

// The PaymentBlock mounts the real PaymentForm on Pay now. The form
// pulls in Stripe.js; isolate it with a stub that surfaces a clear
// affordance for the test (so we can assert "form expanded") without
// pulling in real Stripe.
vi.mock('../PaymentForm', () => ({
  default: (props: {
    eventId: string;
    returnUrl?: string;
    onSuccess?: (intent: { status: string }) => void;
  }) => (
    <div
      data-testid="mock-payment-form"
      data-event-id={props.eventId}
      data-return-url={props.returnUrl ?? ''}
    >
      <button
        type="button"
        data-testid="mock-payment-form-complete"
        onClick={() => props.onSuccess?.({ status: 'succeeded' })}
      >
        Complete payment
      </button>
    </div>
  ),
}));

const { default: PaymentBlock } = await import('../PaymentBlock');

beforeEach(() => {
  mockMutateAsync.mockReset();
  mockMutateAsync.mockResolvedValue({ changed: true, status: 'PENDING' });
  mockPayment.payLater.useMutation.mockClear();
  mockInvalidate.mockReset();
  mockInvalidate.mockResolvedValue(undefined);
  mockPublishableKey.mockClear();
  mockPublishableKey.mockReturnValue({ publishableKey: 'pk_test_abc' });
});

const baseProps = {
  eventId: 'evt-1',
  eventName: 'Annual Picnic',
  amountCents: 2500,
  currency: 'usd',
  registration: null,
};

/**
 * Wraps the block so the test can drive the `choice` prop through
 * `onChoiceChange`. The block treats choice as controlled input; we
 * keep our own mirror so tests can flip it just like the real
 * RsvpBottomSheet does.
 */
function ControlledPaymentBlock(
  props: React.ComponentProps<typeof PaymentBlock> & { initialChoice?: PaymentChoice },
) {
  const { initialChoice = null, onChoiceChange: _ignored, ...rest } = props;
  const [choice, setChoice] = useState<PaymentChoice>(initialChoice);
  return <PaymentBlock {...rest} choice={choice} onChoiceChange={setChoice} />;
}

describe('PaymentBlock', () => {
  it('renders the fee, a Pay now button, and a Pay later link', () => {
    render(<PaymentBlock {...baseProps} />);
    expect(screen.getByText(/registration fee: \$25\.00/i)).toBeInTheDocument();
    const payNow = screen.getByTestId('rsvp-payment-pay-now');
    expect(payNow).toBeInTheDocument();
    expect(screen.getByTestId('rsvp-payment-pay-later')).toBeInTheDocument();
  });

  it('renders the per-attendee breakdown when provided', () => {
    render(
      <PaymentBlock
        {...baseProps}
        amountCents={1000}
        breakdown={{ qualifyingAttendees: 2, perAttendeeCents: 500 }}
      />,
    );
    expect(screen.getByText(/registration fee: \$10\.00/i)).toBeInTheDocument();
    expect(screen.getByText(/2 attendees at \$5\.00/i)).toBeInTheDocument();
  });

  it('calls the payLater mutation when the link is clicked', async () => {
    render(<ControlledPaymentBlock {...baseProps} />);
    fireEvent.click(screen.getByTestId('rsvp-payment-pay-later'));
    await waitFor(() => {
      expect(mockPayment.payLater.useMutation).toHaveBeenCalled();
      expect(mockMutateAsync).toHaveBeenCalledWith({ eventId: 'evt-1' });
    });
  });

  it('replaces the Pay now button with a "Saved — pay later" badge after success', async () => {
    render(<ControlledPaymentBlock {...baseProps} />);
    fireEvent.click(screen.getByTestId('rsvp-payment-pay-later'));
    await waitFor(() => {
      expect(screen.getByTestId('rsvp-payment-deferred')).toHaveTextContent(/saved.*pay later/i);
      expect(screen.queryByTestId('rsvp-payment-pay-now')).not.toBeInTheDocument();
    });
  });

  it('expands the inline payment form when Pay now is clicked instead of navigating away', async () => {
    render(<ControlledPaymentBlock {...baseProps} />);
    fireEvent.click(screen.getByTestId('rsvp-payment-pay-now'));
    await waitFor(() => {
      expect(screen.getByTestId('mock-payment-form')).toBeInTheDocument();
      expect(screen.getByTestId('mock-payment-form')).toHaveAttribute('data-event-id', 'evt-1');
    });
    // The Pay later link is hidden while the form is showing so the
    // user is committed to one path at a time.
    expect(screen.queryByTestId('rsvp-payment-pay-later')).not.toBeInTheDocument();
  });

  it('passes an absolute return URL to the inline payment form (Stripe rejects paths)', async () => {
    vi.stubEnv('NEXTAUTH_URL', 'https://family-picnic.example.com');
    try {
      render(<PaymentBlock {...baseProps} choice="payNow" onChoiceChange={() => {}} />);
      await waitFor(() => screen.getByTestId('mock-payment-form'));
      expect(screen.getByTestId('mock-payment-form')).toHaveAttribute(
        'data-return-url',
        'https://family-picnic.example.com/events/evt-1/checkout/return',
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('invalidates the registration cache and clears the local choice when the inline form succeeds', async () => {
    const onChoiceChange = vi.fn();
    render(<PaymentBlock {...baseProps} choice="payNow" onChoiceChange={onChoiceChange} />);
    await waitFor(() => screen.getByTestId('mock-payment-form'));
    fireEvent.click(screen.getByTestId('mock-payment-form-complete'));
    await waitFor(() => {
      expect(mockInvalidate).toHaveBeenCalledWith({ eventId: 'evt-1' });
    });
    // The Paid badge is sourced from the registration prop, not the
    // local choice. The block fires `onChoiceChange(null)` to clear
    // the now-stale "payNow" so the parent's derived `isPaid` from
    // the re-fetched registration is the source of truth.
    expect(onChoiceChange).toHaveBeenCalledWith(null);
  });

  it('lets the user back out of the inline form via the cancel link', async () => {
    const onChoiceChange = vi.fn();
    render(<PaymentBlock {...baseProps} choice="payNow" onChoiceChange={onChoiceChange} />);
    await waitFor(() => screen.getByTestId('mock-payment-form'));
    fireEvent.click(screen.getByTestId('rsvp-payment-cancel-form'));
    expect(onChoiceChange).toHaveBeenCalledWith(null);
  });

  it('lets the user back out of Pay later via a cancel link', async () => {
    render(<ControlledPaymentBlock {...baseProps} initialChoice="payLater" />);
    expect(screen.getByTestId('rsvp-payment-deferred')).toHaveTextContent(/saved.*pay later/i);
    fireEvent.click(screen.getByTestId('rsvp-payment-cancel-deferred'));
    // The badge is gone once the controlled wrapper flips choice
    // back to null and the block re-renders into choose mode.
    await waitFor(() => {
      expect(screen.queryByTestId('rsvp-payment-deferred')).not.toBeInTheDocument();
      expect(screen.getByTestId('rsvp-payment-pay-now')).toBeInTheDocument();
      expect(screen.getByTestId('rsvp-payment-pay-later')).toBeInTheDocument();
    });
  });

  it('renders a paid badge and no buttons when the registration is already PAID', () => {
    render(
      <PaymentBlock
        {...baseProps}
        registration={{ status: 'PAID', amountCents: 2500, currency: 'usd' }}
      />,
    );
    expect(screen.getByTestId('rsvp-payment-paid-badge')).toHaveTextContent(/paid/i);
    expect(screen.queryByTestId('rsvp-payment-pay-now')).not.toBeInTheDocument();
    expect(screen.queryByTestId('rsvp-payment-pay-later')).not.toBeInTheDocument();
  });

  it('does not ask to pay when the registration is already PAID, even after reopening the sheet', () => {
    const { rerender } = render(
      <PaymentBlock
        {...baseProps}
        registration={{ status: 'PAID', amountCents: 2500, currency: 'usd' }}
      />,
    );
    expect(screen.getByTestId('rsvp-payment-paid-badge')).toBeInTheDocument();
    // Re-render (simulating a sheet reopen) — the badge still shows
    // and the buttons still do not.
    rerender(
      <PaymentBlock
        {...baseProps}
        registration={{ status: 'PAID', amountCents: 2500, currency: 'usd' }}
      />,
    );
    expect(screen.getByTestId('rsvp-payment-paid-badge')).toBeInTheDocument();
    expect(screen.queryByTestId('rsvp-payment-pay-now')).not.toBeInTheDocument();
  });

  it('surfaces a server error from payLater', async () => {
    mockPayment.payLater.useMutation.mockImplementationOnce((opts: PaymentMutationOptions) => ({
      mutate: () => {
        opts?.onError?.(new Error('Payments are offline'));
      },
      isPending: false,
    }));
    render(<PaymentBlock {...baseProps} />);
    fireEvent.click(screen.getByTestId('rsvp-payment-pay-later'));
    await waitFor(() => {
      expect(screen.getByTestId('rsvp-payment-error')).toHaveTextContent(/payments are offline/i);
    });
  });
});
