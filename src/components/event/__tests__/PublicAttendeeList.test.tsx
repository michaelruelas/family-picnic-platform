import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { PublicAttendeeList } from '../PublicAttendeeList';
import { type PublicAttendee } from '../EventSectionTabs';

const SAMPLE: PublicAttendee[] = [
  { householdName: 'The Garcia Family', attendingFirstNames: ['Maria', 'Carlos'] },
  { householdName: 'The Thompson Family', attendingFirstNames: ['Lisa'] },
];

describe('PublicAttendeeList (FPP-151) — table view', () => {
  it('renders the heading + sub-nav label "Who\'s coming" prominently', () => {
    render(<PublicAttendeeList attendees={SAMPLE} />);
    const heading = screen.getByRole('heading', { level: 2, name: /who.s coming/i });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveTextContent("Who's coming");
  });

  it('shows the household + member totals in the sub-heading', () => {
    render(<PublicAttendeeList attendees={SAMPLE} />);
    // 3 members total across 2 households.
    expect(screen.getByText(/3 people from 2 households so far\./)).toBeInTheDocument();
  });

  it('renders a <table> with one primary row per household', () => {
    render(<PublicAttendeeList attendees={SAMPLE} />);
    const table = screen.getByTestId('public-attendee-table');
    expect(table).toBeInTheDocument();

    const householdRows = screen.getAllByTestId('public-attendee-household');
    expect(householdRows).toHaveLength(2);

    // Each household is a `<th scope="rowgroup">` cell so it reads
    // as the row's heading — visually bold and accessible.
    expect(within(householdRows[0]!).getByText('The Garcia Family')).toBeInTheDocument();
    expect(within(householdRows[1]!).getByText('The Thompson Family')).toBeInTheDocument();
  });

  it('shows one member sub-row per first name', () => {
    render(<PublicAttendeeList attendees={SAMPLE} />);
    const members = screen.getAllByTestId('public-attendee-member');
    expect(members).toHaveLength(3);

    expect(within(members[0]!).getByText('Maria')).toBeInTheDocument();
    expect(within(members[1]!).getByText('Carlos')).toBeInTheDocument();
    expect(within(members[2]!).getByText('Lisa')).toBeInTheDocument();
  });

  it('uses singular copy for a single-member household', () => {
    render(
      <PublicAttendeeList attendees={[{ householdName: 'Solo', attendingFirstNames: ['Ada'] }]} />,
    );
    expect(screen.getByText(/1 person from 1 household so far\./)).toBeInTheDocument();
    expect(screen.getByText('(1 going)')).toBeInTheDocument();
  });

  it('renders nothing when the attendee list is empty', () => {
    const { container } = render(<PublicAttendeeList attendees={[]} />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId('public-attendee-table')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });
});
