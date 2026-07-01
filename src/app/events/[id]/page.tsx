import { prisma } from '~/lib/prisma';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EventDetailPage({ params }: Props) {
  const { id } = await params;
  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      potluckSlots: {
        orderBy: { category: 'asc' },
        include: {
          signups: {
            include: {
              rsvp: {
                include: {
                  user: {
                    include: {
                      household: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      photos: {
        orderBy: { createdAt: 'desc' },
        take: 12,
        include: {
          reactions: true,
        },
      },
      rsvps: {
        include: {
          user: {
            include: {
              household: true,
            },
          },
        },
      },
      invitations: {
        include: {
          user: {
            include: {
              household: true,
            },
          },
          household: true,
        },
      },
    },
  });

  if (!event) {
    notFound();
  }

  const eventDate = new Date(event.date);
  const now = new Date();
  const isPast = eventDate < now;

  const confirmedUserIds = new Set(
    event.rsvps.filter((r) => r.status === 'CONFIRMED').map((r) => r.userId),
  );
  const pendingInvitations = event.invitations.filter(
    (inv) => inv.userId && !confirmedUserIds.has(inv.userId),
  );

  const slotsByCategory = event.potluckSlots.reduce(
    (acc, slot) => {
      if (!acc[slot.category]) {
        acc[slot.category] = [];
      }
      acc[slot.category]!.push(slot);
      return acc;
    },
    {} as Record<string, typeof event.potluckSlots>,
  );

  const categoryLabels: Record<string, string> = {
    MAIN: 'Main Dishes',
    SIDE: 'Side Dishes',
    DESSERT: 'Desserts',
    DRINK: 'Drinks',
    OTHER: 'Other Items',
  };

  const categoryEmojis: Record<string, string> = {
    MAIN: '🍖',
    SIDE: '🥗',
    DESSERT: '🍰',
    DRINK: '🥤',
    OTHER: '📦',
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <Link
        href="/events"
        className="inline-flex items-center gap-2 text-amber-700 hover:text-amber-900"
      >
        <span>←</span> Back to Events
      </Link>

      <div className="mt-8 rounded-2xl bg-white p-8 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-stone-900">{event.name}</h1>
            <p className="mt-2 text-lg text-stone-600">
              {eventDate.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}{' '}
              at{' '}
              {eventDate.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {isPast && (
              <span className="rounded-full bg-stone-100 px-4 py-2 text-sm text-stone-600">
                Past Event
              </span>
            )}
            <span
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                event.status === 'PUBLISHED'
                  ? 'bg-green-100 text-green-700'
                  : event.status === 'DRAFT'
                    ? 'bg-yellow-100 text-yellow-700'
                    : event.status === 'CANCELLED'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-stone-100 text-stone-600'
              }`}
            >
              {event.status.charAt(0) + event.status.slice(1).toLowerCase()}
            </span>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-4 text-stone-500">
          <span className="text-xl">📍</span>
          <span className="text-lg">{event.location}</span>
        </div>

        <p className="mt-6 text-stone-700">{event.description}</p>

        {event.maxCapacity && (
          <div className="mt-6 rounded-lg bg-amber-50 p-4 text-amber-800">
            <span className="font-medium">Max Capacity:</span> {event.maxCapacity} people
          </div>
        )}

        {event.rsvpDeadline && new Date(event.rsvpDeadline) > now && (
          <div className="mt-4 rounded-lg bg-stone-100 p-4 text-stone-700">
            <span className="font-medium">RSVP Deadline:</span>{' '}
            {new Date(event.rsvpDeadline).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </div>
        )}

        {event.mapImageUrl && (
          <div className="mt-6">
            <h3 className="text-lg font-medium text-stone-900">Event Location</h3>
            <div className="relative mt-2 aspect-video overflow-hidden rounded-lg bg-stone-100">
              <Image
                src={event.mapImageUrl}
                alt={`Map for ${event.location}`}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </div>
            <p className="mt-2 flex items-center gap-2 text-stone-600">
              <span>📍</span>
              <span>{event.location}</span>
            </p>
          </div>
        )}

        {event.rsvps.length > 0 && (
          <div className="mt-6 rounded-lg bg-stone-50 p-4">
            <div className="flex items-center gap-2 text-lg font-medium text-stone-900">
              <span>📋</span>
              <span>RSVP Summary</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="rounded-lg bg-white p-3 text-center">
                <div className="text-2xl font-bold text-green-600">
                  {event.rsvps
                    .filter((r) => r.status === 'CONFIRMED')
                    .reduce((sum, r) => sum + r.headcount, 0)}
                </div>
                <div className="text-sm text-stone-500">Attending</div>
              </div>
              <div className="rounded-lg bg-white p-3 text-center">
                <div className="text-2xl font-bold text-amber-600">
                  {event.rsvps.filter((r) => r.status === 'PENDING').length}
                </div>
                <div className="text-sm text-stone-500">Pending</div>
              </div>
              <div className="rounded-lg bg-white p-3 text-center">
                <div className="text-2xl font-bold text-red-600">
                  {event.rsvps.filter((r) => r.status === 'DECLINED').length}
                </div>
                <div className="text-sm text-stone-500">Declined</div>
              </div>
              <div className="rounded-lg bg-white p-3 text-center">
                <div className="text-2xl font-bold text-stone-600">
                  {event.rsvps.reduce((sum, r) => sum + r.headcount, 0)}
                </div>
                <div className="text-sm text-stone-500">Total Headcount</div>
              </div>
            </div>
            {event.maxCapacity && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-stone-600">
                    {event.rsvps
                      .filter((r) => r.status === 'CONFIRMED')
                      .reduce((sum, r) => sum + r.headcount, 0)}{' '}
                    / {event.maxCapacity} spots filled
                  </span>
                  <span className="text-stone-500">
                    {Math.round(
                      (event.rsvps
                        .filter((r) => r.status === 'CONFIRMED')
                        .reduce((sum, r) => sum + r.headcount, 0) /
                        event.maxCapacity) *
                        100,
                    )}
                    % capacity
                  </span>
                </div>
                <div className="mt-1 h-2 w-full rounded-full bg-stone-200">
                  <div
                    className="h-2 rounded-full bg-amber-500 transition-all"
                    style={{
                      width: `${Math.min(100, (event.rsvps.filter((r) => r.status === 'CONFIRMED').reduce((sum, r) => sum + r.headcount, 0) / event.maxCapacity) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}
            {event.rsvps.filter((r) => r.status === 'CONFIRMED').length > 0 && (
              <div className="mt-6">
                <h3 className="text-md font-medium text-stone-900">Confirmed Attendees</h3>
                <ul className="mt-2 space-y-1">
                  {event.rsvps
                    .filter((r) => r.status === 'CONFIRMED')
                    .map((rsvp) => {
                      const respondedDate = rsvp.respondedAt ? new Date(rsvp.respondedAt) : null;
                      const daysAgo = respondedDate
                        ? Math.floor(
                            (now.getTime() - respondedDate.getTime()) / (1000 * 60 * 60 * 24),
                          )
                        : null;
                      const timeAgoStr =
                        daysAgo !== null
                          ? daysAgo === 0
                            ? 'today'
                            : daysAgo === 1
                              ? '1 day ago'
                              : `${daysAgo} days ago`
                          : null;

                      return (
                        <li
                          key={rsvp.id}
                          className="flex flex-wrap items-center gap-2 text-stone-700"
                        >
                          <span className="text-green-500">✓</span>
                          <span>{rsvp.user.household?.name || rsvp.user.name}</span>
                          {rsvp.headcount > 1 && (
                            <span className="text-sm text-stone-500">
                              +{rsvp.headcount - 1} guest{rsvp.headcount > 2 ? 's' : ''}
                            </span>
                          )}
                          {rsvp.dietaryNotes && (
                            <span className="text-sm text-amber-600">🥗 {rsvp.dietaryNotes}</span>
                          )}
                          {timeAgoStr && (
                            <span className="text-xs text-stone-400">({timeAgoStr})</span>
                          )}
                        </li>
                      );
                    })}
                </ul>
              </div>
            )}
            {event.rsvps.filter((r) => r.status === 'DECLINED').length > 0 && (
              <div className="mt-6">
                <h3 className="text-md font-medium text-stone-900">Declined Attendees</h3>
                <ul className="mt-2 space-y-1">
                  {event.rsvps
                    .filter((r) => r.status === 'DECLINED')
                    .map((rsvp) => {
                      const respondedDate = rsvp.respondedAt ? new Date(rsvp.respondedAt) : null;
                      const daysAgo = respondedDate
                        ? Math.floor(
                            (now.getTime() - respondedDate.getTime()) / (1000 * 60 * 60 * 24),
                          )
                        : null;
                      const timeAgoStr =
                        daysAgo !== null
                          ? daysAgo === 0
                            ? 'today'
                            : daysAgo === 1
                              ? '1 day ago'
                              : `${daysAgo} days ago`
                          : null;

                      return (
                        <li
                          key={rsvp.id}
                          className="flex flex-wrap items-center gap-2 text-stone-700"
                        >
                          <span className="text-red-500">✗</span>
                          <span>{rsvp.user.household?.name || rsvp.user.name}</span>
                          {rsvp.dietaryNotes && (
                            <span className="text-sm text-amber-600">🥗 {rsvp.dietaryNotes}</span>
                          )}
                          {timeAgoStr && (
                            <span className="text-xs text-stone-400">({timeAgoStr})</span>
                          )}
                        </li>
                      );
                    })}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {pendingInvitations.length > 0 && (
        <div className="mt-8 rounded-2xl bg-white p-8 shadow-sm">
          <div className="flex items-center gap-2 text-lg font-medium text-stone-900">
            <span>✉️</span>
            <span>Pending Invitations</span>
          </div>
          <p className="mt-2 text-stone-600">
            These guests have been invited but haven&apos;t responded yet
          </p>
          <ul className="mt-4 space-y-2">
            {pendingInvitations.map((inv) => (
              <li key={inv.id} className="flex items-center gap-2 text-stone-700">
                <span className="text-amber-500">⏳</span>
                <span>{inv.household?.name || inv.user?.name || 'Unknown'}</span>
                {inv.status === 'SENT' && (
                  <span className="text-xs text-stone-400">(invitation sent)</span>
                )}
                {inv.status === 'DELIVERED' && (
                  <span className="text-xs text-stone-400">(delivered)</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-2xl font-bold text-stone-900">Potluck Sign-ups</h2>
        <p className="mt-2 text-stone-600">Sign up to bring a dish for this event</p>

        {event.potluckSlots.length === 0 ? (
          <div className="mt-6 rounded-2xl bg-amber-50 p-8 text-center">
            <div className="text-5xl">🍴</div>
            <h3 className="mt-4 text-xl font-semibold text-amber-900">No Potluck Slots Yet</h3>
            <p className="mt-2 text-amber-700">
              The organizer hasn&apos;t set up potluck sign-ups for this event yet.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {Object.entries(slotsByCategory).map(([category, slots]) => (
              <div key={category} className="rounded-xl bg-white p-6 shadow-sm">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-stone-900">
                  <span className="text-2xl">{categoryEmojis[category] || '📦'}</span>
                  {categoryLabels[category] || category}
                </h3>
                <div className="mt-4 space-y-3">
                  {slots.map((slot) => (
                    <div key={slot.id} className="rounded-lg border border-stone-200 p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-stone-900">{slot.name}</p>
                          <p className="text-sm text-stone-500">
                            {slot.slotType === 'UNLIMITED'
                              ? 'Unlimited signups'
                              : `${slot.currentSignups}/${slot.maxSignups} slots filled`}
                          </p>
                        </div>
                        {slot.slotType === 'LIMITED' &&
                        slot.currentSignups < (slot.maxSignups || 0) ? (
                          <button className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700">
                            Sign Up
                          </button>
                        ) : slot.slotType === 'UNLIMITED' ? (
                          <button className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700">
                            Sign Up
                          </button>
                        ) : (
                          <span className="rounded-lg bg-stone-100 px-3 py-2 text-sm text-stone-500">
                            Full
                          </span>
                        )}
                      </div>
                      {slot.signups.length > 0 && (
                        <div className="mt-3 border-t border-stone-100 pt-3">
                          <p className="text-sm font-medium text-stone-700">Who&apos;s bringing:</p>
                          <ul className="mt-1 space-y-1">
                            {slot.signups.map((signup) => (
                              <li
                                key={signup.id}
                                className="flex flex-wrap items-center gap-2 text-sm text-stone-600"
                              >
                                <span className="text-green-500">✓</span>
                                <span className="font-medium">{signup.dishName}</span>
                                <span className="text-stone-400">
                                  by {signup.rsvp.user.household?.name || signup.rsvp.user.name}
                                </span>
                                {signup.servings > 1 && (
                                  <span className="text-stone-400">
                                    (serving {signup.servings})
                                  </span>
                                )}
                                {signup.dietaryLabels.length > 0 && (
                                  <span className="text-xs text-amber-600">
                                    🥗 {signup.dietaryLabels.join(', ')}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8">
        <h2 className="text-2xl font-bold text-stone-900">Event Photos</h2>
        <p className="mt-2 text-stone-600">Captured moments from this gathering</p>

        {event.photos.length === 0 ? (
          <div className="mt-6 rounded-2xl bg-stone-50 p-8 text-center">
            <div className="text-5xl">📷</div>
            <h3 className="mt-4 text-xl font-semibold text-stone-700">No Photos Yet</h3>
            <p className="mt-2 text-stone-500">
              Photos from this event will appear here once shared.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {event.photos.map((photo) => {
              const reactionCounts = photo.reactions.reduce(
                (acc, r) => {
                  acc[r.reaction] = (acc[r.reaction] || 0) + 1;
                  return acc;
                },
                {} as Record<string, number>,
              );
              const topReactions = Object.entries(reactionCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([emoji]) => emoji);

              return (
                <div
                  key={photo.id}
                  className="group relative aspect-square overflow-hidden rounded-xl bg-stone-100"
                >
                  <Image
                    src={photo.thumbnailUrl || photo.url}
                    alt={photo.caption || 'Event photo'}
                    fill
                    sizes="(max-width: 768px) 50vw, 25vw"
                    className="object-cover transition-transform group-hover:scale-105"
                  />
                  {photo.caption && (
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                      <p className="text-sm text-white">{photo.caption}</p>
                    </div>
                  )}
                  {topReactions.length > 0 && (
                    <div className="absolute top-2 left-2 flex gap-1">
                      {topReactions.map((emoji) => (
                        <span
                          key={emoji}
                          className="rounded-full bg-black/50 px-2 py-1 text-xs text-white backdrop-blur-sm"
                        >
                          {emoji} {reactionCounts[emoji]}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
