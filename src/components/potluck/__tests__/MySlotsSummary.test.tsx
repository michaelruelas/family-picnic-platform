import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockSignup = { mutateAsync: vi.fn(), isPending: false };
const mockUpdateSignup = { mutateAsync: vi.fn(), isPending: false };
const mockCancelSignup = { mutateAsync: vi.fn(), isPending: false };

const mockMySignups: Array<{
  id: string;
  slotId: string;
  dishName: string;
  servings: number;
  dietaryLabels: string[];
  claimedAt: Date;
  slot: { id: string; name: string; category: string; slotType: string };
}> = [];

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

const { default: MySlotsSummary } = await import('../MySlotsSummary');

beforeEach(() => {
  mockMySignups.length = 0;
  mockSignup.mutateAsync.mockReset();
  mockSignup.mutateAsync.mockResolvedValue({});
  mockUpdateSignup.mutateAsync.mockReset();
  mockUpdateSignup.mutateAsync.mockResolvedValue({});
  mockCancelSignup.mutateAsync.mockReset();
  mockCancelSignup.mutateAsync.mockResolvedValue({});
});

describe('MySlotsSummary', () => {
  it('renders a signed-out hint when there is no user', () => {
    render(
      <MySlotsSummary eventId="evt-1" userId={null} hasRsvp={false} isRsvpConfirmed={false} />,
    );
    const root = screen.getByTestId('my-slots-summary');
    expect(root.getAttribute('data-my-slots-state')).toBe('signed-out');
    expect(screen.getByText(/Sign in/i)).toBeInTheDocument();
  });

  it('renders an RSVP hint when the user has no RSVP', () => {
    render(<MySlotsSummary eventId="evt-1" userId="u-1" hasRsvp={false} isRsvpConfirmed={false} />);
    const root = screen.getByTestId('my-slots-summary');
    expect(root.getAttribute('data-my-slots-state')).toBe('no-rsvp');
  });

  it('renders the empty state when the user is confirmed but has no signups', () => {
    render(<MySlotsSummary eventId="evt-1" userId="u-1" hasRsvp={true} isRsvpConfirmed={true} />);
    const root = screen.getByTestId('my-slots-summary');
    expect(root.getAttribute('data-my-slots-state')).toBe('empty');
    expect(screen.getByText(/Nothing claimed yet/i)).toBeInTheDocument();
  });

  it('lists the callers signups and shows the Yours count', () => {
    mockMySignups.push(
      {
        id: 'ps-1',
        slotId: 's-1',
        dishName: 'Mac and cheese',
        servings: 1,
        dietaryLabels: [],
        claimedAt: new Date('2026-08-01T10:00:00Z'),
        slot: { id: 's-1', name: 'Side 1', category: 'SIDE', slotType: 'LIMITED' },
      },
      {
        id: 'ps-2',
        slotId: 's-2',
        dishName: 'Brownies',
        servings: 2,
        dietaryLabels: ['vegetarian'],
        claimedAt: new Date('2026-08-01T11:00:00Z'),
        slot: { id: 's-2', name: 'Dessert 1', category: 'DESSERT', slotType: 'UNLIMITED' },
      },
    );
    render(<MySlotsSummary eventId="evt-1" userId="u-1" hasRsvp={true} isRsvpConfirmed={true} />);
    const root = screen.getByTestId('my-slots-summary');
    expect(root.getAttribute('data-my-slots-state')).toBe('has-signups');
    expect(root.getAttribute('data-my-slots-count')).toBe('2');
    expect(screen.getByText(/You are bringing 2 dishes/i)).toBeInTheDocument();
    expect(screen.getByText('Mac and cheese')).toBeInTheDocument();
    expect(screen.getByText('Brownies')).toBeInTheDocument();
  });

  it('drops a slot when the drop button is clicked', async () => {
    mockMySignups.push({
      id: 'ps-1',
      slotId: 's-1',
      dishName: 'Mac and cheese',
      servings: 1,
      dietaryLabels: [],
      claimedAt: new Date(),
      slot: { id: 's-1', name: 'Side 1', category: 'SIDE', slotType: 'LIMITED' },
    });
    render(<MySlotsSummary eventId="evt-1" userId="u-1" hasRsvp={true} isRsvpConfirmed={true} />);
    fireEvent.click(screen.getByTestId('my-slot-drop'));
    await waitFor(() => {
      expect(mockCancelSignup.mutateAsync).toHaveBeenCalledWith({ slotId: 's-1' });
    });
  });

  it('hides the manage-dishes footer when rendered in compact mode', () => {
    render(
      <MySlotsSummary
        eventId="evt-1"
        userId="u-1"
        hasRsvp={true}
        isRsvpConfirmed={true}
        compact={true}
      />,
    );
    expect(screen.queryByText(/Manage dishes on the/i)).not.toBeInTheDocument();
  });
});
