import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import EventNav from '../EventNav';

describe('EventNav (FPP-135)', () => {
  it('renders Overview, Potluck, and Gallery tabs', () => {
    render(<EventNav eventId="event-123" dishCount={5} photoCount={3} active="overview" />);

    expect(screen.getByRole('navigation', { name: 'Event sections' })).toBeInTheDocument();
    expect(screen.getByTestId('event-sub-nav-overview')).toBeInTheDocument();
    expect(screen.getByTestId('event-sub-nav-potluck')).toBeInTheDocument();
    expect(screen.getByTestId('event-sub-nav-photos')).toBeInTheDocument();
    expect(screen.getByText('Gallery')).toBeInTheDocument();
  });
});
