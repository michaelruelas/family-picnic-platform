import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import EventSubNav from '../EventSubNav';

describe('EventSubNav (FPP-135)', () => {
  it('renders Overview and Potluck tabs without Gallery/Photos tab', () => {
    render(<EventSubNav eventId="event-123" dishCount={5} active="overview" />);

    expect(screen.getByRole('navigation', { name: 'Event sections' })).toBeInTheDocument();
    expect(screen.getByTestId('event-sub-nav-overview')).toBeInTheDocument();
    expect(screen.getByTestId('event-sub-nav-potluck')).toBeInTheDocument();
    expect(screen.queryByTestId('event-sub-nav-photos')).not.toBeInTheDocument();
    expect(screen.queryByTestId('event-sub-nav-gallery')).not.toBeInTheDocument();
    expect(screen.queryByText(/gallery/i)).not.toBeInTheDocument();
  });
});
