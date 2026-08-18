import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeSelector } from '../ThemeSelector';
import { THEMES, ACTIVE_THEME } from '~/lib/theme';

vi.mock('~/hooks/useMounted', () => ({
  useMounted: () => true,
}));

let storage: Record<string, string> = {};

beforeEach(() => {
  storage = {};
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: vi.fn((key: string) => storage[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        storage[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete storage[key];
      }),
      clear: vi.fn(() => {
        storage = {};
      }),
    },
    writable: true,
  });

  const existing = document.getElementById('dynamic-theme');
  if (existing) existing.remove();
});

describe('ThemeSelector', () => {
  it('renders the theme selector button with active theme', () => {
    render(<ThemeSelector />);
    expect(screen.getByRole('button', { name: /theme palette/i })).toBeInTheDocument();
    expect(screen.getByText(THEMES[ACTIVE_THEME].name)).toBeInTheDocument();
  });

  it('opens dropdown with all presets when clicked', () => {
    render(<ThemeSelector />);
    const button = screen.getByRole('button', { name: /theme palette/i });
    fireEvent.click(button);

    expect(screen.getByText('Palette Presets')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Alpine Lake/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Forest Mountain/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Ocean Breeze/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Classic Warm/i })).toBeInTheDocument();
  });

  it('switches theme and updates dynamic style and localStorage when preset clicked', () => {
    render(<ThemeSelector />);
    const button = screen.getByRole('button', { name: /theme palette/i });
    fireEvent.click(button);

    const oceanOption = screen.getByRole('option', { name: /Ocean Breeze/i });
    fireEvent.click(oceanOption);

    expect(storage['fpp_palette_theme']).toBe('ocean-breeze');

    const styleEl = document.getElementById('dynamic-theme');
    expect(styleEl).not.toBeNull();
    expect(styleEl?.innerHTML).toContain('#0891b2');
  });
});
