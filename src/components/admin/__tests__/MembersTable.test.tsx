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
  it('renders the per-member rows with household and attendance', () => {
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
    // The age column renders an em-dash for any null/undefined age;
    // with these rows no age is null, but the empty-state cell is
    // still part of the palette so we keep the broad assertion.
    const table = screen.getByRole('table');
    expect(within(table).getByText('Going')).toBeInTheDocument();
    expect(within(table).getByText('Maybe')).toBeInTheDocument();
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
    // Scope to the counter tiles so the numbers don't collide
    // with the matching counts inside the attendance filter
    // options (e.g. "All (2)").
    expect(within(screen.getByTestId('counter-going')).getByText('7')).toBeInTheDocument();
    expect(within(screen.getByTestId('counter-not-going')).getByText('2')).toBeInTheDocument();
    expect(within(screen.getByTestId('counter-maybe')).getByText('3')).toBeInTheDocument();
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

describe('MembersTable attendance filter (FPP-138)', () => {
  it('renders the attendance filter with counts from the props', () => {
    render(
      <MembersTable
        initialRows={rows}
        eventId="e1"
        eventStatus={EventStatus.PUBLISHED}
        eventName="Folia Picnic"
        eventDate="September 12, 2026"
        counts={{ [RsvpAttending.YES]: 1, [RsvpAttending.NO]: 0, [RsvpAttending.MAYBE]: 1 }}
        availableHouseholds={[]}
      />,
    );

    const select = screen.getByTestId('attendance-filter') as HTMLSelectElement;
    expect(select.value).toBe('all');
    expect(within(select).getByRole('option', { name: /All \(2\)/ })).toBeInTheDocument();
    expect(within(select).getByRole('option', { name: /Going \(1\)/ })).toBeInTheDocument();
    expect(within(select).getByRole('option', { name: /Maybe \(1\)/ })).toBeInTheDocument();
    expect(within(select).getByRole('option', { name: /Not going \(0\)/ })).toBeInTheDocument();
  });

  it('narrows the table to Going rows when the filter is set to YES', () => {
    render(
      <MembersTable
        initialRows={rows}
        eventId="e1"
        eventStatus={EventStatus.PUBLISHED}
        eventName="Folia Picnic"
        eventDate="September 12, 2026"
        counts={{ [RsvpAttending.YES]: 1, [RsvpAttending.NO]: 0, [RsvpAttending.MAYBE]: 1 }}
        availableHouseholds={[]}
      />,
    );

    fireEvent.change(screen.getByTestId('attendance-filter'), {
      target: { value: RsvpAttending.YES },
    });

    const tbody = screen.getAllByRole('rowgroup')[1]!;
    const dataRows = within(tbody).getAllByRole('row');
    expect(dataRows).toHaveLength(1);
    expect(within(tbody).getByText('Maria Garcia')).toBeInTheDocument();
    expect(within(tbody).queryByText('Carlos Garcia')).not.toBeInTheDocument();
  });

  it('shows an empty-state copy that names the active bucket when the filter has no matches', () => {
    render(
      <MembersTable
        initialRows={rows}
        eventId="e1"
        eventStatus={EventStatus.PUBLISHED}
        eventName="Folia Picnic"
        eventDate="September 12, 2026"
        counts={{ [RsvpAttending.YES]: 1, [RsvpAttending.NO]: 0, [RsvpAttending.MAYBE]: 1 }}
        availableHouseholds={[]}
      />,
    );

    fireEvent.change(screen.getByTestId('attendance-filter'), {
      target: { value: RsvpAttending.NO },
    });

    expect(screen.getByText(/no not going members/i)).toBeInTheDocument();
  });

  it('clicking a counter tile narrows the table to that bucket', () => {
    render(
      <MembersTable
        initialRows={rows}
        eventId="e1"
        eventStatus={EventStatus.PUBLISHED}
        eventName="Folia Picnic"
        eventDate="September 12, 2026"
        counts={{ [RsvpAttending.YES]: 1, [RsvpAttending.NO]: 0, [RsvpAttending.MAYBE]: 1 }}
        availableHouseholds={[]}
      />,
    );

    fireEvent.click(screen.getByTestId('counter-maybe'));

    const tbody = screen.getAllByRole('rowgroup')[1]!;
    expect(within(tbody).queryByText('Maria Garcia')).not.toBeInTheDocument();
    expect(within(tbody).getByText('Carlos Garcia')).toBeInTheDocument();
    expect((screen.getByTestId('attendance-filter') as HTMLSelectElement).value).toBe(
      RsvpAttending.MAYBE,
    );
  });

  it('clicking the same active counter tile again clears the filter back to All', () => {
    render(
      <MembersTable
        initialRows={rows}
        eventId="e1"
        eventStatus={EventStatus.PUBLISHED}
        eventName="Folia Picnic"
        eventDate="September 12, 2026"
        counts={{ [RsvpAttending.YES]: 1, [RsvpAttending.NO]: 0, [RsvpAttending.MAYBE]: 1 }}
        availableHouseholds={[]}
      />,
    );

    const going = screen.getByTestId('counter-going');
    fireEvent.click(going);
    expect((screen.getByTestId('attendance-filter') as HTMLSelectElement).value).toBe(
      RsvpAttending.YES,
    );
    fireEvent.click(going);
    expect((screen.getByTestId('attendance-filter') as HTMLSelectElement).value).toBe('all');
  });
});
