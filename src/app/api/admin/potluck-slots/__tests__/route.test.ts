import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextResponseJson, resetPrismaMock, makeJsonRequest } from 'tests/helpers/route';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));

const prismaMock = vi.hoisted(() => ({
  potluckSlot: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  event: { findUnique: vi.fn() },
  // FPP-104: the per-event gate consults canAccessEvent, which
  // reads `eventAdmin.findUnique` for non-platform-admins. Stub
  // it to `null` so the test stays focused on the route's own
  // behaviour; per-event access for the GUEST role is the
  // subject of `src/lib/__tests__/event-access.test.ts`.
  eventAdmin: { findUnique: vi.fn(() => Promise.resolve(null)) },
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
import { POST } from '~/app/api/admin/potluck-slots/route';
import { PATCH, DELETE } from '~/app/api/admin/potluck-slots/[id]/route';

const mockedSession = vi.mocked(getServerSession);

const slotParams = { params: Promise.resolve({ id: 's-1' }) };

beforeEach(() => {
  resetPrismaMock(prismaMock);
});

describe('POST /api/admin/potluck-slots', () => {
  it('returns 401 when no session at all', async () => {
    // FPP-104: the auth check is gated on the parsed eventId; a
    // missing session returns 401 before the body is read.
    mockedSession.mockResolvedValue(null);
    const res = await POST(
      makeJsonRequest('http://x', {
        eventId: 'e1',
        category: 'Main',
        name: 'Salad',
        slotType: 'OPEN',
      }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 403 when session exists but caller has no admin role or EventAdmin row', async () => {
    // FPP-104: per-event gate. A session exists but the user has
    // no admin role and no EventAdmin row, so the gate returns
    // 403 (not 401). 401 is reserved for missing sessions.
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'GUEST' } } as never);
    const res = await POST(
      makeJsonRequest('http://x', {
        eventId: 'e1',
        category: 'Main',
        name: 'Salad',
        slotType: 'OPEN',
      }),
    );
    expect(res.status).toBe(403);
    expect(prismaMock.potluckSlot.create).not.toHaveBeenCalled();
  });

  it('FPP-104: allows a HOST with an EventAdmin row to create a slot', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'host-1', role: 'HOST' } } as never);
    prismaMock.eventAdmin.findUnique.mockResolvedValue({ id: 'ea-1' } as never);
    prismaMock.event.findUnique.mockResolvedValue({ id: 'e1' } as never);
    prismaMock.potluckSlot.create.mockResolvedValue({ id: 's-1' } as never);
    const res = await POST(
      makeJsonRequest('http://x', {
        eventId: 'e1',
        category: 'Main',
        name: 'Salad',
        slotType: 'OPEN',
      }),
    );
    expect(res.status).toBe(200);
  });

  it('returns 400 when fields missing', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    const res = await POST(makeJsonRequest('http://x', { eventId: 'e1' }));
    expect(res.status).toBe(400);
  });

  it('FPP-54: creates a slot without a name', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue({ id: 'e1' } as never);
    prismaMock.potluckSlot.create.mockResolvedValue({
      id: 's-1',
      name: null,
    } as never);
    const res = await POST(
      makeJsonRequest('http://x', {
        eventId: 'e1',
        category: 'DESSERT',
        slotType: 'UNLIMITED',
      }),
    );
    expect(res.status).toBe(200);
    expect(prismaMock.potluckSlot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventId: 'e1',
          category: 'DESSERT',
          name: null,
          slotType: 'UNLIMITED',
        }),
      }),
    );
  });

  it('FPP-54: trims whitespace-only name to null', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue({ id: 'e1' } as never);
    prismaMock.potluckSlot.create.mockResolvedValue({ id: 's-1' } as never);
    const res = await POST(
      makeJsonRequest('http://x', {
        eventId: 'e1',
        category: 'DESSERT',
        slotType: 'UNLIMITED',
        name: '   ',
      }),
    );
    expect(res.status).toBe(200);
    expect(prismaMock.potluckSlot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: null }),
      }),
    );
  });

  it('returns 404 when event not found', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue(null);
    const res = await POST(
      makeJsonRequest('http://x', {
        eventId: 'e1',
        category: 'Main',
        name: 'Salad',
        slotType: 'OPEN',
      }),
    );
    expect(res.status).toBe(404);
  });

  it('returns 400 for LIMITED slot without maxSignups', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue({ id: 'e1' } as never);
    const res = await POST(
      makeJsonRequest('http://x', {
        eventId: 'e1',
        category: 'Main',
        name: 'Salad',
        slotType: 'LIMITED',
      }),
    );
    expect(res.status).toBe(400);
  });

  it('creates an OPEN slot', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue({ id: 'e1' } as never);
    prismaMock.potluckSlot.create.mockResolvedValue({ id: 's-1' } as never);
    const res = await POST(
      makeJsonRequest('http://x', {
        eventId: 'e1',
        category: 'Main',
        name: 'Salad',
        slotType: 'OPEN',
      }),
    );
    expect(res.status).toBe(200);
  });

  it('creates a LIMITED slot', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue({ id: 'e1' } as never);
    prismaMock.potluckSlot.create.mockResolvedValue({ id: 's-1' } as never);
    const res = await POST(
      makeJsonRequest('http://x', {
        eventId: 'e1',
        category: 'Main',
        name: 'Salad',
        slotType: 'LIMITED',
        maxSignups: 5,
      }),
    );
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.event.findUnique.mockRejectedValue(new Error('boom'));
    const res = await POST(
      makeJsonRequest('http://x', {
        eventId: 'e1',
        category: 'Main',
        name: 'Salad',
        slotType: 'OPEN',
      }),
    );
    expect(res.status).toBe(500);
  });
});

describe('PATCH /api/admin/potluck-slots/[id]', () => {
  it('returns 401 when no session (before any DB read)', async () => {
    // FPP-104 review: closing the 404-vs-401 information leak.
    // The route now runs `requireSessionApi` first so an
    // unauthenticated caller gets 401 regardless of whether the
    // slot exists. The slot lookup never runs, so a probe cannot
    // distinguish "missing slot" from "not allowed".
    mockedSession.mockResolvedValue(null);
    // The session check happens before findUnique, so we don't
    // need to stub the prisma mock. Set it to throw if it does
    // get called so the test fails loudly.
    prismaMock.potluckSlot.findUnique.mockRejectedValue(new Error('should not be called'));
    const res = await PATCH(makeJsonRequest('http://x', { name: 'New' }, 'PATCH'), slotParams);
    expect(res.status).toBe(401);
    expect(prismaMock.potluckSlot.findUnique).not.toHaveBeenCalled();
  });

  it('returns 404 when slot not found (with a valid session)', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.potluckSlot.findUnique.mockResolvedValue(null);
    const res = await PATCH(makeJsonRequest('http://x', { name: 'New' }, 'PATCH'), slotParams);
    expect(res.status).toBe(404);
  });

  it('returns 403 when session exists but caller has no admin role or EventAdmin row', async () => {
    // FPP-104: per-event gate. The slot exists; the user has no
    // admin role and no EventAdmin row, so the gate returns 403
    // (not 401 — 401 is reserved for missing sessions).
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'GUEST' } } as never);
    prismaMock.potluckSlot.findUnique.mockResolvedValue({ id: 's-1', eventId: 'e-1' } as never);
    const res = await PATCH(makeJsonRequest('http://x', { name: 'New' }, 'PATCH'), slotParams);
    expect(res.status).toBe(403);
    expect(prismaMock.potluckSlot.update).not.toHaveBeenCalled();
  });

  it('FPP-104: allows a HOST with an EventAdmin row to PATCH the slot', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'host-1', role: 'HOST' } } as never);
    prismaMock.potluckSlot.findUnique.mockResolvedValue({ id: 's-1', eventId: 'e-1' } as never);
    prismaMock.eventAdmin.findUnique.mockResolvedValue({ id: 'ea-1' } as never);
    prismaMock.potluckSlot.update.mockResolvedValue({} as never);
    const res = await PATCH(makeJsonRequest('http://x', { name: 'New' }, 'PATCH'), slotParams);
    expect(res.status).toBe(200);
  });

  it('updates slot name', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.potluckSlot.findUnique.mockResolvedValue({ id: 's-1', slotType: 'OPEN' } as never);
    prismaMock.potluckSlot.update.mockResolvedValue({} as never);
    const res = await PATCH(makeJsonRequest('http://x', { name: 'New' }, 'PATCH'), slotParams);
    expect(res.status).toBe(200);
  });

  it('FPP-54: clears slot name when an empty string is sent', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.potluckSlot.findUnique.mockResolvedValue({ id: 's-1', slotType: 'OPEN' } as never);
    prismaMock.potluckSlot.update.mockResolvedValue({} as never);
    const res = await PATCH(makeJsonRequest('http://x', { name: '' }, 'PATCH'), slotParams);
    expect(res.status).toBe(200);
    expect(prismaMock.potluckSlot.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 's-1' },
        data: { name: null },
      }),
    );
  });

  it('returns 400 when LIMITED slot has maxSignups < 1', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.potluckSlot.findUnique.mockResolvedValue({
      id: 's-1',
      slotType: 'LIMITED',
    } as never);
    const res = await PATCH(makeJsonRequest('http://x', { maxSignups: 0 }, 'PATCH'), slotParams);
    expect(res.status).toBe(400);
  });

  it('updates maxSignups for LIMITED slot', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.potluckSlot.findUnique.mockResolvedValue({
      id: 's-1',
      slotType: 'LIMITED',
    } as never);
    prismaMock.potluckSlot.update.mockResolvedValue({} as never);
    const res = await PATCH(makeJsonRequest('http://x', { maxSignups: 10 }, 'PATCH'), slotParams);
    expect(res.status).toBe(200);
  });

  it('ignores maxSignups for OPEN slot', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.potluckSlot.findUnique.mockResolvedValue({ id: 's-1', slotType: 'OPEN' } as never);
    prismaMock.potluckSlot.update.mockResolvedValue({} as never);
    const res = await PATCH(makeJsonRequest('http://x', { maxSignups: 10 }, 'PATCH'), slotParams);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.potluckSlot.findUnique.mockRejectedValue(new Error('boom'));
    const res = await PATCH(makeJsonRequest('http://x', { name: 'New' }, 'PATCH'), slotParams);
    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/admin/potluck-slots/[id]', () => {
  it('returns 401 when no session (before any DB read)', async () => {
    // FPP-104 review: see the PATCH counterpart — the route
    // closes the 404-vs-401 leak by checking the session first.
    mockedSession.mockResolvedValue(null);
    prismaMock.potluckSlot.findUnique.mockRejectedValue(new Error('should not be called'));
    const res = await DELETE(new Request('http://x'), slotParams);
    expect(res.status).toBe(401);
    expect(prismaMock.potluckSlot.findUnique).not.toHaveBeenCalled();
  });

  it('returns 404 when slot not found (with a valid session)', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.potluckSlot.findUnique.mockResolvedValue(null);
    const res = await DELETE(new Request('http://x'), slotParams);
    expect(res.status).toBe(404);
  });

  it('returns 403 when session exists but caller has no admin role or EventAdmin row', async () => {
    // FPP-104: per-event gate. Same 403-on-existing-session
    // contract as PATCH.
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'GUEST' } } as never);
    prismaMock.potluckSlot.findUnique.mockResolvedValue({ id: 's-1', eventId: 'e-1' } as never);
    const res = await DELETE(new Request('http://x'), slotParams);
    expect(res.status).toBe(403);
    expect(prismaMock.potluckSlot.delete).not.toHaveBeenCalled();
  });

  it('FPP-104: allows a HOST with an EventAdmin row to DELETE the slot', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'host-1', role: 'HOST' } } as never);
    prismaMock.potluckSlot.findUnique.mockResolvedValue({ id: 's-1', eventId: 'e-1' } as never);
    prismaMock.eventAdmin.findUnique.mockResolvedValue({ id: 'ea-1' } as never);
    prismaMock.potluckSlot.delete.mockResolvedValue({} as never);
    const res = await DELETE(new Request('http://x'), slotParams);
    expect(res.status).toBe(200);
  });

  it('deletes the slot', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.potluckSlot.findUnique.mockResolvedValue({ id: 's-1' } as never);
    prismaMock.potluckSlot.delete.mockResolvedValue({} as never);
    const res = await DELETE(new Request('http://x'), slotParams);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.potluckSlot.findUnique.mockResolvedValue({ id: 's-1' } as never);
    prismaMock.potluckSlot.delete.mockRejectedValue(new Error('boom'));
    const res = await DELETE(new Request('http://x'), slotParams);
    expect(res.status).toBe(500);
  });
});
