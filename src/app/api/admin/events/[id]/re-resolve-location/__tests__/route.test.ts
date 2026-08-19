import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextResponseJson, resetPrismaMock, makeJsonRequest } from 'tests/helpers/route';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));

const prismaMock = vi.hoisted(() => ({
  event: { findUnique: vi.fn(), update: vi.fn() },
  // FPP-104: the per-event gate consults canAccessEvent.
  eventAdmin: { findUnique: vi.fn(() => Promise.resolve(null)) },
}));
vi.mock('~/lib/prisma', () => ({ prisma: prismaMock }));

// FPP-152: stub the Google Places helper so the test controls the
// resolved coordinates and can also exercise the failure paths
// without an outbound HTTP call.
const mockResolvePlaceFromId = vi.fn();
vi.mock('~/lib/google-maps', () => ({
  resolvePlaceFromId: (...args: unknown[]) => mockResolvePlaceFromId(...args),
  GooglePlacesError: class GooglePlacesError extends Error {
    constructor(
      message: string,
      public status: number,
    ) {
      super(message);
      this.name = 'GooglePlacesError';
    }
  },
}));

// FPP-152 / QUB-26.1: write an audit entry on success. Stub so we
// can assert the exact payload without a real AdminAuditLog row.
const mockWriteAuditLog = vi.fn();
vi.mock('~/lib/audit', () => ({
  writeAuditLog: (...args: unknown[]) => mockWriteAuditLog(...args),
}));

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return {
    ...actual,
    NextResponse: { ...actual.NextResponse, json: nextResponseJson() },
  };
});

import { getServerSession } from 'next-auth';
import { POST } from '~/app/api/admin/events/[id]/re-resolve-location/route';
import { GooglePlacesError } from '~/lib/google-maps';

const mockedSession = vi.mocked(getServerSession);
const eventParams = { params: Promise.resolve({ id: 'e-1' }) };

beforeEach(() => {
  resetPrismaMock(prismaMock);
  mockResolvePlaceFromId.mockReset();
  mockWriteAuditLog.mockClear();
});

describe('POST /api/admin/events/[id]/re-resolve-location (FPP-152)', () => {
  it('returns 401 when no session at all', async () => {
    mockedSession.mockResolvedValue(null);
    const res = await POST(makeJsonRequest('http://x', undefined, 'POST'), eventParams);
    expect(res.status).toBe(401);
  });

  it('returns 403 when session exists but caller has no admin role or EventAdmin row', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'GUEST' } } as never);
    const res = await POST(makeJsonRequest('http://x', undefined, 'POST'), eventParams);
    expect(res.status).toBe(403);
  });

  it('FPP-104: allows a HOST with an EventAdmin row to re-resolve', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'host-1', role: 'HOST' } } as never);
    prismaMock.eventAdmin.findUnique.mockResolvedValue({ id: 'ea-1' } as never);
    prismaMock.event.findUnique.mockResolvedValue({
      id: 'e-1',
      placeId: 'place-xyz',
      location: 'Old Address',
      lat: 1,
      lng: 2,
    } as never);
    mockResolvePlaceFromId.mockResolvedValue({
      location: 'New Address',
      lat: 3,
      lng: 4,
    });
    prismaMock.event.update.mockResolvedValue({ id: 'e-1' } as never);
    const res = await POST(makeJsonRequest('http://x', undefined, 'POST'), eventParams);
    expect(res.status).toBe(200);
  });

  it('returns 404 when event not found', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue(null);
    const res = await POST(makeJsonRequest('http://x', undefined, 'POST'), eventParams);
    expect(res.status).toBe(404);
    expect(mockResolvePlaceFromId).not.toHaveBeenCalled();
    expect(mockWriteAuditLog).not.toHaveBeenCalled();
  });

  it('returns 400 when event has no placeId', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue({
      id: 'e-1',
      placeId: null,
      location: 'Manual address',
      lat: null,
      lng: null,
    } as never);
    const res = await POST(makeJsonRequest('http://x', undefined, 'POST'), eventParams);
    expect(res.status).toBe(400);
    expect(mockResolvePlaceFromId).not.toHaveBeenCalled();
  });

  it('returns 503 when the Google Maps API key is not configured', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue({
      id: 'e-1',
      placeId: 'place-xyz',
      location: 'Old',
      lat: 1,
      lng: 2,
    } as never);
    mockResolvePlaceFromId.mockResolvedValue(null);
    const res = await POST(makeJsonRequest('http://x', undefined, 'POST'), eventParams);
    expect(res.status).toBe(503);
    expect(prismaMock.event.update).not.toHaveBeenCalled();
  });

  it('returns 502 when the Google Places API call fails', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue({
      id: 'e-1',
      placeId: 'place-xyz',
      location: 'Old',
      lat: 1,
      lng: 2,
    } as never);
    mockResolvePlaceFromId.mockRejectedValue(new GooglePlacesError('upstream 500', 500));
    const res = await POST(makeJsonRequest('http://x', undefined, 'POST'), eventParams);
    expect(res.status).toBe(502);
    expect(prismaMock.event.update).not.toHaveBeenCalled();
    expect(mockWriteAuditLog).not.toHaveBeenCalled();
  });

  it('writes fresh coords and an audit entry on success', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.event.findUnique.mockResolvedValue({
      id: 'e-1',
      placeId: 'place-xyz',
      location: 'Old Address',
      lat: 1,
      lng: 2,
    } as never);
    mockResolvePlaceFromId.mockResolvedValue({
      location: 'New Address',
      lat: 3,
      lng: 4,
    });
    prismaMock.event.update.mockResolvedValue({
      id: 'e-1',
      location: 'New Address',
      lat: 3,
      lng: 4,
    } as never);
    const res = await POST(makeJsonRequest('http://x', undefined, 'POST'), eventParams);
    expect(res.status).toBe(200);

    expect(mockResolvePlaceFromId).toHaveBeenCalledWith('place-xyz');
    expect(prismaMock.event.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'e-1' },
        data: {
          location: 'New Address',
          lat: 3,
          lng: 4,
        },
      }),
    );
    expect(mockWriteAuditLog).toHaveBeenCalledWith({
      userId: 'u-1',
      eventId: 'e-1',
      action: 'event.re_resolve_location',
      oldValue: { location: 'Old Address', lat: 1, lng: 2 },
      newValue: { location: 'New Address', lat: 3, lng: 4 },
    });
  });

  it('returns 500 on a non-Google error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.event.findUnique.mockRejectedValue(new Error('boom'));
    const res = await POST(makeJsonRequest('http://x', undefined, 'POST'), eventParams);
    expect(res.status).toBe(500);
  });
});
