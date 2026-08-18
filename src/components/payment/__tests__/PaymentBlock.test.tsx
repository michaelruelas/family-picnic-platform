import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockMutateAsync = vi.fn();
const mockUseUtils = vi.fn(() => ({
  payment: {
    payLater: { invalidate: vi.fn() },
  },
}));

type PaymentMutationOptions = {
  onSuccess?: (data: unknown) => void;
  onError?: (err: Error) => void;
};

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
};

vi.mock('~/lib/trpc-client', () => ({
  trpc: {
    payment: mockPayment,
    useUtils: mockUseUtils,
  },
}));

const { default: PaymentBlock } = await import('../PaymentBlock');

beforeEach(() => {
  mockMutateAsync.mockReset();
  mockMutateAsync.mockResolvedValue({ changed: true, status: 'PENDING' });
  mockPayment.payLater.useMutation.mockClear();
});

describe('PaymentBlock', () => {
  it('renders the fee, Pay now link, and Pay later button', () => {
    render(
      <PaymentBlock
        eventId="evt-1"
        eventName="Annual Picnic"
        amountCents={2500}
        currency="usd"
      />,
    );
    expect(screen.getByText(/registration fee: \$25\.00/i)).toBeInTheDocument();
    const payNow = screen.getByTestId('rsvp-payment-pay-now');
    expect(payNow).toHaveAttribute('href', '/events/evt-1/checkout');
    expect(screen.getByTestId('rsvp-payment-pay-later')).toBeInTheDocument();
  });

  it('calls the payLater mutation when the button is clicked', async () => {
    render(
      <PaymentBlock
        eventId="evt-1"
        eventName="Annual Picnic"
        amountCents={2500}
        currency="usd"
      />,
    );
    fireEvent.click(screen.getByTestId('rsvp-payment-pay-later'));
    await waitFor(() => {
      expect(mockPayment.payLater.useMutation).toHaveBeenCalled();
      expect(mockMutateAsync).toHaveBeenCalledWith({ eventId: 'evt-1' });
    });
  });

  it('locks the button after a successful payLater response', async () => {
    render(
      <PaymentBlock
        eventId="evt-1"
        eventName="Annual Picnic"
        amountCents={2500}
        currency="usd"
      />,
    );
    fireEvent.click(screen.getByTestId('rsvp-payment-pay-later'));
    await waitFor(() => {
      const btn = screen.getByTestId('rsvp-payment-pay-later');
      expect(btn).toBeDisabled();
      expect(btn).toHaveTextContent(/saved.*pay later/i);
    });
  });

  it('surfaces a server error', async () => {
    mockPayment.payLater.useMutation.mockImplementationOnce(
      (opts: PaymentMutationOptions) => ({
        mutate: () => {
          opts?.onError?.(new Error('Payments are offline'));
        },
        isPending: false,
      }),
    );
    render(
      <PaymentBlock
        eventId="evt-1"
        eventName="Annual Picnic"
        amountCents={2500}
        currency="usd"
      />,
    );
    fireEvent.click(screen.getByTestId('rsvp-payment-pay-later'));
    await waitFor(() => {
      expect(screen.getByTestId('rsvp-payment-error')).toHaveTextContent(/payments are offline/i);
    });
  });

  it('switches Pay now to a button when onPayNow is provided', () => {
    const onPayNow = vi.fn();
    render(
      <PaymentBlock
        eventId="evt-1"
        eventName="Annual Picnic"
        amountCents={2500}
        currency="usd"
        onPayNow={onPayNow}
      />,
    );
    const payNow = screen.getByTestId('rsvp-payment-pay-now');
    expect(payNow.tagName).toBe('BUTTON');
    expect(payNow).not.toHaveAttribute('href');
    fireEvent.click(payNow);
    expect(onPayNow).toHaveBeenCalledTimes(1);
  });

  it('invokes onPayLater only after the mutation succeeds', async () => {
    const onPayLater = vi.fn();
    render(
      <PaymentBlock
        eventId="evt-1"
        eventName="Annual Picnic"
        amountCents={2500}
        currency="usd"
        onPayLater={onPayLater}
      />,
    );
    fireEvent.click(screen.getByTestId('rsvp-payment-pay-later'));
    await waitFor(() => {
      expect(onPayLater).toHaveBeenCalledTimes(1);
    });
  });
});