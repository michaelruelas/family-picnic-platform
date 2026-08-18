import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SlotType } from '~/lib/generated/enums';

const mockSignup = { mutate: vi.fn(), isPending: false };
const mockUpdateSignup = { mutate: vi.fn(), isPending: false };
const mockCancelSignup = { mutate: vi.fn(), isPending: false };

vi.mock('~/hooks', () => ({
  usePotluckSignupMutation: () => ({
    signup: mockSignup,
    updateSignup: mockUpdateSignup,
    cancelSignup: mockCancelSignup,
  }),
}));

const { default: PotluckSignupForm } = await import('../PotluckSignupForm');

const baseSlot = {
  id: 's-1',
  name: 'Salad',
  category: 'MAIN',
  slotType: SlotType.UNLIMITED,
  maxSignups: null,
  currentSignups: 0,
  signups: [] as Array<{
    id: string;
    dishName: string;
    servings: number;
    dietaryLabels: string[];
    rsvp: { userId: string };
  }>,
};

beforeEach(() => {
  mockSignup.mutate.mockReset();
  mockUpdateSignup.mutate.mockReset();
  mockCancelSignup.mutate.mockReset();
});

describe('PotluckSignupForm', () => {
  it('renders the slot name in the form', () => {
    render(<PotluckSignupForm slot={baseSlot} userId="u-1" />);
    fireEvent.click(screen.getByRole('button', { name: /sign up/i }));
    expect(screen.getByText(/Sign Up for Salad/)).toBeInTheDocument();
  });

  it('shows sign up button when no existing signup', () => {
    render(<PotluckSignupForm slot={baseSlot} userId="u-1" />);
    expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument();
  });

  it('expands form when sign up is clicked', async () => {
    render(<PotluckSignupForm slot={baseSlot} userId="u-1" />);
    fireEvent.click(screen.getByRole('button', { name: /^sign up$/i }));
    expect(screen.getByPlaceholderText(/what are you bringing/i)).toBeInTheDocument();
  });

  it('submits signup with form data', async () => {
    render(<PotluckSignupForm slot={baseSlot} userId="u-1" />);
    fireEvent.click(screen.getByRole('button', { name: /^sign up$/i }));
    const dishNameInput = await screen.findByPlaceholderText(/what are you bringing/i);
    fireEvent.change(dishNameInput, { target: { value: 'Pasta Salad' } });
    const submitButton = await screen.findByRole('button', { name: /^sign up$/i });
    fireEvent.click(submitButton);
    await waitFor(() => {
      expect(mockSignup.mutate).toHaveBeenCalled();
    });
  });

  it('shows existing signup when user has one', () => {
    const slot = {
      ...baseSlot,
      signups: [
        {
          id: 'ps-1',
          dishName: 'Pasta Salad',
          servings: 4,
          dietaryLabels: ['vegetarian'],
          rsvp: { userId: 'u-1' },
        },
      ],
    };
    render(<PotluckSignupForm slot={slot} userId="u-1" />);
    expect(screen.getByText(/Pasta Salad/i)).toBeInTheDocument();
  });

  it('shows full state for LIMITED slot', () => {
    const slot = {
      ...baseSlot,
      slotType: SlotType.LIMITED,
      maxSignups: 5,
      currentSignups: 5,
    };
    render(<PotluckSignupForm slot={slot} userId="u-1" />);
    expect(screen.getByText(/full/i)).toBeInTheDocument();
  });

  it('cancels existing signup', async () => {
    const slot = {
      ...baseSlot,
      signups: [
        {
          id: 'ps-1',
          dishName: 'Pasta',
          servings: 2,
          dietaryLabels: [],
          rsvp: { userId: 'u-1' },
        },
      ],
    };
    render(<PotluckSignupForm slot={slot} userId="u-1" />);
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    fireEvent.click(screen.getByRole('button', { name: /remove/i }));
    // Multi-claim: cancel targets the signup row by its `id`.
    await waitFor(() => {
      expect(mockCancelSignup.mutate).toHaveBeenCalledWith(
        expect.objectContaining({ signupId: 'ps-1' }),
        expect.any(Object),
      );
    });
  });

  it('returns early when userId is undefined', () => {
    render(<PotluckSignupForm slot={baseSlot} userId={undefined} />);
    expect(screen.getByText(/Sign in to sign up/i)).toBeInTheDocument();
  });

  it('parses dietary labels from comma-separated string', async () => {
    render(<PotluckSignupForm slot={baseSlot} userId="u-1" />);
    fireEvent.click(screen.getByRole('button', { name: /^sign up$/i }));
    const dishNameInput = await screen.findByPlaceholderText(/what are you bringing/i);
    fireEvent.change(dishNameInput, { target: { value: 'Cake' } });
    const dietaryInput = await screen.findByPlaceholderText(/vegetarian, gluten-free/i);
    fireEvent.change(dietaryInput, { target: { value: 'vegan, gluten-free' } });
    const submitButton = await screen.findByRole('button', { name: /^sign up$/i });
    fireEvent.click(submitButton);
    await waitFor(() => {
      expect(mockSignup.mutate).toHaveBeenCalled();
    });
    const call = mockSignup.mutate.mock.calls[0]?.[0];
    expect(call.dietaryLabels).toEqual(['vegan', 'gluten-free']);
  });
});
