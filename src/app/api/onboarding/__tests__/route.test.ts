import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextResponseJson, resetPrismaMock, makeJsonRequest } from 'tests/helpers/route';
import { Prisma } from '~/lib/generated/client';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));

const prismaMock = vi.hoisted(() => ({
  user: { update: vi.fn(), findUnique: vi.fn() },
  household: { create: vi.fn(), findFirst: vi.fn() },
  householdMember: { create: vi.fn(), findFirst: vi.fn() },
  dependent: { create: vi.fn() },
  $transaction: vi.fn(),
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
    prismaMock.$transaction.mockImplementation(
      async (fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock) as never,
    );
    prismaMock.user.update.mockResolvedValue({} as never);
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u-1', name: 'Me' } as never);
    prismaMock.householdMember.findFirst.mockResolvedValue(null);
    prismaMock.householdMember.create.mockResolvedValue({} as never);
    const res = await POSTHousehold(makeJsonRequest('http://x', { joinHouseholdId: 'h-existing' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.householdId).toBe('h-existing');
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u-1' },
        data: { householdId: 'h-existing' },
      }),
    );
    expect(prismaMock.householdMember.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ householdId: 'h-existing', name: 'Me' }),
      }),
    );
  });

  it('returns 400 when name missing and not joining', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    const res = await POSTHousehold(makeJsonRequest('http://x', {}));
    expect(res.status).toBe(400);
  });

  it('creates a new household, links the user, and seeds a self member', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.household.findFirst.mockResolvedValue(null);
    prismaMock.household.create.mockResolvedValue({ id: 'h-new' } as never);
    prismaMock.user.update.mockResolvedValue({} as never);
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u-1', name: 'Me' } as never);
    prismaMock.householdMember.create.mockResolvedValue({} as never);
    prismaMock.$transaction.mockImplementation(
      async (fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock) as never,
    );
    const res = await POSTHousehold(makeJsonRequest('http://x', { name: 'The Smiths' }));
    expect(res.status).toBe(200);
    expect(prismaMock.household.create).toHaveBeenCalled();
    expect(prismaMock.user.update).toHaveBeenCalled();
    expect(prismaMock.householdMember.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ householdId: 'h-new', name: 'Me' }),
      }),
    );
  });

  it('rejects empty household name', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    const res = await POSTHousehold(makeJsonRequest('http://x', { name: '' }));
    expect(res.status).toBe(400);
    expect(prismaMock.household.create).not.toHaveBeenCalled();
  });

  it('rejects household name longer than 80 chars', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    const res = await POSTHousehold(makeJsonRequest('http://x', { name: 'a'.repeat(81) }));
    expect(res.status).toBe(400);
    expect(prismaMock.household.create).not.toHaveBeenCalled();
  });

  it('returns 409 on duplicate household name', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.$transaction.mockImplementation(async () => {
      throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      });
    });
    const res = await POSTHousehold(makeJsonRequest('http://x', { name: 'The Smiths' }));
    expect(res.status).toBe(409);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('returns 500 on error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.$transaction.mockRejectedValue(new Error('boom'));
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
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u-1', householdId: null } as never);
    const res = await POSTDependent(makeJsonRequest('http://x', { name: 'Kid' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when name missing', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u-1', householdId: 'h-1' } as never);
    const res = await POSTDependent(makeJsonRequest('http://x', {}));
    expect(res.status).toBe(400);
  });

  it('creates a household member with the trimmed name', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u-1', householdId: 'h-1' } as never);
    prismaMock.householdMember.findFirst.mockResolvedValue(null);
    prismaMock.householdMember.create.mockResolvedValue({ id: 'm-1' } as never);
    const res = await POSTDependent(
      makeJsonRequest('http://x', { name: 'Kid', age: 10, isChild: true }),
    );
    expect(res.status).toBe(200);
    expect(prismaMock.householdMember.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          householdId: 'h-1',
          name: 'Kid',
          age: 10,
        }),
      }),
    );
  });

  it('rejects duplicate member names within a household', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u-1', householdId: 'h-1' } as never);
    prismaMock.householdMember.findFirst.mockResolvedValue({ id: 'm-1' } as never);
    const res = await POSTDependent(makeJsonRequest('http://x', { name: 'Spouse' }));
    expect(res.status).toBe(409);
  });

  it('passes deletedAt: null to the duplicate check so a re-added name works', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u-1', householdId: 'h-1' } as never);
    prismaMock.householdMember.findFirst.mockResolvedValue(null);
    prismaMock.householdMember.create.mockResolvedValue({ id: 'm-2' } as never);
    const res = await POSTDependent(makeJsonRequest('http://x', { name: 'Spouse' }));
    expect(res.status).toBe(200);
    expect(prismaMock.householdMember.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
      }),
    );
  });

  it('persists the relationship string on the new member', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u-1', householdId: 'h-1' } as never);
    prismaMock.householdMember.findFirst.mockResolvedValue(null);
    prismaMock.householdMember.create.mockResolvedValue({ id: 'm-3' } as never);
    const res = await POSTDependent(
      makeJsonRequest('http://x', { name: 'Cousin', relationship: 'COUSIN' }),
    );
    expect(res.status).toBe(200);
    expect(prismaMock.householdMember.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Cousin', relationship: 'COUSIN' }),
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

  it('accepts SMS preference when a phone is provided', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.user.update.mockResolvedValue({} as never);
    const res = await POSTComplete(
      makeJsonRequest('http://x', {
        communicationPreference: 'SMS',
        phoneNumber: '+15551234567',
        smsConsent: true,
      }),
    );
    expect(res.status).toBe(200);
  });

  it('rejects SMS preference without a phone', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    const res = await POSTComplete(makeJsonRequest('http://x', { communicationPreference: 'SMS' }));
    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    prismaMock.user.update.mockRejectedValue(new Error('boom'));
    const res = await POSTComplete(makeJsonRequest('http://x', {}));
    expect(res.status).toBe(500);
  });
});
