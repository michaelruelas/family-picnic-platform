import { EventRsvpCard } from './EventRsvpCard';
import { EventLocationMap } from './EventLocationMap';
import { type PublicEventAttachment } from './EventDownloadsSection';
import { sanitizeRichText } from '~/lib/sanitize-html';
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
   * Optional attachments list. In Phase 2 (FPP-137), PDF attachments
   * are rendered directly inside the Additional Info tab.
   */
  attachments?: PublicEventAttachment[];
}

/**
 * FPP-46 / FPP-10 / FPP-140 / FPP-139: Header tab content.
 * Renders the "Welcome" heading, event name, prominent consolidated
 * date/time/location metadata, RSVP card, host block, and location map.
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
    existingRsvp,
    hosts,
  } = props;

  const now = new Date();
  const totalPotluckDishes = potluckSlots.reduce((sum, slot) => sum + slot.signups.length, 0);
  const registrationFeeConfig =
    registrationFeeCents && registrationFeeCents > 0
      ? { amountCents: registrationFeeCents, minAge: registrationFeeMinAge, currency }
      : null;

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <div>
          <p className="text-terracotta text-sm font-semibold tracking-widest uppercase">Welcome</p>
          <h2 className="font-display text-foreground mt-1 text-3xl leading-tight font-medium tracking-tight md:text-4xl">
            {eventName}
          </h2>
        </div>
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-5 gap-y-2 text-base md:text-lg">
          <span className="flex items-center gap-2">
            <span className="text-sage" aria-hidden="true">
              📅
            </span>
            <span className="text-foreground font-semibold">
              {eventDate.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </span>
          <span className="text-border hidden sm:inline" aria-hidden="true">
            ·
          </span>
          <span className="flex items-center gap-2">
            <span className="text-terracotta" aria-hidden="true">
              🕒
            </span>
            <span className="text-foreground font-semibold">
              {eventDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </span>
          </span>
          <span className="text-border hidden sm:inline" aria-hidden="true">
            ·
          </span>
          <span className="flex items-center gap-2">
            <span className="text-sage" aria-hidden="true">
              📍
            </span>
            <span className="text-foreground font-semibold">{eventLocation}</span>
          </span>
        </div>
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
    </div>
  );
}

function MetaStrip({
  eventDate: _eventDate,
  eventLocation: _eventLocation,
  attending,
  dishesClaimed,
}: {
  eventDate?: Date;
  eventLocation?: string;
  attending: number;
  dishesClaimed: number;
}) {
  return (
    <div
      className="text-muted-foreground flex flex-wrap items-center gap-x-5 gap-y-2"
      data-testid="event-meta-strip"
    >
      <span className="flex items-center gap-2 text-base">
        <span className="text-sage">👥</span>
        <span className="text-foreground font-medium">{attending} attending</span>
      </span>
      {dishesClaimed > 0 && (
        <>
          <span className="text-border hidden sm:inline">·</span>
          <span className="flex items-center gap-2 text-base">
            <span className="text-terracotta">🍴</span>
            <span className="text-foreground font-medium">
              {dishesClaimed} {dishesClaimed === 1 ? 'dish' : 'dishes'} claimed
            </span>
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
  const safeHtml = sanitizeRichText(description);
  return (
    <div className="bg-card shadow-card ring-border/60 rounded-sm p-7 ring-1 md:p-9">
      <p className="text-terracotta text-sm font-semibold tracking-widest uppercase">The welcome</p>
      <h3 className="font-display text-foreground mt-2 text-3xl font-medium tracking-tight md:text-4xl">
        A note from the host
      </h3>
      <div
        data-testid="host-note"
        className="rich-text-content text-foreground/80 mt-5 text-lg leading-relaxed"
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />
      {maxCapacity && (
        <div className="bg-sunlight/20 text-foreground ring-sunlight/40 mt-6 rounded-sm px-5 py-4 text-sm ring-1">
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
                className="bg-secondary flex items-start gap-3 rounded-sm px-4 py-3"
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
