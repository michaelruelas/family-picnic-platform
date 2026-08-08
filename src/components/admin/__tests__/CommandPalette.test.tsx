import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/dashboard',
  useSearchParams: () => new URLSearchParams(),
}));

const { default: CommandPalette } = await import('../CommandPalette');

beforeEach(() => {
  mockPush.mockReset();
  // jsdom does not implement fetch by default in this project; supply a
  // minimal stub so the events fetch resolves with an empty list.
  if (!globalThis.fetch) {
    globalThis.fetch = vi.fn();
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

function dispatchKey(key: string, opts: KeyboardEventInit = {}) {
  // The palette listens on document, not window.
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, ...opts }));
  });
}

describe('CommandPalette', () => {
  it('renders nothing when closed (no ⌘K pressed)', () => {
    render(<CommandPalette />);
    expect(screen.queryByTestId('command-palette')).not.toBeInTheDocument();
  });

  it('opens on ⌘K (metaKey)', async () => {
    render(<CommandPalette />);
    dispatchKey('k', { metaKey: true });
    expect(await screen.findByTestId('command-palette')).toBeInTheDocument();
    expect(screen.getByTestId('command-palette-input')).toBeInTheDocument();
  });

  it('opens on Ctrl+K (ctrlKey)', async () => {
    render(<CommandPalette />);
    dispatchKey('k', { ctrlKey: true });
    expect(await screen.findByTestId('command-palette')).toBeInTheDocument();
  });

  it('closes on Esc when open', async () => {
    render(<CommandPalette />);
    dispatchKey('k', { metaKey: true });
    expect(await screen.findByTestId('command-palette')).toBeInTheDocument();
    dispatchKey('Escape');
    await waitFor(() => {
      expect(screen.queryByTestId('command-palette')).not.toBeInTheDocument();
    });
  });

  it('renders all six admin page entries as default results', async () => {
    render(<CommandPalette />);
    dispatchKey('k', { metaKey: true });
    expect(await screen.findByText('Pages')).toBeInTheDocument();
    for (const label of [
      'Dashboard',
      'Events',
      'Invitations',
      'Communications',
      'Charges',
      'Audit Log',
    ]) {
      expect(screen.getAllByText(label).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('filters pages by typed query', async () => {
    render(<CommandPalette />);
    dispatchKey('k', { metaKey: true });
    const input = await screen.findByTestId('command-palette-input');
    fireEvent.change(input, { target: { value: 'audit' } });
    // cmdk only surfaces matching pages; Dashboard should be filtered out
    await waitFor(() => {
      expect(screen.queryAllByText('Dashboard').length).toBe(0);
    });
    // Audit Log label should still appear inside the cmdk item.
    expect(screen.getByText('Audit Log')).toBeInTheDocument();
  });

  it('navigates when a page item is selected', async () => {
    render(<CommandPalette />);
    dispatchKey('k', { metaKey: true });
    await screen.findByText('Pages');
    // cmdk items render an Enter-key handler that calls onSelect.
    const chargesItem = screen.getByText('Charges').closest('[role="option"]');
    expect(chargesItem).not.toBeNull();
    fireEvent.click(chargesItem!);
    expect(mockPush).toHaveBeenCalledWith('/admin/charges');
  });
});
