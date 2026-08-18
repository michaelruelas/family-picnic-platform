import { type PublicAttendee } from './EventSectionTabs';

interface PublicAttendeeListProps {
  attendees: PublicAttendee[];
}

/**
 * FPP-151: publicly visible "Who's coming" list on the event page.
 * Groups members by household and surfaces only the household name
 * + first names of members with `attending = YES`. No emails,
 * no user ids, no decline messages — the data is shaped so a guest
 * cannot scrape the household roster for any event.
 *
 * Renders nothing when the list is empty so the section can be
 * included unconditionally from `EventSectionTabs` without a
 * dangling "no one yet" placeholder on early-lifecycle events.
 */
export function PublicAttendeeList({ attendees }: PublicAttendeeListProps) {
  if (attendees.length === 0) return null;

  return (
    <ul className="grid gap-3 sm:grid-cols-2" data-testid="public-attendee-list">
      {attendees.map((group) => {
        const attending = group.attendingFirstNames;
        const joined = attending.join(', ');
        return (
          <li
            key={`${group.householdName}-${attending.join('|')}`}
            className="bg-card ring-border/60 shadow-card flex items-start gap-3 rounded-sm p-4 ring-1"
          >
            <span className="text-terracotta text-xl" aria-hidden="true">
              👨‍👩‍👧
            </span>
            <div className="min-w-0">
              <p className="text-foreground font-semibold">{group.householdName}</p>
              <p className="text-muted-foreground mt-0.5 text-sm">
                {joined}
                {attending.length === 1 ? ' is going' : ' are going'}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default PublicAttendeeList;
