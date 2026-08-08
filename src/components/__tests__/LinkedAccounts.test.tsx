import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockList = vi.fn();
const mockUnlinkMutateAsync = vi.fn();
const mockInvalidate = vi.fn();

vi.mock('next-auth/react', () => ({
  signIn: vi.fn(),
}));

vi.mock('~/lib/trpc-client', () => {
  return {
    trpc: {
      useUtils: () => ({
        user: {
          listLinkedIdentities: { invalidate: mockInvalidate },
        },
      }),
      user: {
        listLinkedIdentities: {
          useQuery: () => ({
            data: mockList(),
            isLoading: false,
          }),
        },
        unlinkIdentity: {
          useMutation: (opts: { onSuccess?: () => void }) => ({
            mutateAsync: (input: { identityId: string }) => {
              mockUnlinkMutateAsync(input);
              return Promise.resolve({ ok: true }).then(() => {
                opts.onSuccess?.();
              });
            },
          }),
        },
      },
    },
  };
});

import { signIn } from 'next-auth/react';
const mockedSignIn = vi.mocked(signIn);

beforeEach(() => {
  mockList.mockReset();
  mockUnlinkMutateAsync.mockReset();
  mockInvalidate.mockReset();
  mockedSignIn.mockReset();
  // jsdom does not implement window.confirm; stub it.
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

describe('LinkedAccounts', () => {
  it('renders an empty state when no identities are linked', async () => {
    mockList.mockReturnValue([]);
    const { default: LinkedAccounts } = await import('../LinkedAccounts');
    render(<LinkedAccounts enabledProviders={['google', 'apple']} sessionEmail="me@example.com" />);
    expect(screen.getByText(/no connected accounts yet/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /link apple/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /link google/i })).toBeInTheDocument();
  });

  it('hides link buttons for providers that are not enabled', async () => {
    mockList.mockReturnValue([]);
    const { default: LinkedAccounts } = await import('../LinkedAccounts');
    render(<LinkedAccounts enabledProviders={['google']} sessionEmail="me@example.com" />);
    expect(screen.queryByRole('button', { name: /link apple/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /link facebook/i })).not.toBeInTheDocument();
  });

  it('lists linked identities with their provider label and email snapshot', async () => {
    mockList.mockReturnValue([
      {
        id: 'ident-1',
        provider: 'google',
        providerAccountId: 'g-1',
        emailSnapshot: 'me@example.com',
        createdAt: new Date(),
      },
    ]);
    const { default: LinkedAccounts } = await import('../LinkedAccounts');
    render(<LinkedAccounts enabledProviders={['google', 'apple']} sessionEmail="me@example.com" />);
    expect(screen.getByText('Google')).toBeInTheDocument();
    expect(screen.getByText('me@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /unlink/i })).toBeInTheDocument();
  });

  it('shows the unlink button as disabled when only one identity is linked', async () => {
    mockList.mockReturnValue([
      {
        id: 'ident-1',
        provider: 'google',
        providerAccountId: 'g-1',
        emailSnapshot: 'me@example.com',
        createdAt: new Date(),
      },
    ]);
    const { default: LinkedAccounts } = await import('../LinkedAccounts');
    render(<LinkedAccounts enabledProviders={['google']} sessionEmail="me@example.com" />);
    const btn = screen.getByRole('button', { name: /unlink/i }) as HTMLButtonElement;
    expect(btn).toBeDisabled();
  });

  it('calls signIn with the chosen provider when Link is clicked', async () => {
    mockList.mockReturnValue([
      {
        id: 'ident-1',
        provider: 'google',
        providerAccountId: 'g-1',
        emailSnapshot: 'me@example.com',
        createdAt: new Date(),
      },
    ]);
    mockedSignIn.mockResolvedValue({} as never);
    const { default: LinkedAccounts } = await import('../LinkedAccounts');
    render(<LinkedAccounts enabledProviders={['google', 'apple']} sessionEmail="me@example.com" />);
    fireEvent.click(screen.getByRole('button', { name: /link apple/i }));
    expect(mockedSignIn).toHaveBeenCalledWith('apple', { callbackUrl: '/profile' });
  });

  it('calls unlinkIdentity and invalidates the list after confirmation', async () => {
    mockList.mockReturnValue([
      {
        id: 'ident-1',
        provider: 'google',
        providerAccountId: 'g-1',
        emailSnapshot: 'me@example.com',
        createdAt: new Date(),
      },
      {
        id: 'ident-2',
        provider: 'apple',
        providerAccountId: 'a-1',
        emailSnapshot: 'me@example.com',
        createdAt: new Date(),
      },
    ]);
    mockUnlinkMutateAsync.mockResolvedValue({ ok: true });
    const { default: LinkedAccounts } = await import('../LinkedAccounts');
    render(<LinkedAccounts enabledProviders={['google', 'apple']} sessionEmail="me@example.com" />);
    const unlinkButtons = screen.getAllByRole('button', { name: /unlink/i });
    const firstUnlink = unlinkButtons[0];
    if (!firstUnlink) throw new Error('expected an unlink button');
    fireEvent.click(firstUnlink);
    await waitFor(() => {
      expect(mockUnlinkMutateAsync).toHaveBeenCalledWith({ identityId: 'ident-1' });
      expect(mockInvalidate).toHaveBeenCalled();
    });
  });
});
