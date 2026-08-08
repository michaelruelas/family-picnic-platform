import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ToastProvider } from '~/components/ui/Toast';
import type { InvitationStatus } from '~/lib/generated/enums';

const mockAddToast = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/invitations',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('~/components/ui/Toast', async () => {
  const actual =
    await vi.importActual<typeof import('~/components/ui/Toast')>('~/components/ui/Toast');
  return {
    ...actual,
    useToast: () => ({ addToast: mockAddToast, removeToast: vi.fn(), toasts: [] }),
  };
});

const { default: InvitationsTable } = await import('../InvitationsTable');

const invitations = [
  {
    id: 'i1',
    status: 'PENDING' as InvitationStatus,
    token: 'abcdef1234567890',
    expiresAt: '2026-09-12T17:00:00.000Z',
    sentAt: null,
    createdAt: '2026-08-01T10:00:00.000Z',
    household: { id: 'h1', name: 'The Garcia Family' },
    user: null,
  },
  {
    id: 'i2',
    status: 'USED' as InvitationStatus,
    token: 'qrstuvwxyzasdfgh',
    expiresAt: null,
    sentAt: '2026-08-02T12:00:00.000Z',
    createdAt: '2026-08-01T10:00:00.000Z',
    household: null,
    user: { id: 'u1', name: 'Alice Wong', email: 'alice@example.com' },
  },
];

function renderWithToast(ui: React.ReactNode) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

beforeEach(() => {
  mockAddToast.mockReset();
  // Default to a real clipboard implementation so the copy-token path works.
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

describe('InvitationsTable', () => {
  it('renders household + email + status for each invitation', () => {
    renderWithToast(<InvitationsTable initialInvitations={invitations} />);
    expect(screen.getByText('The Garcia Family')).toBeInTheDocument();
    expect(screen.getByText('Alice Wong')).toBeInTheDocument();
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    expect(screen.getByText('PENDING')).toBeInTheDocument();
    expect(screen.getByText('USED')).toBeInTheDocument();
  });

  it('truncates long tokens for display', () => {
    renderWithToast(<InvitationsTable initialInvitations={invitations} />);
    // 'abcdef1234567890' -> 'abcdef…7890'
    expect(screen.getByText('abcdef…7890')).toBeInTheDocument();
    expect(screen.queryByText('abcdef1234567890')).not.toBeInTheDocument();
  });

  it('copies the full token to the clipboard and toasts success', async () => {
    renderWithToast(<InvitationsTable initialInvitations={invitations} />);
    const tokenButton = screen.getByRole('button', { name: /copy invitation token abcdef…7890/i });
    fireEvent.click(tokenButton);
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('abcdef1234567890');
    });
    expect(mockAddToast).toHaveBeenCalledWith('success', expect.stringMatching(/copied/i));
  });

  it('falls back to execCommand when navigator.clipboard is unavailable', async () => {
    Object.assign(navigator, { clipboard: undefined });
    // jsdom does not implement document.execCommand; install a stub on
    // the Document prototype so the fallback path can call it.
    const originalExec = (document as unknown as { execCommand?: (cmd: string) => boolean })
      .execCommand;
    (document as unknown as { execCommand: (cmd: string) => boolean }).execCommand = vi
      .fn()
      .mockReturnValue(true);
    try {
      renderWithToast(<InvitationsTable initialInvitations={invitations} />);
      const tokenButton = screen.getByRole('button', {
        name: /copy invitation token abcdef…7890/i,
      });
      fireEvent.click(tokenButton);
      await waitFor(() => {
        expect(
          (document as unknown as { execCommand: (cmd: string) => boolean }).execCommand,
        ).toHaveBeenCalledWith('copy');
      });
      expect(mockAddToast).toHaveBeenCalledWith('success', expect.stringMatching(/copied/i));
    } finally {
      // Restore so other tests see a clean global.
      if (originalExec === undefined) {
        delete (document as unknown as { execCommand?: unknown }).execCommand;
      } else {
        (document as unknown as { execCommand: (cmd: string) => boolean }).execCommand =
          originalExec;
      }
    }
  });

  it('renders the empty state when no invitations are provided', () => {
    renderWithToast(<InvitationsTable initialInvitations={[]} />);
    expect(screen.getByText(/no invitations yet/i)).toBeInTheDocument();
  });

  it('hides the resend action for USED and EXPIRED rows', () => {
    renderWithToast(<InvitationsTable initialInvitations={invitations} />);
    // PENDING row shows Resend; USED row does not.
    const resendButtons = screen.getAllByRole('button', { name: /^resend$/i });
    expect(resendButtons).toHaveLength(1);
  });
});
