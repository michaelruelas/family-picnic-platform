import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextResponseJson, resetPrismaMock } from 'tests/helpers/route';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
}));
vi.mock('~/lib/prisma', () => ({ prisma: prismaMock }));

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return {
    ...actual,
    NextResponse: { ...actual.NextResponse, json: nextResponseJson() },
  };
});

import {
  LastMemberError,
  parseJsonBody,
  requireActiveMemberOwner,
} from '~/app/api/household-members/_helpers';

beforeEach(() => {
  resetPrismaMock(prismaMock);
});

describe('parseJsonBody', () => {
  it('returns 400 on invalid JSON', async () => {
    const req = new Request('http://x', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json',
    });
    const result = await parseJsonBody(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
    }
  });

  it('returns 400 on array body', async () => {
    const req = new Request('http://x', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '[1, 2, 3]',
    });
    const result = await parseJsonBody(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
    }
  });

  it('returns 400 on null body', async () => {
    const req = new Request('http://x', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'null',
    });
    const result = await parseJsonBody(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
    }
  });

  it('returns 400 on primitive body', async () => {
    const req = new Request('http://x', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '"string"',
    });
    const result = await parseJsonBody(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
    }
  });

  it('returns the parsed object on a valid body', async () => {
    const req = new Request('http://x', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"a":1}',
    });
    const result = await parseJsonBody(req);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.body).toEqual({ a: 1 });
    }
  });
});

describe('requireActiveMemberOwner', () => {
  it('returns 401 when user is missing', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const result = await requireActiveMemberOwner('u-1', 'h-1');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
  });

  it('returns 401 when user is soft-deleted', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u-1',
      householdId: 'h-1',
      deletedAt: new Date(),
    } as never);
    const result = await requireActiveMemberOwner('u-1', 'h-1');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
  });

  it('returns 403 when user has no household', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u-1',
      householdId: null,
      deletedAt: null,
    } as never);
    const result = await requireActiveMemberOwner('u-1', 'h-1');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
    }
  });

  it('returns 403 when user is in a different household', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u-1',
      householdId: 'h-2',
      deletedAt: null,
    } as never);
    const result = await requireActiveMemberOwner('u-1', 'h-1');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
    }
  });

  it('returns the user when ownership checks pass', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u-1',
      householdId: 'h-1',
      deletedAt: null,
    } as never);
    const result = await requireActiveMemberOwner('u-1', 'h-1');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user).toEqual({ id: 'u-1', householdId: 'h-1' });
    }
  });
});

describe('LastMemberError', () => {
  it('is an Error subclass with name LastMemberError', () => {
    const error = new LastMemberError();
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('LastMemberError');
  });
});
