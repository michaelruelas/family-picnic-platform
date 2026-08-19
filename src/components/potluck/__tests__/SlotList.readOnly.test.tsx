import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

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
    name: 'Brownies',
    category: 'DESSERT',
    slotType: 'LIMITED',
    maxSignups: 2,
    currentSignups: 1,
    signups: [
      {
        id: 'ps-other',
        dishName: 'Lemon bars',
        servings: 1,
        dietaryLabels: [],
        // FPP-127: include the household name on the fixture.
        rsvp: {
          userId: 'u-99',
          user: { id: 'u-99', name: 'Pat' },
          householdName: 'The Pat Family',
        },
      },
    ],
  },
];

beforeEach(() => {
  mockMySignups.length = 0;
  mockSignup.mutateAsync.mockReset();
  mockUpdateSignup.mutateAsync.mockReset();
  mockCancelSignup.mutateAsync.mockReset();
});

describe('SlotList readOnly mode (FPP-21)', () => {
  it('does not render any potluck-claim-* testids when readOnly is true', () => {
    render(
      <SlotList eventId="evt-1" slots={baseSlots} userId="u-1" hasRsvp isRsvpConfirmed readOnly />,
    );
    const claims = screen.queryAllByTestId(/^potluck-claim-/);
    expect(claims).toHaveLength(0);
  });

  it('does not render potluck-edit-* or potluck-drop-* testids when readOnly is true and the user has a signup', () => {
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
      <SlotList eventId="evt-1" slots={baseSlots} userId="u-1" hasRsvp isRsvpConfirmed readOnly />,
    );
    expect(screen.queryAllByTestId(/^potluck-edit-/)).toHaveLength(0);
    expect(screen.queryAllByTestId(/^potluck-drop-/)).toHaveLength(0);
  });

  it('still renders the Yours badge for claimed slots in readOnly mode', () => {
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
      <SlotList eventId="evt-1" slots={baseSlots} userId="u-1" hasRsvp isRsvpConfirmed readOnly />,
    );
    expect(screen.getByTestId('yours-badge')).toBeInTheDocument();
  });

  // Auth gate: anonymous viewers (userId=null) must NOT see
  // household names or user names next to claimed dishes. Dish
  // names stay visible — they're about the food, not the family.
  describe('anonymous viewer (userId=null)', () => {
    it('strips the household name suffix from claimed-dish rows', () => {
      render(
        <SlotList
          eventId="evt-1"
          slots={baseSlots}
          userId={null}
          hasRsvp={false}
          isRsvpConfirmed={false}
        />,
      );
      // The dish name still renders — it's not personal data.
      expect(screen.getByText('Lemon bars')).toBeInTheDocument();
      // The household + user names must NOT render.
      expect(screen.queryByText(/The Pat Family/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Pat/)).not.toBeInTheDocument();
    });

    it('strips the user name fallback when no household name is set', () => {
      const slotsWithoutHousehold = [
        {
          id: 's-1',
          name: 'Mac and cheese',
          category: 'MAIN',
          slotType: 'UNLIMITED',
          maxSignups: null,
          currentSignups: 1,
          signups: [
            {
              id: 'ps-1',
              dishName: 'Mac and cheese',
              servings: 1,
              dietaryLabels: [],
              rsvp: {
                userId: 'u-99',
                user: { id: 'u-99', name: 'Pat' },
                householdName: null,
              },
            },
          ],
        },
      ];
      render(
        <SlotList
          eventId="evt-1"
          slots={slotsWithoutHousehold}
          userId={null}
          hasRsvp={false}
          isRsvpConfirmed={false}
        />,
      );
      // The dish name + slot name both contain "Mac and cheese"
      // — use getAllByText to confirm the row is present without
      // coupling to a specific count, then assert the user name is
      // absent.
      expect(screen.getAllByText('Mac and cheese').length).toBeGreaterThan(0);
      expect(screen.queryByText(/Pat/)).not.toBeInTheDocument();
    });

    it('still surfaces the existing "Sign in" hint banner', () => {
      render(
        <SlotList
          eventId="evt-1"
          slots={baseSlots}
          userId={null}
          hasRsvp={false}
          isRsvpConfirmed={false}
        />,
      );
      expect(screen.getByText(/Sign in/i)).toBeInTheDocument();
    });
  });
});
