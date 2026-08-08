import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextResponseJson, resetPrismaMock, makeJsonRequest } from 'tests/helpers/route';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));

const prismaMock = vi.hoisted(() => ({
  dependent: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  user: { findUnique: vi.fn() },
}));
vi.mock('~/lib/prisma', () => ({ prisma: prismaMock }));

// FPP-103: the POST handler now logs the USER_HAS_NO_HOUSEHOLD
// rejection with the request id and household state. Mock the
// logger so the test is hermetic and stops emitting real pino
// output during runs.
vi.mock('~/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  generateRequestId: vi.fn(() => 'test-req-id'),
  createRequestLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return {
    ...actual,
    NextResponse: { ...actual.NextResponse, json: nextResponseJson() },
  };
});

import { getServerSession } from 'next-auth';
import { GET, POST, PATCH, DELETE } from '~/app/api/dependents/route';

const mockedSession = vi.mocked(getServerSession);

beforeEach(() => {
  resetPrismaMock(prismaMock);
});

describe('GET /api/dependents', () => {
  it('returns 401 when no session', async () => {
    mockedSession.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns dependents list', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.dependent.findMany.mockResolvedValue([{ id: 'd-1', name: 'Kid' }] as never);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
  });

  it('returns 500 on error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.dependent.findMany.mockRejectedValue(new Error('boom'));
    const res = await GET();
    expect(res.status).toBe(500);
  });
});

describe('POST /api/dependents', () => {
  it('returns 401 when no session', async () => {
    mockedSession.mockResolvedValue(null);
    const res = await POST(makeJsonRequest('http://x', { name: 'Kid', relationship: 'CHILD' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 on invalid body', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    const res = await POST(makeJsonRequest('http://x', { name: '', relationship: 'FROB' }));
    expect(res.status).toBe(400);
  });

  it('returns 404 when user not found', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.user.findUnique.mockResolvedValue(null);
    const res = await POST(makeJsonRequest('http://x', { name: 'Kid', relationship: 'CHILD' }));
    expect(res.status).toBe(404);
  });

  it('creates a dependent', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u-1',
      householdId: 'h-1',
      household: { id: 'h-1', deletedAt: null },
    } as never);
    prismaMock.dependent.create.mockResolvedValue({ id: 'd-1', name: 'Kid' } as never);
    const res = await POST(makeJsonRequest('http://x', { name: 'Kid', relationship: 'CHILD' }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe('d-1');
    expect(prismaMock.dependent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ householdId: 'h-1' }) }),
    );
  });

  it('returns 409 USER_HAS_NO_HOUSEHOLD when user has no household (FPP-103)', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u-1',
      householdId: null,
      household: null,
    } as never);
    const res = await POST(makeJsonRequest('http://x', { name: 'Kid', relationship: 'CHILD' }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe('USER_HAS_NO_HOUSEHOLD');
    expect(prismaMock.dependent.create).not.toHaveBeenCalled();
  });

  it('returns 409 USER_HAS_NO_HOUSEHOLD when user householdId points to a soft-deleted Household (FPP-103)', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u-1',
      householdId: 'h-deleted',
      household: { id: 'h-deleted', deletedAt: new Date('2026-08-01T00:00:00.000Z') },
    } as never);
    const res = await POST(makeJsonRequest('http://x', { name: 'Kid', relationship: 'CHILD' }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe('USER_HAS_NO_HOUSEHOLD');
    expect(prismaMock.dependent.create).not.toHaveBeenCalled();
  });

  it('returns 500 on error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.user.findUnique.mockRejectedValue(new Error('boom'));
    const res = await POST(makeJsonRequest('http://x', { name: 'Kid', relationship: 'CHILD' }));
    expect(res.status).toBe(500);
  });
});

describe('PATCH /api/dependents', () => {
  it('returns 401 when no session', async () => {
    mockedSession.mockResolvedValue(null);
    const res = await PATCH(makeJsonRequest('http://x', { id: 'd-1', name: 'New' }, 'PATCH'));
    expect(res.status).toBe(401);
  });

  it('returns 400 on invalid body', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    const res = await PATCH(makeJsonRequest('http://x', {}, 'PATCH'));
    expect(res.status).toBe(400);
  });

  it('returns 404 when dependent not found', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.dependent.findUnique.mockResolvedValue(null);
    const res = await PATCH(makeJsonRequest('http://x', { id: 'd-1', name: 'New' }, 'PATCH'));
    expect(res.status).toBe(404);
  });

  it('returns 403 when user is not the manager', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.dependent.findUnique.mockResolvedValue({
      id: 'd-1',
      managedByUserId: 'someone-else',
      deletedAt: null,
    } as never);
    const res = await PATCH(makeJsonRequest('http://x', { id: 'd-1', name: 'New' }, 'PATCH'));
    expect(res.status).toBe(403);
  });

  it('returns 200 when only id is provided (zod makes other fields optional)', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.dependent.findUnique.mockResolvedValue({
      id: 'd-1',
      managedByUserId: 'u-1',
      deletedAt: null,
    } as never);
    prismaMock.dependent.update.mockResolvedValue({ id: 'd-1' } as never);
    const res = await PATCH(makeJsonRequest('http://x', { id: 'd-1' }, 'PATCH'));
    expect(res.status).toBe(200);
  });

  it('updates a dependent', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.dependent.findUnique.mockResolvedValue({
      id: 'd-1',
      managedByUserId: 'u-1',
      deletedAt: null,
    } as never);
    prismaMock.dependent.update.mockResolvedValue({ id: 'd-1', name: 'New' } as never);
    const res = await PATCH(makeJsonRequest('http://x', { id: 'd-1', name: 'New' }, 'PATCH'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('New');
  });

  it('returns 404 when dependent is soft-deleted', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.dependent.findUnique.mockResolvedValue({
      id: 'd-1',
      managedByUserId: 'u-1',
      deletedAt: new Date(),
    } as never);
    const res = await PATCH(makeJsonRequest('http://x', { id: 'd-1', name: 'New' }, 'PATCH'));
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/dependents', () => {
  it('returns 401 when no session', async () => {
    mockedSession.mockResolvedValue(null);
    const res = await DELETE(makeJsonRequest('http://x?id=d-1', undefined, 'DELETE'));
    expect(res.status).toBe(401);
  });

  it('returns 400 when id is missing', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    const res = await DELETE(makeJsonRequest('http://x', undefined, 'DELETE'));
    expect(res.status).toBe(400);
  });

  it('returns 404 when dependent not found', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.dependent.findUnique.mockResolvedValue(null);
    const res = await DELETE(makeJsonRequest('http://x?id=d-1', undefined, 'DELETE'));
    expect(res.status).toBe(404);
  });

  it('returns 403 when user is not the manager', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.dependent.findUnique.mockResolvedValue({
      id: 'd-1',
      managedByUserId: 'someone-else',
      deletedAt: null,
    } as never);
    const res = await DELETE(makeJsonRequest('http://x?id=d-1', undefined, 'DELETE'));
    expect(res.status).toBe(403);
  });

  it('soft-deletes a dependent', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.dependent.findUnique.mockResolvedValue({
      id: 'd-1',
      managedByUserId: 'u-1',
      deletedAt: null,
    } as never);
    prismaMock.dependent.update.mockResolvedValue({} as never);
    const res = await DELETE(makeJsonRequest('http://x?id=d-1', undefined, 'DELETE'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(prismaMock.dependent.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
    );
  });
});
