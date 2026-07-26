import { vi } from 'vitest';

export function mockSession(user: { id: string; role?: string; email?: string } | null) {
  const mod = {
    getServerSession: vi.fn().mockResolvedValue(
      user
        ? {
            user: { id: user.id, role: user.role ?? 'ADMIN_ADULT', email: user.email },
            expires: '2099-01-01',
          }
        : null,
    ),
    authOptions: {},
  };
  vi.doMock('next-auth', () => mod);
  vi.doMock('~/lib/auth', () => ({
    authOptions: mod.authOptions,
    getServerSession: mod.getServerSession,
  }));
  return mod;
}

export function mockAuthWith(user: { id: string; role?: string; email?: string } | null) {
  const getServerSession = vi.fn().mockResolvedValue(
    user
      ? {
          user: { id: user.id, role: user.role ?? 'ADMIN_ADULT', email: user.email },
          expires: '2099-01-01',
        }
      : null,
  );
  vi.doMock('~/lib/auth', () => ({
    authOptions: {},
    getServerSession,
  }));
  return { getServerSession };
}

export function makeJsonRequest(url: string, body: unknown, init: RequestInit = {}): Request {
  return new Request(url, {
    method: init.method ?? 'POST',
    headers: { 'content-type': 'application/json', ...(init.headers as Record<string, string>) },
    body: JSON.stringify(body),
    ...init,
  });
}

export function makeRequest(url: string, init: RequestInit = {}): Request {
  return new Request(url, { method: init.method ?? 'POST', ...init });
}
