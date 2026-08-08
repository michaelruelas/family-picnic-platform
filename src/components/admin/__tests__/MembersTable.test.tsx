import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { RsvpAttending, RSVPStatus } from '~/lib/generated/enums';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/events/e1/members',
  useSearchParams: () => new URLSearchParams(),
}));

const { default: MembersTable } = await import('../MembersTable');

const rows = [
  {
    id: 'm1',
    memberName: 'Maria Garcia',
    memberAge: 35,
    relationship: 'SELF',
    attending: RsvpAttending.YES,
    rsvpStatus: RSVPStatus.CONFIRMED,
    householdId: 'h1',
    householdName: 'The Garcia Family',
    rsvpId: 'r1',
    respondedAt: '2026-08-01T10:00:00.000Z',
    dishName: 'Paella',
  },
  {
    id: 'm2',
    memberName: 'Carlos Garcia',
    memberAge: 8,
    relationship: 'CHILD',
    attending: RsvpAttending.MAYBE,
    rsvpStatus: RSVPStatus.CONFIRMED,
    householdId: 'h1',
    householdName: 'The Garcia Family',
    rsvpId: 'r1',
    respondedAt: '2026-08-01T10:00:00.000Z',
    dishName: null,
  },
];

describe('MembersTable', () => {
  it('renders the per-member rows with household + dish', () => {
    render(
      <MembersTable
        initialRows={rows}
        eventId="e1"
        eventStatus="PUBLISHED"
        eventName="Folia Picnic"
        eventDate="September 12, 2026"
        counts={{ [RsvpAttending.YES]: 1, [RsvpAttending.NO]: 0, [RsvpAttending.MAYBE]: 1 }}
      />,
    );

    expect(screen.getByText('Maria Garcia')).toBeInTheDocument();
    expect(screen.getByText('Carlos Garcia')).toBeInTheDocument();
    expect(screen.getByText('Paella')).toBeInTheDocument();
    // The second row has no dish — the cell renders an em-dash.
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it('shows the Going / Maybe / Not going bucket counts', () => {
    render(
      <MembersTable
        initialRows={rows}
        eventId="e1"
        eventStatus="PUBLISHED"
        eventName="Folia Picnic"
        eventDate="September 12, 2026"
        counts={{ [RsvpAttending.YES]: 7, [RsvpAttending.NO]: 2, [RsvpAttending.MAYBE]: 3 }}
      />,
    );
    expect(screen.getAllByText('Going').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Maybe').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Not going').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders the event name as the page heading', () => {
    render(
      <MembersTable
        initialRows={rows}
        eventId="e1"
        eventStatus="PUBLISHED"
        eventName="Folia Picnic"
        eventDate="September 12, 2026"
        counts={{ [RsvpAttending.YES]: 1, [RsvpAttending.NO]: 0, [RsvpAttending.MAYBE]: 0 }}
      />,
    );
    expect(screen.getByRole('heading', { name: /folia picnic/i })).toBeInTheDocument();
  });

  it('renders an empty state when no member rows are provided', () => {
    render(
      <MembersTable
        initialRows={[]}
        eventId="e1"
        eventStatus="PUBLISHED"
        eventName="Folia Picnic"
        eventDate="September 12, 2026"
        counts={{ [RsvpAttending.YES]: 0, [RsvpAttending.NO]: 0, [RsvpAttending.MAYBE]: 0 }}
      />,
    );
    expect(screen.getByText(/no members yet/i)).toBeInTheDocument();
  });

  it('uses the attendingLabel helper to render Going/Maybe/Not going badges', () => {
    render(
      <MembersTable
        initialRows={rows}
        eventId="e1"
        eventStatus="PUBLISHED"
        eventName="Folia Picnic"
        eventDate="September 12, 2026"
        counts={{ [RsvpAttending.YES]: 1, [RsvpAttending.NO]: 0, [RsvpAttending.MAYBE]: 1 }}
      />,
    );
    // The body rows contain "Going" and "Maybe" badges via attendingLabel.
    const table = screen.getByRole('table');
    expect(within(table).getByText('Going')).toBeInTheDocument();
    expect(within(table).getByText('Maybe')).toBeInTheDocument();
  });
});
