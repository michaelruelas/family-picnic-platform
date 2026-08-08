import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { RsvpAttending, RSVPStatus, EventStatus } from '~/lib/generated/enums';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/events/e1/members',
  useSearchParams: () => new URLSearchParams(),
}));

const modalProps: Array<Record<string, unknown>> = [];
vi.mock('../AdminRsvpModal', () => ({
  default: function MockAdminRsvpModal(props: Record<string, unknown>) {
    modalProps.push(props);
    return (
      <div data-testid="admin-rsvp-modal">
        <span data-testid="mock-modal-mode">{props.rsvpId ? 'edit' : 'add'}</span>
        <span data-testid="mock-modal-rsvpId">{String(props.rsvpId ?? '')}</span>
        <span data-testid="mock-modal-userId">
          {String((props.targetUser as { id: string } | undefined)?.id ?? '')}
        </span>
      </div>
    );
  },
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
    userId: 'u-garcia-1',
    userName: 'Maria Garcia',
    userEmail: 'maria@example.com',
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
    userId: 'u-garcia-1',
    userName: 'Maria Garcia',
    userEmail: 'maria@example.com',
  },
];

const availableHouseholds = [
  {
    userId: 'u-thompson',
    userName: 'Lisa Thompson',
    userEmail: 'lisa@example.com',
    householdId: 'h-thompson',
    householdName: 'The Thompson Family',
    members: [
      { id: 'tm1', name: 'Lisa Thompson', age: 36, relationship: 'SELF' },
      { id: 'tm2', name: 'Bob Thompson', age: 10, relationship: 'CHILD' },
    ],
  },
];

beforeEach(() => {
  modalProps.length = 0;
});

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
        availableHouseholds={[]}
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
        availableHouseholds={[]}
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
        availableHouseholds={[]}
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
        availableHouseholds={[]}
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
        availableHouseholds={[]}
      />,
    );
    // The body rows contain "Going" and "Maybe" badges via attendingLabel.
    const table = screen.getByRole('table');
    expect(within(table).getByText('Going')).toBeInTheDocument();
    expect(within(table).getByText('Maybe')).toBeInTheDocument();
  });
});

describe('MembersTable → AdminRsvpModal wiring (FPP-102)', () => {
  it('renders the Add RSVP button when there are available households and event is not CANCELLED', () => {
    render(
      <MembersTable
        initialRows={rows}
        eventId="e1"
        eventStatus={EventStatus.PUBLISHED}
        eventName="Folia Picnic"
        eventDate="September 12, 2026"
        counts={{ [RsvpAttending.YES]: 1, [RsvpAttending.NO]: 0, [RsvpAttending.MAYBE]: 0 }}
        availableHouseholds={availableHouseholds}
      />,
    );
    expect(screen.getByTestId('add-rsvp-button')).toBeInTheDocument();
    // Picker starts closed.
    expect(screen.queryByTestId('add-rsvp-picker')).not.toBeInTheDocument();
  });

  it('hides the Add RSVP button when no households are available', () => {
    render(
      <MembersTable
        initialRows={rows}
        eventId="e1"
        eventStatus={EventStatus.PUBLISHED}
        eventName="Folia Picnic"
        eventDate="September 12, 2026"
        counts={{ [RsvpAttending.YES]: 1, [RsvpAttending.NO]: 0, [RsvpAttending.MAYBE]: 0 }}
        availableHouseholds={[]}
      />,
    );
    expect(screen.queryByTestId('add-rsvp-button')).not.toBeInTheDocument();
  });

  it('hides the Add RSVP button while event is CANCELLED', () => {
    render(
      <MembersTable
        initialRows={rows}
        eventId="e1"
        eventStatus={EventStatus.CANCELLED}
        eventName="Folia Picnic"
        eventDate="September 12, 2026"
        counts={{ [RsvpAttending.YES]: 1, [RsvpAttending.NO]: 0, [RsvpAttending.MAYBE]: 0 }}
        availableHouseholds={availableHouseholds}
      />,
    );
    expect(screen.queryByTestId('add-rsvp-button')).not.toBeInTheDocument();
  });

  it('opens the picker, lists households, and opens the add modal with the right props on click', () => {
    render(
      <MembersTable
        initialRows={rows}
        eventId="e1"
        eventStatus={EventStatus.PUBLISHED}
        eventName="Folia Picnic"
        eventDate="September 12, 2026"
        counts={{ [RsvpAttending.YES]: 1, [RsvpAttending.NO]: 0, [RsvpAttending.MAYBE]: 0 }}
        availableHouseholds={availableHouseholds}
      />,
    );

    fireEvent.click(screen.getByTestId('add-rsvp-button'));
    expect(screen.getByTestId('add-rsvp-picker')).toBeInTheDocument();

    // The household is listed with its name + user line.
    const option = screen.getByTestId('add-rsvp-option-u-thompson');
    expect(option).toHaveTextContent('The Thompson Family');
    expect(option).toHaveTextContent('Lisa Thompson · lisa@example.com');

    fireEvent.click(option);

    // Picker is dismissed and the modal opens in add mode with
    // the right userId + household roster.
    expect(screen.queryByTestId('add-rsvp-picker')).not.toBeInTheDocument();
    const modal = screen.getByTestId('admin-rsvp-modal');
    expect(within(modal).getByTestId('mock-modal-mode')).toHaveTextContent('add');
    expect(within(modal).getByTestId('mock-modal-userId')).toHaveTextContent('u-thompson');

    // The captured props include the roster so the add-mode
    // grid can prefill attendance.
    const last = modalProps[modalProps.length - 1]!;
    expect(last.rsvpId).toBeUndefined();
    expect(last.members).toEqual(availableHouseholds[0]!.members);
  });

  it('opens the edit modal with the right props when a row is clicked', () => {
    render(
      <MembersTable
        initialRows={rows}
        eventId="e1"
        eventStatus={EventStatus.PUBLISHED}
        eventName="Folia Picnic"
        eventDate="September 12, 2026"
        counts={{ [RsvpAttending.YES]: 1, [RsvpAttending.NO]: 0, [RsvpAttending.MAYBE]: 0 }}
        availableHouseholds={[]}
      />,
    );

    // Click on the first row. The DataTable uses the first
    // <tr> with data-row-id under the <tbody>.
    const tbody = screen.getAllByRole('rowgroup')[1]!;
    const firstRow = within(tbody).getAllByRole('row')[0]!;
    fireEvent.click(firstRow);

    const modal = screen.getByTestId('admin-rsvp-modal');
    expect(within(modal).getByTestId('mock-modal-mode')).toHaveTextContent('edit');
    expect(within(modal).getByTestId('mock-modal-rsvpId')).toHaveTextContent('r1');
    expect(within(modal).getByTestId('mock-modal-userId')).toHaveTextContent('u-garcia-1');
  });

  it('does not open the edit modal when a row is clicked while event is CANCELLED', () => {
    render(
      <MembersTable
        initialRows={rows}
        eventId="e1"
        eventStatus={EventStatus.CANCELLED}
        eventName="Folia Picnic"
        eventDate="September 12, 2026"
        counts={{ [RsvpAttending.YES]: 1, [RsvpAttending.NO]: 0, [RsvpAttending.MAYBE]: 0 }}
        availableHouseholds={[]}
      />,
    );

    const tbody = screen.getAllByRole('rowgroup')[1]!;
    const firstRow = within(tbody).getAllByRole('row')[0]!;
    fireEvent.click(firstRow);

    // No modal mount; the captured props list stays empty.
    expect(screen.queryByTestId('admin-rsvp-modal')).not.toBeInTheDocument();
    expect(modalProps).toHaveLength(0);
  });

  it('closes the household picker on Escape', () => {
    render(
      <MembersTable
        initialRows={rows}
        eventId="e1"
        eventStatus={EventStatus.PUBLISHED}
        eventName="Folia Picnic"
        eventDate="September 12, 2026"
        counts={{ [RsvpAttending.YES]: 1, [RsvpAttending.NO]: 0, [RsvpAttending.MAYBE]: 0 }}
        availableHouseholds={availableHouseholds}
      />,
    );

    fireEvent.click(screen.getByTestId('add-rsvp-button'));
    expect(screen.getByTestId('add-rsvp-picker')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('add-rsvp-picker')).not.toBeInTheDocument();
  });

  it('closes the household picker on outside click', () => {
    render(
      <MembersTable
        initialRows={rows}
        eventId="e1"
        eventStatus={EventStatus.PUBLISHED}
        eventName="Folia Picnic"
        eventDate="September 12, 2026"
        counts={{ [RsvpAttending.YES]: 1, [RsvpAttending.NO]: 0, [RsvpAttending.MAYBE]: 0 }}
        availableHouseholds={availableHouseholds}
      />,
    );

    fireEvent.click(screen.getByTestId('add-rsvp-button'));
    expect(screen.getByTestId('add-rsvp-picker')).toBeInTheDocument();

    // Click on a part of the page outside the picker (the
    // event-name heading is a safe external target).
    fireEvent.mouseDown(screen.getByRole('heading', { name: /folia picnic/i }));
    expect(screen.queryByTestId('add-rsvp-picker')).not.toBeInTheDocument();
  });
});
