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
  const { initialChoice = null, onChoiceChange, ...rest } = props;
  const [choice, setChoice] = useState<PaymentChoice>(initialChoice);
  return (
    <PaymentBlock
      {...rest}
      choice={choice}
      onChoiceChange={(next) => {
        setChoice(next);
        onChoiceChange?.(next);
      }}
    />
  );
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

  it('invalidates the registration cache when the inline form succeeds', async () => {
    const onChoiceChange = vi.fn();
    render(<PaymentBlock {...baseProps} choice="payNow" onChoiceChange={onChoiceChange} />);
    await waitFor(() => screen.getByTestId('mock-payment-form'));
    fireEvent.click(screen.getByTestId('mock-payment-form-complete'));
    await waitFor(() => {
      expect(mockInvalidate).toHaveBeenCalledWith({ eventId: 'evt-1' });
    });
    // FPP-124: handlePaid no longer fires `onChoiceChange(null)` itself.
    // The block holds a sticky "Payment received" panel until the
    // cache refetch lands a PAID status, then a useEffect clears the
    // choice. That keeps the user from seeing a stale "Pay $X" button
    // between Stripe's confirmation and the webhook that flips the
    // registration status.
    expect(onChoiceChange).not.toHaveBeenCalled();
  });

  it('clears the local choice once the cache refetch drops outstanding to zero', async () => {
    const onChoiceChange = vi.fn();
    const { rerender } = render(
      <ControlledPaymentBlock
        {...baseProps}
        amountCents={1500}
        onChoiceChange={onChoiceChange}
        registration={{
          status: 'PAID',
          amountCents: 500,
          currency: 'usd',
          netPaidCents: 500,
        }}
      />,
    );
    fireEvent.click(screen.getByTestId('rsvp-payment-pay-now'));
    await waitFor(() => screen.getByTestId('mock-payment-form'));
    // Stripe confirms → handlePaid flips us into the processing panel.
    fireEvent.click(screen.getByTestId('mock-payment-form-complete'));
    await waitFor(() => {
      expect(screen.getByTestId('rsvp-payment-processing')).toBeInTheDocument();
    });
    // The wrapper already fired onChoiceChange('payNow') when the
    // user clicked Pay; handlePaid itself does not clear the choice
    // — that only happens once the cache refetch reflects the
    // reflected payment.
    expect(onChoiceChange).not.toHaveBeenCalledWith(null);
    // Webhook lands → cache invalidation re-renders with the new
    // SUCCEEDED charge reflected in netPaidCents, outstanding drops
    // to zero, the processing panel clears, and the Paid badge takes
    // over.
    rerender(
      <ControlledPaymentBlock
        {...baseProps}
        amountCents={1500}
        onChoiceChange={onChoiceChange}
        registration={{
          status: 'PAID',
          amountCents: 1500,
          currency: 'usd',
          netPaidCents: 1500,
        }}
      />,
    );
    await waitFor(() => {
      expect(screen.getByTestId('rsvp-payment-paid-badge')).toBeInTheDocument();
      expect(screen.queryByTestId('rsvp-payment-processing')).not.toBeInTheDocument();
      expect(onChoiceChange).toHaveBeenCalledWith(null);
    });
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

  // FPP-124: when the live fee has grown (user added attendees, admin
  // raised the per-attendee fee) but the registration is already PAID,
  // surface the outstanding balance instead of collapsing to the Paid
  // badge so the user can settle up.
  it('shows an Amount due block when a PAID registration is behind on payments', () => {
    render(
      <PaymentBlock
        {...baseProps}
        amountCents={2500}
        breakdown={{ qualifyingAttendees: 2, perAttendeeCents: 500 }}
        registration={{
          status: 'PAID',
          amountCents: 500,
          currency: 'usd',
          netPaidCents: 500,
        }}
      />,
    );
    expect(screen.getByTestId('rsvp-payment-amount-due-badge')).toHaveTextContent(/balance owed/i);
    expect(screen.getByText(/amount due: \$20\.00/i)).toBeInTheDocument();
    // Per-attendee breakdown appears in the explanation paragraph.
    expect(screen.getByText(/paid so far: \$5\.00/i)).toBeInTheDocument();
    expect(screen.getByText(/2 attendees at \$5\.00/i)).toBeInTheDocument();
    // The Pay now button is offered and charges the delta, not the
    // full live fee, so a top-up does not over-collect.
    const payNow = screen.getByTestId('rsvp-payment-pay-now');
    expect(payNow).toBeInTheDocument();
    expect(payNow).toHaveTextContent(/pay \$20\.00/i);
    // The deferred button is suppressed — there is nothing to defer.
    expect(screen.queryByTestId('rsvp-payment-pay-later')).not.toBeInTheDocument();
  });

  it('mounts the inline payment form for the outstanding delta when Pay now is clicked', async () => {
    render(
      <ControlledPaymentBlock
        {...baseProps}
        amountCents={1500}
        registration={{
          status: 'PAID',
          amountCents: 500,
          currency: 'usd',
          netPaidCents: 500,
        }}
      />,
    );
    fireEvent.click(screen.getByTestId('rsvp-payment-pay-now'));
    await waitFor(() => {
      expect(screen.getByTestId('mock-payment-form')).toBeInTheDocument();
    });
  });

  // FPP-124: when Stripe confirms a top-up client-side but the
  // webhook that flips Registration.status to PAID hasn't landed yet,
  // the block must not collapse back to the Pay button. Otherwise
  // the user retries on what looks like a stale UI.
  it('shows a sticky Payment received panel while the webhook confirms the top-up', async () => {
    const { rerender } = render(
      <ControlledPaymentBlock
        {...baseProps}
        amountCents={1500}
        registration={{
          status: 'PAID',
          amountCents: 500,
          currency: 'usd',
          netPaidCents: 500,
        }}
      />,
    );
    fireEvent.click(screen.getByTestId('rsvp-payment-pay-now'));
    await waitFor(() => screen.getByTestId('mock-payment-form'));
    // Stripe confirms → handlePaid flips us into the processing panel.
    fireEvent.click(screen.getByTestId('mock-payment-form-complete'));
    await waitFor(() => {
      expect(screen.getByTestId('rsvp-payment-processing')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('rsvp-payment-pay-now')).not.toBeInTheDocument();
    expect(screen.getByText(/payment received/i)).toBeInTheDocument();
    // Webhook lands → cache invalidation re-renders with the new
    // SUCCEEDED charge reflected in netPaidCents, outstanding drops
    // to zero, the processing panel clears, and the Paid badge takes
    // over.
    rerender(
      <ControlledPaymentBlock
        {...baseProps}
        amountCents={1500}
        registration={{
          status: 'PAID',
          amountCents: 1500,
          currency: 'usd',
          netPaidCents: 1500,
        }}
      />,
    );
    expect(screen.getByTestId('rsvp-payment-paid-badge')).toBeInTheDocument();
    expect(screen.queryByTestId('rsvp-payment-processing')).not.toBeInTheDocument();
  });

  it('notes the overpayment when the user has paid more than the live fee', () => {
    render(
      <PaymentBlock
        {...baseProps}
        amountCents={500}
        registration={{
          status: 'PAID',
          amountCents: 1500,
          currency: 'usd',
          netPaidCents: 1500,
        }}
      />,
    );
    expect(screen.getByTestId('rsvp-payment-paid-badge')).toHaveTextContent(/paid/i);
    const note = screen.getByTestId('rsvp-payment-overpaid-note');
    expect(note).toHaveTextContent(/paid \$10\.00 more/i);
    expect(note).toHaveTextContent(/refund/i);
    // No outstanding balance, so no Pay button.
    expect(screen.queryByTestId('rsvp-payment-pay-now')).not.toBeInTheDocument();
  });

  // FPP-124: the server-side fee is computed from the saved RSVP
  // roster, so paying before the user commits their attendance
  // changes would either under-charge or trip the "already
  // registered" guard. The block swaps the Pay button for a
  // hint that points at the surrounding Save control.
  it('replaces the Pay button with a save-first hint when payRequiresSave is set', () => {
    render(
      <PaymentBlock
        {...baseProps}
        amountCents={1500}
        registration={{
          status: 'PAID',
          amountCents: 500,
          currency: 'usd',
          netPaidCents: 500,
        }}
        payRequiresSave
      />,
    );
    expect(screen.getByTestId('rsvp-payment-amount-due-badge')).toHaveTextContent(/balance owed/i);
    expect(screen.getByTestId('rsvp-payment-save-first-hint')).toHaveTextContent(
      /save your attendance changes first/i,
    );
    expect(screen.queryByTestId('rsvp-payment-pay-now')).not.toBeInTheDocument();
    expect(screen.queryByTestId('rsvp-payment-form-wrapper')).not.toBeInTheDocument();
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
