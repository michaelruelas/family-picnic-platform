import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

const mockConfirm = { mutateAsync: vi.fn() };
const mockDecline = { mutateAsync: vi.fn() };

vi.mock('~/hooks', () => ({
  useRsvpMutation: () => ({
    confirm: mockConfirm,
    decline: mockDecline,
  }),
}));

vi.mock('react-dom', async () => {
  const actual = await vi.importActual<typeof import('react-dom')>('react-dom');
  return { ...actual, createPortal: (node: React.ReactNode) => node };
});

const { RsvpBottomSheet } = await import('../RsvpBottomSheet');

beforeEach(() => {
  mockConfirm.mutateAsync.mockReset();
  mockDecline.mutateAsync.mockReset();
  mockConfirm.mutateAsync.mockResolvedValue({});
  mockDecline.mutateAsync.mockResolvedValue({});
});

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  eventId: 'evt-1',
  maxCapacity: null,
  currentAttending: 0,
};

describe('RsvpBottomSheet pre-fill', () => {
  it('defaults to 1 adult, 0 kids, empty notes when no existing RSVP', () => {
    render(<RsvpBottomSheet {...defaultProps} />);

    expect(screen.getByRole('heading', { name: /who's coming/i })).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('+ Add a dietary note (optional)')).toBeInTheDocument();
  });

  it('pre-fills adults from existing RSVP headcount and shows update copy when confirmed', () => {
    render(
      <RsvpBottomSheet
        {...defaultProps}
        existingRsvp={{
          status: 'CONFIRMED',
          headcount: 3,
          dietaryNotes: null,
          modifiedAt: '2024-01-01T00:00:00Z',
        }}
      />,
    );

    expect(screen.getByRole('heading', { name: /update your party/i })).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save changes for 3/i })).toBeInTheDocument();
  });

  it('pre-fills dietary notes from existing RSVP and reveals the field', () => {
    render(
      <RsvpBottomSheet
        {...defaultProps}
        existingRsvp={{
          status: 'CONFIRMED',
          headcount: 2,
          dietaryNotes: 'vegetarian',
          modifiedAt: '2024-01-01T00:00:00Z',
        }}
      />,
    );

    expect(screen.getByDisplayValue('vegetarian')).toBeInTheDocument();
    expect(screen.queryByText(/\+ Add a dietary note/i)).not.toBeInTheDocument();
  });

  it('shows confirm copy and 1 adult when existing RSVP is DECLINED', () => {
    render(
      <RsvpBottomSheet
        {...defaultProps}
        existingRsvp={{
          status: 'DECLINED',
          headcount: 0,
          dietaryNotes: null,
          modifiedAt: '2024-01-01T00:00:00Z',
        }}
      />,
    );

    expect(screen.getByRole('heading', { name: /who's coming/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm 1 guest/i })).toBeInTheDocument();
  });

  it('falls back to 1 adult when existing RSVP headcount is 0', () => {
    render(
      <RsvpBottomSheet
        {...defaultProps}
        existingRsvp={{
          status: 'CONFIRMED',
          headcount: 0,
          dietaryNotes: null,
          modifiedAt: '2024-01-01T00:00:00Z',
        }}
      />,
    );

    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('sends confirm mutation with total headcount = adults + kids', async () => {
    render(
      <RsvpBottomSheet
        {...defaultProps}
        existingRsvp={{
          status: 'CONFIRMED',
          headcount: 2,
          dietaryNotes: 'vegan',
          modifiedAt: '2024-01-01T00:00:00Z',
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save changes for 2/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /save changes for 2/i }));

    await waitFor(() => {
      expect(mockConfirm.mutateAsync).toHaveBeenCalledWith({
        eventId: 'evt-1',
        headcount: 2,
        dietaryNotes: 'vegan',
      });
    });
  });

  it('resets form to existing RSVP values after closing', async () => {
    vi.useFakeTimers();
    try {
      const { rerender } = render(
        <RsvpBottomSheet
          {...defaultProps}
          isOpen={true}
          existingRsvp={{
            status: 'CONFIRMED',
            headcount: 2,
            dietaryNotes: 'vegan',
            modifiedAt: '2024-01-01T00:00:00Z',
          }}
        />,
      );

      const adultsPlus = screen.getByRole('button', { name: /increase adults/i });
      fireEvent.click(adultsPlus);
      fireEvent.click(adultsPlus);

      expect(screen.getByText('4')).toBeInTheDocument();

      rerender(
        <RsvpBottomSheet
          {...defaultProps}
          isOpen={false}
          existingRsvp={{
            status: 'CONFIRMED',
            headcount: 2,
            dietaryNotes: 'vegan',
            modifiedAt: '2024-01-01T00:00:00Z',
          }}
        />,
      );

      act(() => {
        vi.advanceTimersByTime(250);
      });

      rerender(
        <RsvpBottomSheet
          {...defaultProps}
          isOpen={true}
          existingRsvp={{
            status: 'CONFIRMED',
            headcount: 2,
            dietaryNotes: 'vegan',
            modifiedAt: '2024-01-01T00:00:00Z',
          }}
        />,
      );

      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByDisplayValue('vegan')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows update copy when existing RSVP is WAITLISTED', () => {
    render(
      <RsvpBottomSheet
        {...defaultProps}
        existingRsvp={{
          status: 'WAITLISTED',
          headcount: 2,
          dietaryNotes: null,
          modifiedAt: '2024-01-01T00:00:00Z',
        }}
      />,
    );

    expect(screen.getByRole('heading', { name: /update your party/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save changes for 2/i })).toBeInTheDocument();
  });

  it('shows update copy when WAITLISTED and event is full', () => {
    render(
      <RsvpBottomSheet
        {...defaultProps}
        maxCapacity={10}
        currentAttending={10}
        existingRsvp={{
          status: 'WAITLISTED',
          headcount: 2,
          dietaryNotes: null,
          modifiedAt: '2024-01-01T00:00:00Z',
        }}
      />,
    );

    expect(screen.getByRole('heading', { name: /update your party/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save changes for 2/i })).toBeInTheDocument();
  });

  it('preserves user input when existingRsvp changes mid-session', () => {
    const { rerender } = render(<RsvpBottomSheet {...defaultProps} existingRsvp={null} />);

    const adultsPlus = screen.getByRole('button', { name: /increase adults/i });
    fireEvent.click(adultsPlus);
    fireEvent.click(adultsPlus);
    expect(screen.getByText('3')).toBeInTheDocument();

    rerender(
      <RsvpBottomSheet
        {...defaultProps}
        existingRsvp={{
          status: 'CONFIRMED',
          headcount: 5,
          dietaryNotes: 'vegan',
          modifiedAt: '2024-01-01T00:00:00Z',
        }}
      />,
    );

    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('vegan')).not.toBeInTheDocument();
    expect(screen.getByText('+ Add a dietary note (optional)')).toBeInTheDocument();
  });

  it('cancels pending reset if sheet is reopened before the 200ms timeout', () => {
    vi.useFakeTimers();
    try {
      const { rerender } = render(
        <RsvpBottomSheet
          {...defaultProps}
          isOpen={true}
          existingRsvp={{
            status: 'CONFIRMED',
            headcount: 2,
            dietaryNotes: 'vegan',
            modifiedAt: '2024-01-01T00:00:00Z',
          }}
        />,
      );

      const adultsPlus = screen.getByRole('button', { name: /increase adults/i });
      fireEvent.click(adultsPlus);
      expect(screen.getByText('3')).toBeInTheDocument();

      rerender(
        <RsvpBottomSheet
          {...defaultProps}
          isOpen={false}
          existingRsvp={{
            status: 'CONFIRMED',
            headcount: 2,
            dietaryNotes: 'vegan',
            modifiedAt: '2024-01-01T00:00:00Z',
          }}
        />,
      );

      act(() => {
        vi.advanceTimersByTime(100);
      });

      rerender(
        <RsvpBottomSheet
          {...defaultProps}
          isOpen={true}
          existingRsvp={{
            status: 'CONFIRMED',
            headcount: 2,
            dietaryNotes: 'vegan',
            modifiedAt: '2024-01-01T00:00:00Z',
          }}
        />,
      );

      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(screen.getByText('3')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows error message and re-enables button when confirm mutation rejects', async () => {
    mockConfirm.mutateAsync.mockRejectedValueOnce(new Error('Network error'));

    render(<RsvpBottomSheet {...defaultProps} />);

    const confirmButton = screen.getByRole('button', { name: /confirm 1 guest/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /confirm 1 guest/i })).not.toBeDisabled();
  });

  it('does not transition to confirmed phase if sheet is closed before mutation resolves', async () => {
    let resolveConfirm: (value: unknown) => void = () => {};
    mockConfirm.mutateAsync.mockImplementationOnce(
      () =>
        new Promise<unknown>((resolve) => {
          resolveConfirm = resolve;
        }),
    );

    const { rerender } = render(<RsvpBottomSheet {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /confirm 1 guest/i }));

    rerender(<RsvpBottomSheet {...defaultProps} isOpen={false} />);

    await act(async () => {
      resolveConfirm({});
    });

    rerender(<RsvpBottomSheet {...defaultProps} isOpen={true} />);

    expect(screen.getByRole('heading', { name: /who's coming/i })).toBeInTheDocument();
    expect(screen.queryByText(/you're on the list/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
  });

  it('surfaces error on next open if mutation rejects after close', async () => {
    let rejectConfirm: (error: Error) => void = () => {};
    mockConfirm.mutateAsync.mockImplementationOnce(
      () =>
        new Promise<unknown>((_, reject) => {
          rejectConfirm = reject;
        }),
    );

    const { rerender } = render(<RsvpBottomSheet {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /confirm 1 guest/i }));

    rerender(<RsvpBottomSheet {...defaultProps} isOpen={false} />);

    await act(async () => {
      rejectConfirm(new Error('Network error'));
    });

    rerender(<RsvpBottomSheet {...defaultProps} isOpen={true} />);

    expect(screen.getByRole('heading', { name: /who's coming/i })).toBeInTheDocument();
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  it('clears pending error after the next open', async () => {
    let rejectConfirm: (error: Error) => void = () => {};
    mockConfirm.mutateAsync.mockImplementationOnce(
      () =>
        new Promise<unknown>((_, reject) => {
          rejectConfirm = reject;
        }),
    );

    const { rerender } = render(<RsvpBottomSheet {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /confirm 1 guest/i }));

    rerender(<RsvpBottomSheet {...defaultProps} isOpen={false} />);

    await act(async () => {
      rejectConfirm(new Error('Network error'));
    });

    rerender(<RsvpBottomSheet {...defaultProps} isOpen={true} />);
    expect(screen.getByText('Network error')).toBeInTheDocument();

    rerender(<RsvpBottomSheet {...defaultProps} isOpen={false} />);
    rerender(<RsvpBottomSheet {...defaultProps} isOpen={true} />);

    expect(screen.queryByText('Network error')).not.toBeInTheDocument();
  });
});
