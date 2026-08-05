import Link from 'next/link';

interface PotluckManageCardProps {
  eventId: string;
  mySignupCount: number;
  hasOpenSlots: boolean;
}

export function PotluckManageCard({
  eventId,
  mySignupCount,
  hasOpenSlots,
}: PotluckManageCardProps) {
  return (
    <div className="bg-foreground shadow-pop overflow-hidden rounded-3xl p-7 md:p-9">
      <div className="flex flex-col items-start justify-between gap-5 md:flex-row md:items-center">
        <div>
          <p className="text-sunlight text-sm font-semibold tracking-widest uppercase">
            Your dishes
          </p>
          <h2 className="font-display text-background mt-2 text-2xl font-medium tracking-tight md:text-3xl">
            {mySignupCount > 0
              ? `You're bringing ${mySignupCount} ${mySignupCount === 1 ? 'dish' : 'dishes'}`
              : 'Bring something to share'}
          </h2>
          <p className="text-background/75 mt-2 text-sm md:text-base">
            {hasOpenSlots
              ? 'Pick a slot from the menu below. Add or drop dishes any time before the event.'
              : 'All slots are currently filled. Check back later as things change.'}
          </p>
        </div>
        <Link
          href={`/events/${eventId}?openRsvp=potluck`}
          className="rounded-pill bg-terracotta shadow-pop press shrink-0 px-6 py-3 text-sm font-semibold text-white transition-all hover:scale-[1.02] hover:bg-[#cf6c52]"
        >
          {mySignupCount > 0 ? 'Edit my slots' : 'Add a dish'}
        </Link>
      </div>
    </div>
  );
}
