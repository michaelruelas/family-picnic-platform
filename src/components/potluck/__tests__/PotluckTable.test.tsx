import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PotluckTable, { type PotluckTableSlot } from '../PotluckTable';

describe('PotluckTable (FPP-112)', () => {
  it('renders empty state when no slots are provided', () => {
    render(<PotluckTable slots={[]} />);
    expect(
      screen.getByText('No potluck items have been set up for this event yet.'),
    ).toBeInTheDocument();
  });

  it('renders table showing signed up and not signed up dishes with who is bringing them', () => {
    const mockSlots: PotluckTableSlot[] = [
      {
        id: 'slot-1',
        name: 'Grandma’s Mac & Cheese',
        category: 'MAIN',
        slotType: 'LIMITED',
        maxSignups: 1,
        currentSignups: 1,
        signups: [
          {
            id: 'signup-1',
            dishName: 'Grandma’s Special Mac & Cheese',
            servings: 12,
            rsvp: {
              id: 'rsvp-1',
              userId: 'user-1',
              user: {
                id: 'user-1',
                name: 'Maria Garcia',
                household: { name: 'The Garcia Family' },
              },
            },
          },
        ],
      },
      {
        id: 'slot-2',
        name: 'Potato Salad',
        category: 'SIDE',
        slotType: 'LIMITED',
        maxSignups: 1,
        currentSignups: 0,
        signups: [],
      },
      {
        id: 'slot-3',
        name: null,
        category: 'DESSERT',
        slotType: 'LIMITED',
        maxSignups: 1,
        currentSignups: 0,
        signups: [],
      },
    ];

    render(<PotluckTable slots={mockSlots} currentRsvpId="rsvp-1" />);

    // Check table headers
    expect(screen.getByText('Event Potluck Details')).toBeInTheDocument();
    expect(screen.getByText('Category')).toBeInTheDocument();
    expect(screen.getByText('Dish')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Brought By')).toBeInTheDocument();

    // Check signed up dish
    expect(screen.getByText('Grandma’s Special Mac & Cheese')).toBeInTheDocument();
    // FPP-127: the household name is the primary identity handle
    // on a potluck claim; the user name is no longer shown next
    // to it as a parenthetical.
    expect(screen.getByText('The Garcia Family')).toBeInTheDocument();
    expect(screen.queryByText('Maria Garcia')).not.toBeInTheDocument();
    expect(screen.queryByText('(The Garcia Family)')).not.toBeInTheDocument();
    expect(screen.getByText('Signed up')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();

    // Check not signed up dish
    expect(screen.getByText('Potato Salad')).toBeInTheDocument();
    expect(screen.getByText('A dessert (any)')).toBeInTheDocument();
    const notSignedUp = screen.getAllByText('Not signed up');
    expect(notSignedUp.length).toBe(2);
  });
});
