import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import OfflineBanner from '../OfflineBanner';

vi.mock('~/hooks/useOffline', () => ({
  useOffline: vi.fn(),
}));

import { useOffline } from '~/hooks/useOffline';
const mockUseOffline = useOffline as ReturnType<typeof vi.fn>;

describe('OfflineBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when online', () => {
    mockUseOffline.mockReturnValue({ isOnline: true, lastOnline: new Date() });
    const { container } = render(<OfflineBanner />);
    expect(container.innerHTML).toBe('');
  });

  it('shows banner when offline', () => {
    mockUseOffline.mockReturnValue({ isOnline: false, lastOnline: null });
    render(<OfflineBanner />);
    expect(
      screen.getByText('You are currently offline. Some features are disabled.'),
    ).toBeInTheDocument();
  });

  it('renders the offline icon when offline', () => {
    mockUseOffline.mockReturnValue({ isOnline: false, lastOnline: null });
    render(<OfflineBanner />);
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });
});
