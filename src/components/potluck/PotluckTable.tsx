'use client';

import { useMemo } from 'react';
import {
  POTLUCK_CATEGORY_EMOJIS,
  POTLUCK_CATEGORY_LABELS,
  POTLUCK_CATEGORY_ORDER,
  slotDisplayName,
} from '~/lib/constants';

export interface PotluckTableSignup {
  id: string;
  dishName: string;
  servings: number;
  dietaryLabels?: string[];
  rsvp?: {
    id?: string;
    userId?: string;
    user?: {
      id?: string;
      name?: string | null;
      household?: { name: string } | null;
    } | null;
  } | null;
}

export interface PotluckTableSlot {
  id: string;
  name: string | null;
  category: string;
  slotType?: string;
  maxSignups?: number | null;
  currentSignups?: number;
  signups: PotluckTableSignup[];
}

export interface PotluckTableProps {
  slots: PotluckTableSlot[];
  className?: string;
  currentRsvpId?: string;
}

interface TableRow {
  rowKey: string;
  dishName: string;
  categoryKey: string;
  categoryLabel: string;
  categoryEmoji: string;
  isSignedUp: boolean;
  broughtBy: string;
  householdName: string | null;
  servings: number | null;
  isCurrentUser: boolean;
}

function getCategoryOrder(category: string): number {
  const index = (POTLUCK_CATEGORY_ORDER as readonly string[]).indexOf(category);
  return index === -1 ? POTLUCK_CATEGORY_ORDER.length : index;
}

export default function PotluckTable({ slots, className = '', currentRsvpId }: PotluckTableProps) {
  const rows = useMemo<TableRow[]>(() => {
    const result: TableRow[] = [];

    const sortedSlots = [...slots].sort(
      (a, b) => getCategoryOrder(a.category) - getCategoryOrder(b.category),
    );

    for (const slot of sortedSlots) {
      const categoryLabel =
        POTLUCK_CATEGORY_LABELS[slot.category as keyof typeof POTLUCK_CATEGORY_LABELS] ??
        slot.category;
      const categoryEmoji = POTLUCK_CATEGORY_EMOJIS[slot.category] ?? '🍴';
      const defaultDishName = slotDisplayName(slot);

      if (slot.signups.length > 0) {
        for (const signup of slot.signups) {
          const userName = signup.rsvp?.user?.name || 'Guest';
          const household = signup.rsvp?.user?.household?.name || null;
          const isCurrentUser = Boolean(currentRsvpId && signup.rsvp?.id === currentRsvpId);

          result.push({
            rowKey: `signup-${signup.id}`,
            dishName: signup.dishName || defaultDishName,
            categoryKey: slot.category,
            categoryLabel,
            categoryEmoji,
            isSignedUp: true,
            broughtBy: userName,
            householdName: household,
            servings: signup.servings,
            isCurrentUser,
          });
        }

        // If limited slot has remaining spots, show available row
        if (
          slot.slotType === 'LIMITED' &&
          slot.maxSignups !== null &&
          slot.maxSignups !== undefined &&
          slot.signups.length < slot.maxSignups
        ) {
          const remaining = slot.maxSignups - slot.signups.length;
          for (let i = 0; i < remaining; i++) {
            result.push({
              rowKey: `slot-${slot.id}-open-${i}`,
              dishName: defaultDishName,
              categoryKey: slot.category,
              categoryLabel,
              categoryEmoji,
              isSignedUp: false,
              broughtBy: '—',
              householdName: null,
              servings: null,
              isCurrentUser: false,
            });
          }
        }
      } else {
        // Slot has no signups
        result.push({
          rowKey: `slot-${slot.id}-empty`,
          dishName: defaultDishName,
          categoryKey: slot.category,
          categoryLabel,
          categoryEmoji,
          isSignedUp: false,
          broughtBy: '—',
          householdName: null,
          servings: null,
          isCurrentUser: false,
        });
      }
    }

    return result;
  }, [slots, currentRsvpId]);

  if (slots.length === 0) {
    return (
      <div
        className={`bg-card shadow-card ring-border/60 rounded-sm p-6 text-center ring-1 ${className}`}
        data-testid="potluck-table-empty"
      >
        <p className="text-muted-foreground text-sm">
          No potluck items have been set up for this event yet.
        </p>
      </div>
    );
  }

  const signedUpCount = rows.filter((r) => r.isSignedUp).length;
  const availableCount = rows.filter((r) => !r.isSignedUp).length;

  return (
    <div
      className={`bg-card shadow-card ring-border/60 overflow-hidden rounded-sm ring-1 ${className}`}
      data-testid="potluck-table-container"
    >
      <div className="border-border/60 border-b p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-terracotta text-sm font-semibold tracking-widest uppercase">
              Potluck Roster
            </p>
            <h3 className="font-display text-foreground mt-1 text-2xl font-semibold">
              Event Potluck Details
            </h3>
            <p className="text-muted-foreground mt-1 text-sm">
              See who is bringing each dish and which dishes are still needed.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="bg-sage/20 text-sage rounded-sm px-2.5 py-1 font-semibold">
              ✓ {signedUpCount} signed up
            </span>
            {availableCount > 0 && (
              <span className="bg-secondary text-muted-foreground rounded-sm px-2.5 py-1 font-semibold">
                {availableCount} available
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table
          className="divide-border min-w-full divide-y text-left text-sm"
          data-testid="potluck-table"
        >
          <thead className="bg-secondary/50 text-muted-foreground text-xs font-medium uppercase">
            <tr>
              <th scope="col" className="px-4 py-3 sm:px-6">
                Category
              </th>
              <th scope="col" className="px-4 py-3 sm:px-6">
                Dish
              </th>
              <th scope="col" className="px-4 py-3 sm:px-6">
                Status
              </th>
              <th scope="col" className="px-4 py-3 sm:px-6">
                Brought By
              </th>
              <th scope="col" className="px-4 py-3 sm:px-6">
                Servings
              </th>
            </tr>
          </thead>
          <tbody className="divide-border/60 divide-y">
            {rows.map((row) => (
              <tr
                key={row.rowKey}
                data-testid={`potluck-row-${row.rowKey}`}
                className={row.isCurrentUser ? 'bg-sage/5' : undefined}
              >
                <td className="px-4 py-3 whitespace-nowrap sm:px-6">
                  <span className="text-foreground inline-flex items-center gap-1.5 font-medium">
                    <span>{row.categoryEmoji}</span>
                    <span className="text-xs">{row.categoryLabel}</span>
                  </span>
                </td>
                <td className="text-foreground px-4 py-3 font-medium sm:px-6">
                  {row.dishName}
                  {row.isCurrentUser && (
                    <span className="bg-sage/20 text-sage ml-2 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                      You
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap sm:px-6">
                  {row.isSignedUp ? (
                    <span className="bg-sage/20 text-sage inline-flex items-center gap-1 rounded-sm px-2.5 py-0.5 text-xs font-semibold">
                      <span>✓</span> Signed up
                    </span>
                  ) : (
                    <span className="bg-secondary text-muted-foreground inline-flex items-center rounded-sm px-2.5 py-0.5 text-xs font-medium">
                      Not signed up
                    </span>
                  )}
                </td>
                <td className="text-foreground px-4 py-3 sm:px-6">
                  {row.isSignedUp ? (
                    <div>
                      <span className="font-medium">{row.broughtBy}</span>
                      {row.householdName && (
                        <span className="text-muted-foreground ml-1.5 text-xs">
                          ({row.householdName})
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground/60">—</span>
                  )}
                </td>
                <td className="text-muted-foreground px-4 py-3 whitespace-nowrap sm:px-6">
                  {row.servings !== null ? `${row.servings}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
