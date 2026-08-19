import { type PublicAttendee } from './EventSectionTabs';

interface PublicAttendeeListProps {
  attendees: PublicAttendee[];
}

/**
 * FPP-151: publicly visible "Who's coming" list on the event page.
 * Households are the primary row; member first names are sub-rows so
 * the household groups its attendees visually while still showing
 * each individual on its own line.
 *
 * Renders nothing when the list is empty so the section can be
 * included unconditionally from `EventSectionTabs` without a
 * dangling "no one yet" placeholder on early-lifecycle events.
 *
 * Shape contract:
 * - `householdName` is a stable label per group
 * - `attendingFirstNames` is a list of first-name strings, ONE per
 *   `RsvpMemberAttendance` row with `attending = YES` (already
 *   filtered + count-checked upstream in `page.tsx`)
 */
export function PublicAttendeeList({ attendees }: PublicAttendeeListProps) {
  if (attendees.length === 0) return null;

  const totalMembers = attendees.reduce((sum, g) => sum + g.attendingFirstNames.length, 0);
  const householdCount = attendees.length;

  return (
    <div data-testid="public-attendee-list">
      <header className="mb-6">
        <h2 className="font-display text-foreground text-3xl font-medium tracking-tight md:text-4xl">
          Who&apos;s coming
        </h2>
        <p className="text-muted-foreground mt-2 text-sm">
          {totalMembers} {totalMembers === 1 ? 'person' : 'people'} from {householdCount}{' '}
          {householdCount === 1 ? 'household' : 'households'} so far.
        </p>
      </header>

      <table className="text-foreground w-full text-left" data-testid="public-attendee-table">
        <thead>
          <tr className="border-border border-y">
            <th
              scope="col"
              className="text-muted-foreground py-2 pr-4 text-xs font-semibold tracking-widest uppercase"
            >
              Attending members
            </th>
          </tr>
        </thead>
        <tbody>
          {attendees.map((group) => (
            <HouseholdGroup key={group.householdName} {...group} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HouseholdGroup({ householdName, attendingFirstNames }: PublicAttendee) {
  const count = attendingFirstNames.length;
  return (
    <>
      <tr
        className="bg-secondary/40 border-border/60 border-t"
        data-testid="public-attendee-household"
      >
        <th scope="rowgroup" className="text-foreground px-3 py-3 text-base font-semibold">
          {householdName}{' '}
          <span className="text-muted-foreground ml-1 text-sm font-normal">({count})</span>
        </th>
      </tr>
      {attendingFirstNames.map((firstName, idx) => (
        <tr key={`${householdName}-${firstName}-${idx}`} data-testid="public-attendee-member">
          <td className="border-border/30 border-t px-3 py-2 pl-8 text-sm font-medium">
            {firstName}
          </td>
        </tr>
      ))}
    </>
  );
}

export default PublicAttendeeList;
