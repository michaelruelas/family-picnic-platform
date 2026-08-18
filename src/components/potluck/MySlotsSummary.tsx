'use client';

import Link from 'next/link';
import { useMyPotluckSignups, usePotluckSignupMutation } from '~/hooks';
import { POTLUCK_CATEGORY_EMOJIS, POTLUCK_CATEGORY_LABELS } from '~/lib/constants';

interface MySlotsSummaryProps {
  eventId: string;
  /** When false, the query is disabled and we render the neutral "RSVP to claim" hint. */
  hasRsvp: boolean;
  isRsvpConfirmed: boolean;
  userId: string | null;
  /** When true the panel is rendered in a compact form (used inside the RSVP card). */
  compact?: boolean;
}

export default function MySlotsSummary({
  eventId,
  hasRsvp,
  isRsvpConfirmed,
  userId,
  compact = false,
}: MySlotsSummaryProps) {
  const { signups, isLoading } = useMyPotluckSignups({
    eventId,
    enabled: !!userId && hasRsvp,
  });
  const { cancelSignup } = usePotluckSignupMutation();

  if (!userId) {
    return (
      <div
        className="bg-sunlight/20 ring-sunlight/40 rounded-sm p-5 ring-1"
        data-testid="my-slots-summary"
        data-my-slots-state="signed-out"
      >
        <p className="text-foreground text-sm">
          <span className="font-semibold">Sign in</span> to claim dishes and see your list.
        </p>
      </div>
    );
  }

  if (!hasRsvp) {
    return (
      <div
        className="bg-sunlight/20 ring-sunlight/40 rounded-sm p-5 ring-1"
        data-testid="my-slots-summary"
        data-my-slots-state="no-rsvp"
      >
        <p className="text-foreground text-sm">
          <span className="font-semibold">RSVP first</span> — then pick what you will bring.
        </p>
      </div>
    );
  }

  if (!isRsvpConfirmed) {
    return (
      <div
        className="bg-secondary rounded-sm p-5"
        data-testid="my-slots-summary"
        data-my-slots-state="not-confirmed"
      >
        <p className="text-foreground/85 text-sm">
          Your RSVP is not confirmed yet. Update it on the event page to claim dishes.
        </p>
      </div>
    );
  }

  return (
    <section
      className={`bg-card shadow-card ring-border/60 rounded-sm p-5 ring-1 md:p-6 ${
        compact ? '' : 'md:p-7'
      }`}
      aria-label="My potluck signups"
      data-testid="my-slots-summary"
      data-my-slots-state={signups.length > 0 ? 'has-signups' : 'empty'}
      data-my-slots-count={signups.length}
    >
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="text-terracotta text-xs font-semibold tracking-widest uppercase">
            My slots
          </p>
          <h2 className="font-display text-foreground mt-1 text-xl font-semibold">
            {signups.length > 0
              ? `You are bringing ${signups.length} ${signups.length === 1 ? 'dish' : 'dishes'}`
              : 'Nothing claimed yet'}
          </h2>
        </div>
        {signups.length > 0 && !compact && (
          <span className="text-muted-foreground text-sm">
            {signups.length} {signups.length === 1 ? 'slot' : 'slots'}
          </span>
        )}
      </header>

      {isLoading ? (
        <p className="text-muted-foreground mt-4 text-sm">Loading your slots…</p>
      ) : signups.length === 0 ? (
        <p className="text-muted-foreground mt-3 text-sm">
          Browse the menu below and tap{' '}
          <span className="text-foreground font-semibold">Claim this dish</span> to add it. You can
          bring more than one thing.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {signups.map((signup) => (
            <li
              key={signup.id}
              className="bg-secondary/40 flex items-center justify-between gap-3 rounded-sm px-4 py-3"
              data-testid={`my-slot-row-${signup.slotId}-${signup.id}`}
            >
              <div className="min-w-0">
                <p className="text-foreground truncate font-semibold">{signup.dishName}</p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  <span aria-hidden="true">
                    {POTLUCK_CATEGORY_EMOJIS[signup.slot.category] ?? '🍴'}
                  </span>{' '}
                  {POTLUCK_CATEGORY_LABELS[signup.slot.category] ?? signup.slot.category}
                  {signup.slot.name ? ` · ${signup.slot.name}` : ''}
                  {signup.servings > 1 ? ` · ${signup.servings} servings` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  // Multi-claim: cancel targets a single signup row by
                  // its `id`. The same slot can hold several rows from
                  // this caller with different dish names.
                  void cancelSignup.mutateAsync({ signupId: signup.id });
                }}
                disabled={cancelSignup.isPending}
                className="text-muted-foreground hover:text-destructive shrink-0 rounded-sm px-2 py-1 text-sm font-medium transition-colors disabled:opacity-50"
                data-testid="my-slot-drop"
                data-signup-id={signup.id}
                aria-label={`Drop ${signup.dishName}`}
              >
                {cancelSignup.isPending ? 'Dropping…' : 'Drop'}
              </button>
            </li>
          ))}
        </ul>
      )}

      {!compact && (
        <p className="text-muted-foreground mt-4 text-xs">
          Manage your dishes from the{' '}
          <Link
            href={`/events/${eventId}?rsvpOpen=1#potluck`}
            className="text-terracotta underline underline-offset-4"
          >
            event page
          </Link>
          .
        </p>
      )}
    </section>
  );
}
