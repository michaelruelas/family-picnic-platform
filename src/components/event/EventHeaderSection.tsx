import Link from 'next/link';
import { EventRsvpCard } from './EventRsvpCard';
import { EventLocationMap } from './EventLocationMap';
import { SignInPrompt } from './SignInPrompt';
import { EventDownloadsSection, type PublicEventAttachment } from './EventDownloadsSection';
import { POTLUCK_CATEGORY_EMOJIS, POTLUCK_CATEGORY_LABELS } from '~/lib/constants';
import type { RSVPStatus, RsvpAttending } from '~/lib/generated/enums';

type PotluckSlot = {
  id: string;
  category: string;
  slotType?: string;
  signups: {
    id: string;
    dishName: string;
    servings: number;
    rsvp: {
      user: { name: string | null; household: { name: string } | null } | null;
    };
  }[];
};

type PotluckSignupPublic = {
  id: string;
  dishName: string;
  servings: number;
};

type PotluckSignupPrivate = PotluckSignupPublic & {
  rsvp: {
    user: { name: string | null; household: { name: string } | null } | null;
  };
};

export interface EventHeaderSectionProps {
  eventId: string;
  eventName: string;
  eventDescription: string;
  eventDate: Date;
  eventLocation: string;
  eventLat: number | null;
  eventLng: number | null;
  isPast: boolean;
  isLoggedIn: boolean;
  rsvpDeadline: Date | null;
  maxCapacity: number | null;
  currentAttending: number;
  registrationFeeCents: number | null;
  registrationFeeMinAge: number;
  currency: string;
  potluckSlots: PotluckSlot[];
  pendingInvitations: {
    id: string;
    status: string;
    user: { name: string | null } | null;
    household: { name: string } | null;
  }[];
  pendingInvitationCount: number;
  /**
   * FPP-89: whether the logged-in caller has at least one
   * pending invitation for this event. Drives the
   * `EventRsvpCard`'s no-RSVP variant — pending invitation gets
   * a "Open my invitations" CTA, no invitation gets a passive
   * "waiting on your invitation" notice. The bottom sheet is no
   * longer the primary RSVP entry on this page.
   */
  hasPendingInvitation: boolean;
  existingRsvp: {
    id: string;
    status: RSVPStatus;
    headcount: number;
    modifiedAt: string;
    memberAttendances: {
      id: string;
      householdMemberId: string | null;
      memberName: string;
      memberAge: number | null;
      attending: RsvpAttending;
    }[];
    registrationFeeCents: number;
    registrationFeeCurrency: string;
  } | null;
  userRsvpStatus: RSVPStatus | null;
  /**
   * FPP-65 / QUB-13.3: list of hosts for this event (EventAdmin rows
   * with role=OWNER). Empty array means "no host assigned yet" and
   * the HostBlock hides itself in that case. We only carry the
   * public-facing fields (id, name, email, phoneNumber); no household
   * or admin metadata.
   */
  hosts: {
    id: string;
    name: string;
    email: string;
    phoneNumber: string | null;
  }[];
  /**
   * FPP-43 / FPP-1: PDF attachments surfaced as a Downloads block on
   * the public event page. The block is hidden when the array is
   * empty, so callers can pass an empty array on draft events
   * without showing a placeholder.
   */
  attachments: PublicEventAttachment[];
}

/**
 * FPP-46 / FPP-10: Header tab content. Renders the "Welcome" heading +
 * event name subtitle, the full RSVP card (so the user can RSVP or edit
 * their attendance from the same surface), the host block (currently
 * sourced from `event.description` while the QUB-13.3 host model lands),
 * the meta strip (location / time / headcount / dishes claimed), the
 * pending-invitations card or sign-in prompt, and the potluck preview.
 *
 * The compact "RSVP button" requirement from FPP-10 is satisfied by the
 * embedded `EventRsvpCard`; once QUB-13.3 ships the dedicated host block,
 * swap the `HostBlock` slot below for the new component without touching
 * the rest of the layout.
 */
export function EventHeaderSection(props: EventHeaderSectionProps) {
  const {
    eventId,
    eventName,
    eventDescription,
    eventDate,
    eventLocation,
    eventLat,
    eventLng,
    isPast,
    isLoggedIn,
    rsvpDeadline,
    maxCapacity,
    currentAttending,
    registrationFeeCents,
    registrationFeeMinAge,
    currency,
    potluckSlots,
    pendingInvitations,
    pendingInvitationCount,
    hasPendingInvitation,
    existingRsvp,
    userRsvpStatus,
    hosts,
    attachments,
  } = props;

  const now = new Date();
  const totalPotluckDishes = potluckSlots.reduce((sum, slot) => sum + slot.signups.length, 0);
  const registrationFeeConfig =
    registrationFeeCents && registrationFeeCents > 0
      ? { amountCents: registrationFeeCents, minAge: registrationFeeMinAge, currency }
      : null;

  const slotsByCategory = potluckSlots.reduce(
    (acc, slot) => {
      if (!acc[slot.category]) {
        acc[slot.category] = [];
      }
      acc[slot.category]!.push(slot);
      return acc;
    },
    {} as Record<string, PotluckSlot[]>,
  );

  const openSlots = potluckSlots.filter(
    (s) => s.signups.length === 0 || s.slotType === 'UNLIMITED',
  );
  const showAddDishCard = isLoggedIn && userRsvpStatus === 'CONFIRMED' && openSlots.length > 0;

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <p className="text-terracotta text-sm font-semibold tracking-widest uppercase">Welcome</p>
        <h2 className="font-display text-foreground text-3xl leading-tight font-medium tracking-tight md:text-4xl">
          {eventName}
        </h2>
      </header>

      <EventRsvpCard
        eventId={eventId}
        eventName={eventName}
        eventDate={eventDate}
        location={eventLocation}
        isPast={isPast}
        isLoggedIn={isLoggedIn}
        rsvpDeadline={rsvpDeadline?.toISOString() ?? null}
        maxCapacity={maxCapacity}
        currentAttending={currentAttending}
        registrationFeeConfig={registrationFeeConfig}
        hasPendingInvitation={hasPendingInvitation}
        existingRsvp={existingRsvp}
      />

      <MetaStrip
        eventDate={eventDate}
        eventLocation={eventLocation}
        attending={currentAttending}
        dishesClaimed={totalPotluckDishes}
      />

      {eventLat !== null && eventLng !== null && (
        <EventLocationMap lat={eventLat} lng={eventLng} location={eventLocation} />
      )}

      <HostBlock description={eventDescription} maxCapacity={maxCapacity} hosts={hosts} />

      {attachments.length > 0 && <EventDownloadsSection attachments={attachments} />}

      {isLoggedIn && pendingInvitations.length > 0 && (
        <PendingInvitationsCard invitations={pendingInvitations} />
      )}
      {!isLoggedIn && pendingInvitationCount > 0 && (
        <SignInPrompt
          title={`${pendingInvitationCount} ${
            pendingInvitationCount === 1 ? 'household is' : 'households are'
          } still deciding`}
          description="Sign in to see who has been invited and which families are still working out their plans."
        />
      )}

      {rsvpDeadline && rsvpDeadline > now && (
        <p className="text-muted-foreground -mt-4 text-sm">
          Please RSVP by{' '}
          <span className="text-foreground font-semibold">
            {rsvpDeadline.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </span>
          .
        </p>
      )}

      <PotluckPreview
        eventId={eventId}
        isLoggedIn={isLoggedIn}
        showAddDishCard={showAddDishCard}
        slotsByCategory={slotsByCategory}
        totalDishes={totalPotluckDishes}
        userRsvpConfirmed={userRsvpStatus === 'CONFIRMED'}
      />
    </div>
  );
}

function MetaStrip({
  eventDate,
  eventLocation,
  attending,
  dishesClaimed,
}: {
  eventDate: Date;
  eventLocation: string;
  attending: number;
  dishesClaimed: number;
}) {
  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-x-5 gap-y-2">
      <span className="flex items-center gap-2 text-base">
        <span className="text-sage">📍</span>
        <span className="text-foreground font-medium">{eventLocation}</span>
      </span>
      <span className="text-border hidden sm:inline">·</span>
      <span className="flex items-center gap-2 text-base">
        <span className="text-terracotta">🕒</span>
        {eventDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
      </span>
      <span className="text-border hidden sm:inline">·</span>
      <span className="flex items-center gap-2 text-base">
        <span className="text-sage">👥</span>
        {attending} attending
      </span>
      {dishesClaimed > 0 && (
        <>
          <span className="text-border hidden sm:inline">·</span>
          <span className="flex items-center gap-2 text-base">
            <span className="text-terracotta">🍴</span>
            {dishesClaimed} {dishesClaimed === 1 ? 'dish' : 'dishes'} claimed
          </span>
        </>
      )}
    </div>
  );
}

/**
 * FPP-10 / FPP-65 / QUB-13.3: host block on the public event page.
 *
 * Renders the welcome note (event description) and, when at least
 * one host is assigned, a contact card listing each host's name and
 * the public contact channels they have on file (email + phone when
 * set). Hosts are intentionally not rendered when the array is empty
 * — the spec says "Hidden when no host assigned", and we don't want
 * a stray "no host yet" placeholder polluting the public surface.
 */
function HostBlock({
  description,
  maxCapacity,
  hosts,
}: {
  description: string;
  maxCapacity: number | null;
  hosts: { id: string; name: string; email: string; phoneNumber: string | null }[];
}) {
  return (
    <div className="bg-card shadow-card ring-border/60 rounded-3xl p-7 ring-1 md:p-9">
      <p className="text-terracotta text-sm font-semibold tracking-widest uppercase">The welcome</p>
      <h3 className="font-display text-foreground mt-2 text-3xl font-medium tracking-tight md:text-4xl">
        A note from the host
      </h3>
      <p className="text-foreground/80 mt-5 text-lg leading-relaxed">{description}</p>
      {maxCapacity && (
        <div className="bg-sunlight/20 text-foreground ring-sunlight/40 mt-6 rounded-2xl px-5 py-4 text-sm ring-1">
          <span className="font-semibold">Heads up:</span> We can host up to {maxCapacity} people.
          Reserve your spot early.
        </div>
      )}
      {hosts.length > 0 && (
        <div className="border-border mt-8 border-t pt-6" data-testid="host-contact-block">
          <p className="text-terracotta text-sm font-semibold tracking-widest uppercase">
            Your host{hosts.length === 1 ? '' : 's'}
          </p>
          <h4 className="font-display text-foreground mt-2 text-2xl font-medium tracking-tight md:text-3xl">
            {hosts.length === 1
              ? `Hosted by ${hosts[0]!.name}`
              : `Hosted by ${hosts.length} people`}
          </h4>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {hosts.map((host) => (
              <li
                key={host.id}
                className="bg-secondary flex items-start gap-3 rounded-2xl px-4 py-3"
              >
                <span className="text-terracotta text-lg" aria-hidden>
                  👤
                </span>
                <div className="min-w-0">
                  <p className="text-foreground font-medium">{host.name}</p>
                  <a
                    href={`mailto:${host.email}`}
                    className="text-muted-foreground hover:text-foreground block truncate text-sm underline-offset-2 hover:underline"
                  >
                    {host.email}
                  </a>
                  {host.phoneNumber && (
                    <a
                      href={`tel:${host.phoneNumber}`}
                      className="text-muted-foreground hover:text-foreground block text-sm underline-offset-2 hover:underline"
                    >
                      {host.phoneNumber}
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PendingInvitationsCard({
  invitations,
}: {
  invitations: {
    id: string;
    status: string;
    user: { name: string | null } | null;
    household: { name: string } | null;
  }[];
}) {
  return (
    <div className="bg-card shadow-card ring-border/60 rounded-3xl p-7 ring-1 md:p-9">
      <p className="text-terracotta text-sm font-semibold tracking-widest uppercase">
        Awaiting replies
      </p>
      <h3 className="font-display text-foreground mt-2 text-3xl font-medium tracking-tight">
        Pending invitations
      </h3>
      <p className="text-muted-foreground mt-2">
        These guests have been invited but haven&apos;t responded yet
      </p>
      <ul className="mt-5 grid gap-2 sm:grid-cols-2">
        {invitations.map((inv) => (
          <li
            key={inv.id}
            className="bg-secondary flex items-center gap-3 rounded-2xl px-4 py-3 text-sm"
          >
            <span className="text-sunlight">⏳</span>
            <span className="text-foreground font-medium">
              {inv.household?.name || inv.user?.name || 'Unknown'}
            </span>
            {inv.status === 'SENT' && (
              <span className="text-muted-foreground ml-auto text-xs">sent</span>
            )}
            {inv.status === 'DELIVERED' && (
              <span className="text-muted-foreground ml-auto text-xs">delivered</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PotluckPreview({
  eventId,
  isLoggedIn,
  showAddDishCard,
  slotsByCategory,
  totalDishes,
  userRsvpConfirmed,
}: {
  eventId: string;
  isLoggedIn: boolean;
  showAddDishCard: boolean;
  slotsByCategory: Record<string, PotluckSlot[]>;
  totalDishes: number;
  userRsvpConfirmed: boolean;
}) {
  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-terracotta text-sm font-semibold tracking-widest uppercase">
            The menu
          </p>
          <h3 className="font-display text-foreground mt-2 text-3xl font-medium tracking-tight md:text-4xl">
            The Potluck
          </h3>
        </div>
        <p className="text-sage text-sm font-semibold">
          {totalDishes} {totalDishes === 1 ? 'dish' : 'dishes'} claimed
        </p>
      </div>

      {Object.keys(slotsByCategory).length === 0 ? (
        <div className="bg-sunlight/20 ring-sunlight/40 mt-6 rounded-3xl p-12 text-center ring-1">
          <div className="text-5xl">🍽️</div>
          <h4 className="font-display text-foreground mt-4 text-2xl font-semibold">
            The menu is still being planned
          </h4>
          <p className="text-muted-foreground mt-2">
            The organizer hasn&apos;t set up potluck categories for this event yet. Check back soon!
          </p>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          <div className="no-scrollbar -mx-5 overflow-x-auto px-5 pb-2">
            <div className="flex gap-4">
              {showAddDishCard && <AddDishCard eventId={eventId} />}
              {Object.entries(slotsByCategory).map(([category, slots]) => {
                const dishes = slots.flatMap((slot) => slot.signups).slice(0, 4);
                return (
                  <PotluckCategoryCard
                    key={category}
                    category={category}
                    dishes={dishes}
                    totalSlots={slots.length}
                    isLoggedIn={isLoggedIn}
                  />
                );
              })}
            </div>
          </div>
          <Link
            href={`/events/${eventId}/potluck`}
            className="rounded-pill bg-foreground text-background press hover:bg-foreground/90 inline-flex w-fit items-center gap-2 px-5 py-2.5 text-sm font-semibold transition-all"
            data-testid="event-detail-potluck-cta"
          >
            {userRsvpConfirmed ? 'Manage your dishes' : 'Browse the potluck menu'}
          </Link>
        </div>
      )}
    </section>
  );
}

function PotluckCategoryCard({
  category,
  dishes,
  totalSlots,
  isLoggedIn,
}: {
  category: string;
  dishes: PotluckSignupPrivate[];
  totalSlots: number;
  isLoggedIn: boolean;
}) {
  const colorByCategory: Record<string, string> = {
    MAIN: 'bg-terracotta/15 text-terracotta',
    SIDE: 'bg-sage/20 text-sage',
    DESSERT: 'bg-sunlight/30 text-[#a07c2f]',
    DRINK: 'bg-secondary text-foreground',
    OTHER: 'bg-secondary text-muted-foreground',
  };
  const chipColor = colorByCategory[category] ?? 'bg-secondary text-foreground';

  const visibleDishes = isLoggedIn ? dishes : dishes.slice(0, 2);
  const hiddenDishesCount = dishes.length - visibleDishes.length;

  return (
    <div className="bg-card shadow-card ring-border/60 w-[260px] shrink-0 rounded-3xl p-6 ring-1 md:w-[280px]">
      <span
        className={`rounded-pill inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold tracking-wider uppercase ${chipColor}`}
      >
        <span>{POTLUCK_CATEGORY_EMOJIS[category] || '📦'}</span>
        {POTLUCK_CATEGORY_LABELS[category] || category}
      </span>
      {dishes.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {visibleDishes.map((dish) => (
            <li key={dish.id}>
              <p className="font-display text-foreground text-lg leading-tight font-medium">
                {dish.dishName}
              </p>
              {isLoggedIn && (
                <p className="text-muted-foreground mt-1 text-xs">
                  {dish.servings > 1 ? `${dish.servings} servings · ` : ''}Brought by{' '}
                  {dish.rsvp.user?.household?.name || dish.rsvp.user?.name || 'A friend'}
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground mt-4 text-sm italic">
          We could use a hand here — want to bring something?
        </p>
      )}
      {totalSlots > 0 && (
        <p className="text-muted-foreground mt-4 text-xs">
          {totalSlots} {totalSlots === 1 ? 'slot' : 'slots'} total
        </p>
      )}
      {!isLoggedIn && hiddenDishesCount > 0 && (
        <p className="text-terracotta mt-3 text-xs italic">
          + {hiddenDishesCount} more {hiddenDishesCount === 1 ? 'dish' : 'dishes'} — sign in to see
          who&apos;s bringing what
        </p>
      )}
    </div>
  );
}

function AddDishCard({ eventId }: { eventId: string }) {
  return (
    <Link
      href={`/events/${eventId}/potluck`}
      className="border-sage/40 hover:bg-sage/5 flex w-[260px] shrink-0 flex-col items-center justify-center rounded-3xl border-2 border-dashed bg-transparent p-6 text-center transition-colors md:w-[280px]"
    >
      <div className="bg-sage/15 flex h-12 w-12 items-center justify-center rounded-full text-2xl">
        🍴
      </div>
      <h4 className="font-display text-foreground mt-3 text-lg font-semibold">Bring a dish</h4>
      <p className="text-muted-foreground mt-1 text-sm">
        Pick an open slot and tell us what you are bringing.
      </p>
    </Link>
  );
}
