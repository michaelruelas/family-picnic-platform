import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';

vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({ data: null, status: 'unauthenticated', update: () => undefined }),
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

vi.mock('./AnalyticsProvider', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('./ui/Toast', () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('./ui/OfflineBanner', () => ({
  default: () => null,
}));

const { default: Providers } = await import('../Providers');

describe('Providers', () => {
  const originalSW = (navigator as { serviceWorker?: unknown }).serviceWorker;

  afterEach(() => {
    vi.unstubAllEnvs();
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

  it('registers service worker when in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
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

  it('handles service worker registration failure in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
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
    await waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith(
        'Service worker registration failed:',
        expect.any(Error),
      );
    });
    warnSpy.mockRestore();
  });
});
