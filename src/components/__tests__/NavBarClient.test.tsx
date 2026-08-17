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

const { default: NavBarClient } = await import('../NavBarClient');

beforeEach(() => {
  mockUseSession.mockReset();
  mockSignOut.mockReset();
  mockSetTheme.mockReset();
  mockUseSession.mockReturnValue({
    data: null,
    status: 'unauthenticated',
  });
});

afterEach(() => {
  cleanup();
  mockPathname = '/';
});

describe('NavBarClient (FPP-114)', () => {
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
    expect(screen.getByText('Sign In')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /switch to dark mode/i })).toBeInTheDocument();
  });

  it('renders simplified header for non-admin authenticated users with household and profile links', () => {
    mockUseSession.mockReturnValue({
      data: {
        user: { id: 'u1', name: 'Maria Garcia', email: 'maria@example.com', role: 'USER' },
      },
      status: 'authenticated',
    });
    mockPathname = '/events/event-123';
    render(<NavBarClient />);

    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /household/i })).toHaveAttribute('href', '/household');
    expect(screen.getByRole('link', { name: /profile/i })).toHaveAttribute('href', '/profile');
    expect(screen.getByRole('link', { name: /my events/i })).toHaveAttribute('href', '/my-events');
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /admin/i })).not.toBeInTheDocument();
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
