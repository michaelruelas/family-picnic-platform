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
        existingRsvp={{ status: 'CONFIRMED', headcount: 3, dietaryNotes: null }}
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
        existingRsvp={{ status: 'CONFIRMED', headcount: 2, dietaryNotes: 'vegetarian' }}
      />,
    );

    expect(screen.getByDisplayValue('vegetarian')).toBeInTheDocument();
    expect(screen.queryByText(/\+ Add a dietary note/i)).not.toBeInTheDocument();
  });

  it('shows confirm copy and 1 adult when existing RSVP is DECLINED', () => {
    render(
      <RsvpBottomSheet
        {...defaultProps}
        existingRsvp={{ status: 'DECLINED', headcount: 0, dietaryNotes: null }}
      />,
    );

    expect(screen.getByRole('heading', { name: /who's coming/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm 1 guest/i })).toBeInTheDocument();
  });

  it('falls back to 1 adult when existing RSVP headcount is 0', () => {
    render(
      <RsvpBottomSheet
        {...defaultProps}
        existingRsvp={{ status: 'CONFIRMED', headcount: 0, dietaryNotes: null }}
      />,
    );

    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('sends confirm mutation with total headcount = adults + kids', async () => {
    render(
      <RsvpBottomSheet
        {...defaultProps}
        existingRsvp={{ status: 'CONFIRMED', headcount: 2, dietaryNotes: 'vegan' }}
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
          existingRsvp={{ status: 'CONFIRMED', headcount: 2, dietaryNotes: 'vegan' }}
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
          existingRsvp={{ status: 'CONFIRMED', headcount: 2, dietaryNotes: 'vegan' }}
        />,
      );

      act(() => {
        vi.advanceTimersByTime(250);
      });

      rerender(
        <RsvpBottomSheet
          {...defaultProps}
          isOpen={true}
          existingRsvp={{ status: 'CONFIRMED', headcount: 2, dietaryNotes: 'vegan' }}
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
        existingRsvp={{ status: 'WAITLISTED', headcount: 2, dietaryNotes: null }}
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
        existingRsvp={{ status: 'WAITLISTED', headcount: 2, dietaryNotes: null }}
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
        existingRsvp={{ status: 'CONFIRMED', headcount: 5, dietaryNotes: 'vegan' }}
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
          existingRsvp={{ status: 'CONFIRMED', headcount: 2, dietaryNotes: 'vegan' }}
        />,
      );

      const adultsPlus = screen.getByRole('button', { name: /increase adults/i });
      fireEvent.click(adultsPlus);
      expect(screen.getByText('3')).toBeInTheDocument();

      rerender(
        <RsvpBottomSheet
          {...defaultProps}
          isOpen={false}
          existingRsvp={{ status: 'CONFIRMED', headcount: 2, dietaryNotes: 'vegan' }}
        />,
      );

      act(() => {
        vi.advanceTimersByTime(100);
      });

      rerender(
        <RsvpBottomSheet
          {...defaultProps}
          isOpen={true}
          existingRsvp={{ status: 'CONFIRMED', headcount: 2, dietaryNotes: 'vegan' }}
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
});
