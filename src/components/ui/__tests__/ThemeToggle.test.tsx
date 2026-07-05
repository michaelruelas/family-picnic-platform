import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeToggle } from '../ThemeToggle';

vi.mock('next-themes', () => ({
  useTheme: vi.fn(),
}));

import { useTheme } from 'next-themes';
const mockUseTheme = useTheme as ReturnType<typeof vi.fn>;

vi.mock('~/hooks/useMounted', () => ({
  useMounted: () => true,
}));

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

describe('ThemeToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all three theme options', () => {
    mockUseTheme.mockReturnValue({
      theme: 'system',
      setTheme: vi.fn(),
      resolvedTheme: 'light',
    });
    render(<ThemeToggle />);
    expect(screen.getByText('Light')).toBeInTheDocument();
    expect(screen.getByText('Dark')).toBeInTheDocument();
    expect(screen.getByText('Match my device')).toBeInTheDocument();
  });

  it('marks the current theme as checked', () => {
    mockUseTheme.mockReturnValue({
      theme: 'dark',
      setTheme: vi.fn(),
      resolvedTheme: 'dark',
    });
    render(<ThemeToggle />);
    const darkRadio = screen.getByRole('radio', { name: /Dark/i });
    expect(darkRadio).toHaveAttribute('aria-checked', 'true');
  });

  it('shows Auto badge for the system option', () => {
    mockUseTheme.mockReturnValue({
      theme: 'system',
      setTheme: vi.fn(),
      resolvedTheme: 'light',
    });
    render(<ThemeToggle />);
    expect(screen.getByText('Auto')).toBeInTheDocument();
  });

  it('calls setTheme when an option is clicked', () => {
    const setTheme = vi.fn();
    mockUseTheme.mockReturnValue({
      theme: 'light',
      setTheme,
      resolvedTheme: 'light',
    });
    render(<ThemeToggle />);
    const darkButton = screen.getByRole('radio', { name: /Dark/i });
    darkButton.click();
    expect(setTheme).toHaveBeenCalledWith('dark');
  });
});
