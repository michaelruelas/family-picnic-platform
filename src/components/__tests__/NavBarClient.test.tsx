import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render } from '@testing-library/react';

let mockPathname = '/';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => mockPathname,
  useSearchParams: () => new URLSearchParams(),
}));

const mockUseSession = vi.fn();
vi.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
  signOut: vi.fn(),
}));

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light', setTheme: vi.fn() }),
}));

const { default: NavBarClient } = await import('../NavBarClient');

beforeEach(() => {
  mockUseSession.mockReset();
  mockUseSession.mockReturnValue({
    data: null,
    status: 'unauthenticated',
  });
});

afterEach(() => {
  cleanup();
  mockPathname = '/';
});

describe('NavBarClient (FPP-85)', () => {
  const publicPaths = [
    '/',
    '/login',
    '/events',
    '/events/abc-123',
    '/events/abc-123/potluck',
    '/events/abc-123/photos',
    '/events/calendar',
    '/events/invitation/some-token',
  ];

  it.each(publicPaths)('renders nothing on public path %s', (pathname) => {
    mockPathname = pathname;
    const { container } = render(<NavBarClient />);
    expect(container.firstChild).toBeNull();
  });

  it('still hides nav on public paths even when the user is signed in', () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: 'u1', name: 'Maria', email: 'maria@example.com' } },
      status: 'authenticated',
    });
    mockPathname = '/events/abc-123';
    const { container } = render(<NavBarClient />);
    expect(container.firstChild).toBeNull();
  });

  it('normalizes a trailing slash on a public path', () => {
    mockPathname = '/events/abc-123/';
    const { container } = render(<NavBarClient />);
    expect(container.firstChild).toBeNull();
  });

  it('still renders the nav on an authenticated path with a trailing slash', () => {
    mockPathname = '/profile/';
    const { container } = render(<NavBarClient />);
    expect(container.querySelector('nav')).not.toBeNull();
  });

  const authenticatedPaths = [
    '/profile',
    '/household',
    '/household/tree',
    '/onboarding',
    '/my-events',
    '/my-events/rsvp-1/confirmation',
    '/events/abc-123/checkout',
    '/events/abc-123/checkout/return',
    '/admin/dashboard',
    '/admin/events',
  ];

  it.each(authenticatedPaths)('renders the nav on authenticated path %s', (pathname) => {
    mockPathname = pathname;
    const { container } = render(<NavBarClient />);
    expect(container.querySelector('nav')).not.toBeNull();
  });
});
