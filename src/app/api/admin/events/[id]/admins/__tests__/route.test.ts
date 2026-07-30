import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextResponseJson, resetPrismaMock, makeJsonRequest } from 'tests/helpers/route';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));

const prismaMock = vi.hoisted(() => ({
  event: { findUnique: vi.fn() },
  eventAdmin: { findUnique: vi.fn(), create: vi.fn() },
}));
vi.mock('~/lib/prisma', () => ({ prisma: prismaMock }));

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return {
    ...actual,
    NextResponse: { ...actual.NextResponse, json: nextResponseJson() },
  };
});

import { getServerSession } from 'next-auth';
import { NextRequest } from 'next/server';
import { POST } from '~/app/api/admin/events/[id]/admins/route';

const mockedSession = vi.mocked(getServerSession);
const eventParams = { params: Promise.resolve({ id: 'e-1' }) };

beforeEach(() => {
  resetPrismaMock(prismaMock);
});

describe('POST /api/admin/events/[id]/admins', () => {
  it('returns 401 when not admin', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'GUEST' } } as never);
    const res = await POST(
      new NextRequest('http://x', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: 'u-2' }),
      }),
      eventParams,
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 when userId missing', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    const res = await POST(
      new NextRequest('http://x', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }),
      eventParams,
    );
    expect(res.status).toBe(400);
  });

  it('returns 404 when event not found', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue(null);
    const res = await POST(
      new NextRequest('http://x', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: 'u-2' }),
      }),
      eventParams,
    );
    expect(res.status).toBe(404);
  });

  it('returns 409 when user is already an admin', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue({ id: 'e-1' } as never);
    prismaMock.eventAdmin.findUnique.mockResolvedValue({ id: 'ea-1' } as never);
    const res = await POST(
      new NextRequest('http://x', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: 'u-2' }),
      }),
      eventParams,
    );
    expect(res.status).toBe(409);
  });

  it('adds a new admin with explicit role', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue({ id: 'e-1' } as never);
    prismaMock.eventAdmin.findUnique.mockResolvedValue(null);
    prismaMock.eventAdmin.create.mockResolvedValue({ id: 'ea-1' } as never);
    const res = await POST(
      new NextRequest('http://x', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: 'u-2', role: 'COADMIN' }),
      }),
      eventParams,
    );
    expect(res.status).toBe(201);
  });

  it('uses default COADMIN role when role not provided', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue({ id: 'e-1' } as never);
    prismaMock.eventAdmin.findUnique.mockResolvedValue(null);
    prismaMock.eventAdmin.create.mockResolvedValue({ id: 'ea-1' } as never);
    const res = await POST(
      new NextRequest('http://x', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: 'u-2' }),
      }),
      eventParams,
    );
    expect(res.status).toBe(201);
    expect(prismaMock.eventAdmin.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: 'COADMIN' }) }),
    );
  });
});
