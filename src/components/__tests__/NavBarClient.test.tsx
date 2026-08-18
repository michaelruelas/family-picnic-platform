import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';

let mockPathname = '/';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => mockPathname,
  useSearchParams: () => new URLSearchParams(),
}));

const mockUseSession = vi.fn();
const mockSignOut = vi.fn();
vi.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
  signOut: (...args: unknown[]) => mockSignOut(...args),
}));

const mockSetTheme = vi.fn();
vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light', setTheme: mockSetTheme }),
}));

// FPP-148: navbar reads the latest published event via tRPC so it can
// render the "Event" link. Mock the trpc-client so the test does not
// need a tRPC provider.
const mockLatestEventQuery = {
  data: null as { id: string; name: string } | null,
  isLoading: false,
  error: null as Error | null,
};
vi.mock('~/lib/trpc-client', () => ({
  trpc: {
    event: {
      getLatest: {
        useQuery: () => mockLatestEventQuery,
      },
    },
  },
}));

const { default: NavBarClient } = await import('../NavBarClient');

beforeEach(() => {
  mockUseSession.mockReset();
  mockSignOut.mockReset();
  mockSetTheme.mockReset();
  mockUseSession.mockReturnValue({
    data: null,
    status: 'unauthenticated',
  });
  mockLatestEventQuery.data = null;
  mockLatestEventQuery.isLoading = false;
});

afterEach(() => {
  cleanup();
  mockPathname = '/';
});

describe('NavBarClient (FPP-114, FPP-148, FPP-146, FPP-147, FPP-150)', () => {
  it('hides nav on /login', () => {
    mockPathname = '/login';
    const { container } = render(<NavBarClient />);
    expect(container.firstChild).toBeNull();
  });

  it('hides nav on /login with trailing slash', () => {
    mockPathname = '/login/';
    const { container } = render(<NavBarClient />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nav on event pages and public pages for unauthenticated users', () => {
    mockPathname = '/events/event-123';
    render(<NavBarClient />);
    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(screen.getByText('Folia Family Picnic')).toBeInTheDocument();
    expect(screen.getByText('Gathering every year.')).toBeInTheDocument();
    expect(screen.getByText('Sign In')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /switch to dark mode/i })).toBeInTheDocument();
  });

  it('does not render Home, Events, or My Events nav links (FPP-146/147/150)', () => {
    mockUseSession.mockReturnValue({
      data: {
        user: { id: 'u1', name: 'Maria Garcia', email: 'maria@example.com', role: 'USER' },
      },
      status: 'authenticated',
    });
    mockLatestEventQuery.data = { id: 'evt-1', name: 'Annual Picnic' };
    mockPathname = '/events/event-123';
    render(<NavBarClient />);

    expect(screen.queryByRole('link', { name: /^home$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^events$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^my events$/i })).not.toBeInTheDocument();
  });

  it('renders Event link to the latest published event for everyone (FPP-148)', () => {
    mockUseSession.mockReturnValue({
      data: {
        user: { id: 'u1', name: 'Maria Garcia', email: 'maria@example.com', role: 'USER' },
      },
      status: 'authenticated',
    });
    mockLatestEventQuery.data = { id: 'evt-42', name: 'Annual Picnic' };
    mockPathname = '/events/event-123';
    render(<NavBarClient />);

    const eventLink = screen.getByRole('link', { name: /^event$/i });
    expect(eventLink).toHaveAttribute('href', '/events/evt-42');
    expect(screen.getByRole('link', { name: /household/i })).toHaveAttribute('href', '/household');
    expect(screen.getByRole('link', { name: /profile/i })).toHaveAttribute('href', '/profile');
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /admin/i })).not.toBeInTheDocument();
  });

  it('renders Event link when unauthenticated (FPP-148)', () => {
    mockLatestEventQuery.data = { id: 'evt-99', name: 'Annual Picnic' };
    mockPathname = '/';
    render(<NavBarClient />);

    const eventLink = screen.getByRole('link', { name: /^event$/i });
    expect(eventLink).toHaveAttribute('href', '/events/evt-99');
  });

  it('hides the Event link when no published event exists (FPP-148)', () => {
    mockLatestEventQuery.data = null;
    mockPathname = '/';
    render(<NavBarClient />);

    expect(screen.queryByRole('link', { name: /^event$/i })).not.toBeInTheDocument();
  });

  it('renders admin link for super admin users', () => {
    mockUseSession.mockReturnValue({
      data: {
        user: { id: 'u1', name: 'Admin', email: 'admin@example.com', role: 'SUPER_ADMIN' },
      },
      status: 'authenticated',
    });
    mockPathname = '/events/event-123';
    render(<NavBarClient />);

    expect(screen.getByRole('link', { name: /admin/i })).toHaveAttribute(
      'href',
      '/admin/dashboard',
    );
  });

  it('calls signOut when Sign Out button is clicked', () => {
    mockUseSession.mockReturnValue({
      data: {
        user: { id: 'u1', name: 'Maria Garcia', email: 'maria@example.com', role: 'USER' },
      },
      status: 'authenticated',
    });
    mockPathname = '/events/event-123';
    render(<NavBarClient />);

    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: '/' });
  });

  it('toggles theme when theme button is clicked', () => {
    mockPathname = '/events/event-123';
    render(<NavBarClient />);

    fireEvent.click(screen.getByRole('button', { name: /switch to dark mode/i }));
    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  it('opens mobile navigation menu when hamburger button is clicked', () => {
    mockUseSession.mockReturnValue({
      data: {
        user: { id: 'u1', name: 'Maria Garcia', email: 'maria@example.com', role: 'USER' },
      },
      status: 'authenticated',
    });
    mockPathname = '/events/event-123';
    render(<NavBarClient />);

    expect(screen.queryByTestId('mobile-nav-menu')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /open navigation menu/i }));
    expect(screen.getByTestId('mobile-nav-menu')).toBeInTheDocument();
  });
});
