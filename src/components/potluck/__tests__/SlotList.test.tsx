import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockMySignups: Array<{
  id: string;
  slotId: string;
  dishName: string;
  servings: number;
  dietaryLabels: string[];
  claimedAt: Date;
  slot: { id: string; name: string | null; category: string; slotType: string };
}> = [];

const mockSignup = { mutateAsync: vi.fn(), isPending: false };
const mockUpdateSignup = { mutateAsync: vi.fn(), isPending: false };
const mockCancelSignup = { mutateAsync: vi.fn(), isPending: false };

vi.mock('~/hooks', () => ({
  useMyPotluckSignups: () => ({
    signups: mockMySignups,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  usePotluckSignupMutation: () => ({
    signup: mockSignup,
    updateSignup: mockUpdateSignup,
    cancelSignup: mockCancelSignup,
  }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('react-dom', async () => {
  const actual = await vi.importActual<typeof import('react-dom')>('react-dom');
  return { ...actual, createPortal: (node: React.ReactNode) => node };
});

const { default: SlotList } = await import('../SlotList');

const baseSlots = [
  {
    id: 's-1',
    name: 'Mac and cheese',
    category: 'MAIN',
    slotType: 'UNLIMITED',
    maxSignups: null,
    currentSignups: 0,
    signups: [],
  },
  {
    id: 's-2',
    name: 'Green salad',
    category: 'SIDE',
    slotType: 'LIMITED',
    maxSignups: 2,
    currentSignups: 0,
    signups: [],
  },
  {
    id: 's-3',
    name: 'Brownies',
    category: 'DESSERT',
    slotType: 'LIMITED',
    maxSignups: 2,
    currentSignups: 2,
    signups: [
      {
        id: 'ps-other',
        dishName: 'Lemon bars',
        servings: 1,
        dietaryLabels: [],
        rsvp: { userId: 'u-99', user: { id: 'u-99', name: 'Pat' } },
      },
    ],
  },
];

beforeEach(() => {
  mockMySignups.length = 0;
  mockSignup.mutateAsync.mockReset();
  mockSignup.mutateAsync.mockResolvedValue({});
  mockUpdateSignup.mutateAsync.mockReset();
  mockUpdateSignup.mutateAsync.mockResolvedValue({});
  mockCancelSignup.mutateAsync.mockReset();
  mockCancelSignup.mutateAsync.mockResolvedValue({});
});

describe('SlotList', () => {
  it('groups slots by category and renders headers in display order', () => {
    render(
      <SlotList
        eventId="evt-1"
        slots={baseSlots}
        userId={null}
        hasRsvp={false}
        isRsvpConfirmed={false}
      />,
    );
    const categories = screen.getAllByRole('heading', { level: 3 });
    const labels = categories.map((c) => c.textContent);
    expect(labels[0]).toMatch(/Main Dishes/);
    expect(labels[1]).toMatch(/Side Dishes/);
    expect(labels[2]).toMatch(/Desserts/);
  });

  it('shows a "full" state for LIMITED slots at capacity', () => {
    render(
      <SlotList
        eventId="evt-1"
        slots={baseSlots}
        userId="u-1"
        hasRsvp={true}
        isRsvpConfirmed={true}
      />,
    );
    const fullSlot = screen.getByTestId('potluck-slot-s-3');
    expect(fullSlot.getAttribute('data-slot-full')).toBe('true');
    expect(fullSlot.textContent).toMatch(/full/i);
  });

  it('marks claimed slots with a Yours badge', () => {
    mockMySignups.push({
      id: 'ps-1',
      slotId: 's-1',
      dishName: 'Mac and cheese',
      servings: 1,
      dietaryLabels: [],
      claimedAt: new Date(),
      slot: { id: 's-1', name: 'Mac and cheese', category: 'MAIN', slotType: 'UNLIMITED' },
    });
    render(
      <SlotList
        eventId="evt-1"
        slots={baseSlots}
        userId="u-1"
        hasRsvp={true}
        isRsvpConfirmed={true}
      />,
    );
    const claimed = screen.getByTestId('potluck-slot-s-1');
    expect(claimed.getAttribute('data-slot-mine')).toBe('true');
    expect(screen.getAllByTestId('yours-badge')).toHaveLength(1);
  });

  it('disables claim when the user is not confirmed', () => {
    render(
      <SlotList
        eventId="evt-1"
        slots={baseSlots}
        userId="u-1"
        hasRsvp={true}
        isRsvpConfirmed={false}
      />,
    );
    const claim = screen.getByTestId('potluck-claim-s-1');
    expect(claim).toBeDisabled();
  });

  it('opens the claim modal and submits a new dish', async () => {
    render(
      <SlotList
        eventId="evt-1"
        slots={baseSlots}
        userId="u-1"
        hasRsvp={true}
        isRsvpConfirmed={true}
      />,
    );
    fireEvent.click(screen.getByTestId('potluck-claim-s-1'));
    const input = await screen.findByTestId('potluck-claim-dish-input');
    fireEvent.change(input, { target: { value: 'Pasta salad' } });
    fireEvent.click(screen.getByTestId('potluck-claim-submit'));
    await waitFor(() => {
      expect(mockSignup.mutateAsync).toHaveBeenCalledWith({
        slotId: 's-1',
        dishName: 'Pasta salad',
        servings: 1,
        dietaryLabels: [],
      });
    });
  });

  it('allows submitting with an empty dish name', async () => {
    render(
      <SlotList
        eventId="evt-1"
        slots={baseSlots}
        userId="u-1"
        hasRsvp={true}
        isRsvpConfirmed={true}
      />,
    );
    fireEvent.click(screen.getByTestId('potluck-claim-s-1'));
    fireEvent.click(await screen.findByTestId('potluck-claim-submit'));
    await waitFor(() => {
      expect(mockSignup.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ dishName: '' }),
      );
    });
  });

  it('updates an existing signup when the user re-opens the modal', async () => {
    mockMySignups.push({
      id: 'ps-1',
      slotId: 's-1',
      dishName: 'Mac and cheese',
      servings: 1,
      dietaryLabels: [],
      claimedAt: new Date(),
      slot: { id: 's-1', name: 'Mac and cheese', category: 'MAIN', slotType: 'UNLIMITED' },
    });
    render(
      <SlotList
        eventId="evt-1"
        slots={baseSlots}
        userId="u-1"
        hasRsvp={true}
        isRsvpConfirmed={true}
      />,
    );
    fireEvent.click(screen.getByTestId('potluck-edit-s-1'));
    const input = await screen.findByTestId('potluck-claim-dish-input');
    expect(input).toHaveValue('Mac and cheese');
    fireEvent.change(input, { target: { value: 'Spicy mac and cheese' } });
    fireEvent.click(screen.getByTestId('potluck-claim-submit'));
    await waitFor(() => {
      expect(mockUpdateSignup.mutateAsync).toHaveBeenCalledWith({
        slotId: 's-1',
        dishName: 'Spicy mac and cheese',
        servings: 1,
        dietaryLabels: [],
      });
    });
  });

  it('drops a claimed slot when the drop button is clicked', async () => {
    mockMySignups.push({
      id: 'ps-1',
      slotId: 's-1',
      dishName: 'Mac and cheese',
      servings: 1,
      dietaryLabels: [],
      claimedAt: new Date(),
      slot: { id: 's-1', name: 'Mac and cheese', category: 'MAIN', slotType: 'UNLIMITED' },
    });
    render(
      <SlotList
        eventId="evt-1"
        slots={baseSlots}
        userId="u-1"
        hasRsvp={true}
        isRsvpConfirmed={true}
      />,
    );
    fireEvent.click(screen.getByTestId('potluck-drop-s-1'));
    await waitFor(() => {
      expect(mockCancelSignup.mutateAsync).toHaveBeenCalledWith({ slotId: 's-1' });
    });
  });

  it('renders the empty state when no slots are configured', () => {
    render(
      <SlotList eventId="evt-1" slots={[]} userId="u-1" hasRsvp={true} isRsvpConfirmed={true} />,
    );
    expect(screen.getByText(/The menu is still being planned/i)).toBeInTheDocument();
  });

  describe('FPP-54 — optional slot name', () => {
    const unnamedSlot = {
      id: 's-unnamed',
      name: null,
      category: 'DESSERT',
      slotType: 'LIMITED' as const,
      maxSignups: 2,
      currentSignups: 0,
      signups: [],
    };

    it('renders a category-derived placeholder when the slot has no name', () => {
      render(
        <SlotList eventId="evt-1" slots={[unnamedSlot]} userId="u-1" hasRsvp isRsvpConfirmed />,
      );
      const card = screen.getByTestId('potluck-slot-s-unnamed');
      expect(card.textContent).toMatch(/A dessert/i);
      expect(card.textContent).toMatch(/any/i);
    });

    it('still allows claiming a slot with no name', async () => {
      render(
        <SlotList eventId="evt-1" slots={[unnamedSlot]} userId="u-1" hasRsvp isRsvpConfirmed />,
      );
      fireEvent.click(screen.getByTestId('potluck-claim-s-unnamed'));
      const input = await screen.findByTestId('potluck-claim-dish-input');
      fireEvent.change(input, { target: { value: 'Carrot cake' } });
      fireEvent.click(screen.getByTestId('potluck-claim-submit'));
      await waitFor(() => {
        expect(mockSignup.mutateAsync).toHaveBeenCalledWith({
          slotId: 's-unnamed',
          dishName: 'Carrot cake',
          servings: 1,
          dietaryLabels: [],
        });
      });
    });
  });
});
