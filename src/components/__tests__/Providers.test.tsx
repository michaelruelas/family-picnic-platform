import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('~/components/theme-provider', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('~/lib/trpc-client', () => ({
  trpc: { Provider: ({ children }: { children: React.ReactNode }) => children },
  createTRPCClient: () => ({}),
}));

vi.mock('@tanstack/react-query', () => ({
  QueryClient: class {
    constructor() {}
  },
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('./TRPCProvider', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('./ui/OfflineBanner', () => ({
  default: () => null,
}));

const { default: Providers } = await import('../Providers');

import { render } from '@testing-library/react';

describe('Providers', () => {
  const originalSW = (navigator as { serviceWorker?: unknown }).serviceWorker;

  afterEach(() => {
    if (originalSW) {
      Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: originalSW,
      });
    } else {
      delete (navigator as { serviceWorker?: unknown }).serviceWorker;
    }
  });

  it('renders children', () => {
    const { container } = render(
      <Providers>
        <div data-testid="child">Hello</div>
      </Providers>,
    );
    expect(container.querySelector('[data-testid="child"]')).toBeTruthy();
  });

  it('registers service worker when available', () => {
    const registerMock = vi.fn().mockResolvedValue({} as never);
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { register: registerMock },
    });
    render(
      <Providers>
        <span>child</span>
      </Providers>,
    );
    expect(registerMock).toHaveBeenCalledWith('/sw.js');
  });

  it('handles service worker registration failure', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const registerMock = vi.fn().mockRejectedValue(new Error('SW failed') as never);
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { register: registerMock },
    });
    render(
      <Providers>
        <span>child</span>
      </Providers>,
    );
    expect(registerMock).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
