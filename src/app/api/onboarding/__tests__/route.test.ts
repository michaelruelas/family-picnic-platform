import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextResponseJson, resetPrismaMock, makeJsonRequest } from 'tests/helpers/route';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));

const prismaMock = vi.hoisted(() => ({
  user: { update: vi.fn(), findUnique: vi.fn() },
  household: { create: vi.fn() },
  dependent: { create: vi.fn() },
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
import { POST as POSTHousehold } from '~/app/api/onboarding/household/route';
import { POST as POSTDependent } from '~/app/api/onboarding/dependent/route';
import { POST as POSTComplete } from '~/app/api/onboarding/complete/route';

const mockedSession = vi.mocked(getServerSession);

beforeEach(() => {
  resetPrismaMock(prismaMock);
});

describe('POST /api/onboarding/household', () => {
  it('returns 401 when no session', async () => {
    mockedSession.mockResolvedValue(null);
    const res = await POSTHousehold(makeJsonRequest('http://x', { name: 'Smiths' }));
    expect(res.status).toBe(401);
  });

  it('joins existing household when joinHouseholdId is provided', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.user.update.mockResolvedValue({} as never);
    const res = await POSTHousehold(makeJsonRequest('http://x', { joinHouseholdId: 'h-existing' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.householdId).toBe('h-existing');
  });

  it('returns 400 when name missing and not joining', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    const res = await POSTHousehold(makeJsonRequest('http://x', {}));
    expect(res.status).toBe(400);
  });

  it('creates a new household and links user', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.household.create.mockResolvedValue({ id: 'h-new' } as never);
    prismaMock.user.update.mockResolvedValue({} as never);
    const res = await POSTHousehold(makeJsonRequest('http://x', { name: 'The Smiths' }));
    expect(res.status).toBe(200);
    expect(prismaMock.household.create).toHaveBeenCalled();
    expect(prismaMock.user.update).toHaveBeenCalled();
  });

  it('returns 500 on error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.household.create.mockRejectedValue(new Error('boom'));
    const res = await POSTHousehold(makeJsonRequest('http://x', { name: 'The Smiths' }));
    expect(res.status).toBe(500);
  });
});

describe('POST /api/onboarding/dependent', () => {
  it('returns 401 when no session', async () => {
    mockedSession.mockResolvedValue(null);
    const res = await POSTDependent(makeJsonRequest('http://x', { name: 'Kid' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when user has no household', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.user.findUnique.mockResolvedValue({ householdId: null } as never);
    const res = await POSTDependent(makeJsonRequest('http://x', { name: 'Kid' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when name missing', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.user.findUnique.mockResolvedValue({ householdId: 'h-1' } as never);
    const res = await POSTDependent(makeJsonRequest('http://x', {}));
    expect(res.status).toBe(400);
  });

  it('creates a dependent', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.user.findUnique.mockResolvedValue({ householdId: 'h-1' } as never);
    prismaMock.dependent.create.mockResolvedValue({ id: 'd-1' } as never);
    const res = await POSTDependent(
      makeJsonRequest('http://x', { name: 'Kid', relationship: 'CHILD', age: 10, isChild: true }),
    );
    expect(res.status).toBe(200);
    expect(prismaMock.dependent.create).toHaveBeenCalled();
  });

  it('uses defaults when optional fields are absent', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.user.findUnique.mockResolvedValue({ householdId: 'h-1' } as never);
    prismaMock.dependent.create.mockResolvedValue({ id: 'd-1' } as never);
    const res = await POSTDependent(makeJsonRequest('http://x', { name: 'Spouse' }));
    expect(res.status).toBe(200);
    expect(prismaMock.dependent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ relationship: 'SPOUSE', age: null, isChild: false }),
      }),
    );
  });

  it('returns 500 on error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.user.findUnique.mockRejectedValue(new Error('boom'));
    const res = await POSTDependent(makeJsonRequest('http://x', { name: 'Kid' }));
    expect(res.status).toBe(500);
  });
});

describe('POST /api/onboarding/complete', () => {
  it('returns 401 when no session', async () => {
    mockedSession.mockResolvedValue(null);
    const res = await POSTComplete(makeJsonRequest('http://x', {}));
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid communication preference', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    const res = await POSTComplete(
      makeJsonRequest('http://x', { communicationPreference: 'INVALID' }),
    );
    expect(res.status).toBe(400);
  });

  it('marks onboarding complete with default preference', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.user.update.mockResolvedValue({} as never);
    const res = await POSTComplete(makeJsonRequest('http://x', {}));
    expect(res.status).toBe(200);
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ communicationPreference: 'EMAIL' }),
      }),
    );
  });

  it('accepts SMS preference', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.user.update.mockResolvedValue({} as never);
    const res = await POSTComplete(makeJsonRequest('http://x', { communicationPreference: 'SMS' }));
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.user.update.mockRejectedValue(new Error('boom'));
    const res = await POSTComplete(makeJsonRequest('http://x', {}));
    expect(res.status).toBe(500);
  });
});
