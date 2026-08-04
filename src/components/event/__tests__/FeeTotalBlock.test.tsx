import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FeeTotalBlock, buildPerAttendeeTooltip } from '../FeeTotalBlock';

describe('FeeTotalBlock', () => {
  describe('render condition (AC: hide when amountCents is 0)', () => {
    it('renders nothing when amountCents is 0', () => {
      const { container } = render(
        <FeeTotalBlock amountCents={0} currency="usd" perAttendeeCents={2500} />,
      );
      expect(container.firstChild).toBeNull();
      expect(screen.queryByText(/Registration fee total/)).not.toBeInTheDocument();
    });

    it('renders nothing when amountCents is negative', () => {
      const { container } = render(<FeeTotalBlock amountCents={-100} currency="usd" />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('rendered output', () => {
    it('shows the formatted fee total when amountCents > 0', () => {
      render(<FeeTotalBlock amountCents={5000} currency="usd" />);
      expect(screen.getByText('$50.00')).toBeInTheDocument();
      expect(screen.getByText(/Registration fee total/)).toBeInTheDocument();
    });

    it('respects the currency prop', () => {
      render(<FeeTotalBlock amountCents={5000} currency="eur" />);
      // Compute the exact Intl output so a stray `5000 attendees`
      // substring can never silently satisfy this assertion.
      const expectedEur = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'EUR',
      }).format(50);
      expect(screen.queryByText('$50.00')).not.toBeInTheDocument();
      expect(screen.getByText(expectedEur)).toBeInTheDocument();
    });

    it('renders a snapshot caveat line so users know the total is frozen at RSVP time', () => {
      render(<FeeTotalBlock amountCents={2500} currency="usd" />);
      expect(screen.getByText(/Snapshot at RSVP time/)).toBeInTheDocument();
    });
  });

  describe('tooltip (AC: explain per-attendee fee rule)', () => {
    it('renders an element with a title attribute that explains the per-attendee rule', () => {
      render(
        <FeeTotalBlock
          amountCents={5000}
          currency="usd"
          perAttendeeCents={2500}
          qualifyingAttendees={2}
        />,
      );
      const tooltipText =
        'Each registration is charged $25.00 per attending member. Yours has 2 attendees qualifying.';
      // The wrapper div carries the title (hover tooltip). The info
      // button carries both an aria-label and its own title so screen
      // readers and keyboard users can both surface the text. Two
      // elements own the same title — that's intentional redundancy.
      const titles = screen.getAllByTitle(tooltipText);
      expect(titles.length).toBeGreaterThanOrEqual(2);
      expect(screen.getByLabelText(tooltipText)).toBeInTheDocument();
    });

    it('singularizes the count when one attendee qualifies', () => {
      render(
        <FeeTotalBlock
          amountCents={2500}
          currency="usd"
          perAttendeeCents={2500}
          qualifyingAttendees={1}
        />,
      );
      expect(screen.getAllByTitle(/Yours has 1 attendee qualifying\./)).not.toHaveLength(0);
    });

    it('omits the qualifying-count line when no count is passed', () => {
      render(<FeeTotalBlock amountCents={2500} currency="usd" perAttendeeCents={2500} />);
      expect(
        screen.getAllByTitle(/Attendance changes update the total on the event page\./),
      ).not.toHaveLength(0);
    });

    it('mentions the min age when set above zero', () => {
      render(
        <FeeTotalBlock amountCents={2500} currency="usd" perAttendeeCents={2500} minAge={13} />,
      );
      expect(screen.getAllByTitle(/age 13\+/)).not.toHaveLength(0);
    });

    it('omits the age clause when minAge is 0', () => {
      render(
        <FeeTotalBlock amountCents={2500} currency="usd" perAttendeeCents={2500} minAge={0} />,
      );
      expect(screen.queryByTitle(/age 0\+/)).not.toBeInTheDocument();
    });
  });
});

describe('buildPerAttendeeTooltip', () => {
  it('uses a generic phrase when the per-attendee amount is omitted', () => {
    expect(buildPerAttendeeTooltip({ currency: 'usd' })).toBe(
      'Each registration is charged the per-attendee fee per attending member. Attendance changes update the total on the event page.',
    );
  });

  it('includes the formatted per-attendee amount and the qualifying count when supplied', () => {
    expect(
      buildPerAttendeeTooltip({
        perAttendeeCents: 2500,
        currency: 'usd',
        qualifyingAttendees: 3,
      }),
    ).toBe(
      'Each registration is charged $25.00 per attending member. Yours has 3 attendees qualifying.',
    );
  });
});
