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
  it('renders the fee, a Pay now button, and a Pay later link', () => {
    render(<PaymentBlock eventId="evt-1" amountCents={2500} currency="usd" />);
    expect(screen.getByText(/registration fee: \$25\.00/i)).toBeInTheDocument();
    const payNow = screen.getByTestId('rsvp-payment-pay-now');
    expect(payNow).toBeInTheDocument();
    expect(screen.getByTestId('rsvp-payment-pay-later')).toBeInTheDocument();
  });

  it('calls the payLater mutation when the link is clicked', async () => {
    render(<PaymentBlock eventId="evt-1" amountCents={2500} currency="usd" />);
    fireEvent.click(screen.getByTestId('rsvp-payment-pay-later'));
    await waitFor(() => {
      expect(mockPayment.payLater.useMutation).toHaveBeenCalled();
      expect(mockMutateAsync).toHaveBeenCalledWith({ eventId: 'evt-1' });
    });
  });

  it('replaces the Pay later link with a "Saved — pay later" badge after success', async () => {
    render(<PaymentBlock eventId="evt-1" amountCents={2500} currency="usd" />);
    fireEvent.click(screen.getByTestId('rsvp-payment-pay-later'));
    await waitFor(() => {
      expect(screen.getByTestId('rsvp-payment-deferred')).toHaveTextContent(/saved.*pay later/i);
      expect(screen.queryByTestId('rsvp-payment-pay-now')).not.toBeInTheDocument();
    });
  });

  it('hides Pay later once Pay now is selected', async () => {
    const onPayNow = vi.fn();
    render(<PaymentBlock eventId="evt-1" amountCents={2500} currency="usd" onPayNow={onPayNow} />);
    fireEvent.click(screen.getByTestId('rsvp-payment-pay-now'));
    await waitFor(() => {
      expect(screen.queryByTestId('rsvp-payment-pay-later')).not.toBeInTheDocument();
    });
    expect(onPayNow).toHaveBeenCalledTimes(1);
  });

  it('surfaces a server error from payLater', async () => {
    mockPayment.payLater.useMutation.mockImplementationOnce((opts: PaymentMutationOptions) => ({
      mutate: () => {
        opts?.onError?.(new Error('Payments are offline'));
      },
      isPending: false,
    }));
    render(<PaymentBlock eventId="evt-1" amountCents={2500} currency="usd" />);
    fireEvent.click(screen.getByTestId('rsvp-payment-pay-later'));
    await waitFor(() => {
      expect(screen.getByTestId('rsvp-payment-error')).toHaveTextContent(/payments are offline/i);
    });
  });
});
