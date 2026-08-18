import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PublicAttendeeList } from '../PublicAttendeeList';
import { type PublicAttendee } from '../EventSectionTabs';

const SAMPLE: PublicAttendee[] = [
  { householdName: 'The Garcia Family', attendingFirstNames: ['Maria', 'Carlos'] },
  { householdName: 'The Thompson Family', attendingFirstNames: ['Lisa'] },
];

describe('PublicAttendeeList (FPP-151)', () => {
  it('renders one card per household with names joined by comma', () => {
    render(<PublicAttendeeList attendees={SAMPLE} />);
    const list = screen.getByTestId('public-attendee-list');
    expect(list).toBeInTheDocument();

    // The Garcia Family card lists Maria + Carlos in one card.
    const garciaCard = screen.getByText('The Garcia Family').closest('li')!;
    expect(garciaCard).toHaveTextContent('Maria, Carlos are going');

    // Single-member household uses the singular "is going".
    const thompsonCard = screen.getByText('The Thompson Family').closest('li')!;
    expect(thompsonCard).toHaveTextContent('Lisa is going');
  });

  it('renders nothing when the attendee list is empty', () => {
    const { container } = render(<PublicAttendeeList attendees={[]} />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId('public-attendee-list')).not.toBeInTheDocument();
  });

  it('handles a single attending member with the singular verb form', () => {
    render(
      <PublicAttendeeList attendees={[{ householdName: 'Solo', attendingFirstNames: ['Ada'] }]} />,
    );
    expect(screen.getByText('Ada is going')).toBeInTheDocument();
  });
});
