import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

let mockPathname = '/admin/dashboard';

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

const { default: AdminSidebar } = await import('../AdminSidebar');

beforeEach(() => {
  mockPathname = '/admin/dashboard';
  mockUseSession.mockReset();
  mockUseSession.mockReturnValue({
    data: { user: { id: 'u1', name: 'Admin', email: 'admin@example.com', role: 'ADMIN' } },
    status: 'authenticated',
  });
});

describe('AdminSidebar', () => {
  it('renders all six primary nav items', () => {
    render(<AdminSidebar />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Events')).toBeInTheDocument();
    expect(screen.getByText('Invitations')).toBeInTheDocument();
    expect(screen.getByText('Communications')).toBeInTheDocument();
    expect(screen.getByText('Charges')).toBeInTheDocument();
    expect(screen.getByText('Audit Log')).toBeInTheDocument();
  });

  it('marks the matching nav item active for an exact pathname match', () => {
    mockPathname = '/admin/events';
    render(<AdminSidebar />);
    const events = screen.getByTestId('admin-nav-events');
    expect(events.getAttribute('data-active')).toBe('true');

    // Other items should be inactive.
    const dashboard = screen.getByTestId('admin-nav-dashboard');
    expect(dashboard.getAttribute('data-active')).toBe('false');
  });

  it('marks the parent nav item active for a nested child route', () => {
    mockPathname = '/admin/events/abc-123/edit';
    render(<AdminSidebar />);
    const events = screen.getByTestId('admin-nav-events');
    expect(events.getAttribute('data-active')).toBe('true');

    // /admin/audit-log is not a parent of the events route.
    const audit = screen.getByTestId('admin-nav-audit-log');
    expect(audit.getAttribute('data-active')).toBe('false');
  });

  it('marks the invitations nav item active on the invitations list', () => {
    mockPathname = '/admin/invitations';
    render(<AdminSidebar />);
    expect(screen.getByTestId('admin-nav-invitations').getAttribute('data-active')).toBe('true');
  });

  it('shows the session user name and email in the footer when signed in', () => {
    render(<AdminSidebar />);
    // The brand label "Admin" lives in the header and the user name
    // lives in the footer. Both contain "Admin" so use getAllByText.
    expect(screen.getAllByText('Admin').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('admin@example.com')).toBeInTheDocument();
  });

  it('shows a sign-out button', () => {
    render(<AdminSidebar />);
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
  });

  it('shows the ⌘K keyboard hint', () => {
    render(<AdminSidebar />);
    // The kbd element with the shortcut text appears in the footer.
    expect(screen.getByText('⌘K')).toBeInTheDocument();
    expect(screen.getByText('Quick navigate')).toBeInTheDocument();
  });
});
