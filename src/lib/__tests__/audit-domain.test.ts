import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('~/lib/prisma', () => ({
  prisma: {
    adminAuditLog: {
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

describe('writeDomainAuditLog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls prisma.auditLog.create with the entry payload', async () => {
    const { writeDomainAuditLog } = await import('../audit');
    const { prisma } = await import('~/lib/prisma');

    await writeDomainAuditLog({
      actorId: 'user-1',
      action: 'rsvp.signup',
      subjectType: 'RSVP',
      subjectId: 'rsvp-1',
      payload: { eventId: 'event-1', status: 'CONFIRMED' },
    });

    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: 'user-1',
        action: 'rsvp.signup',
        subjectType: 'RSVP',
        subjectId: 'rsvp-1',
        payload: { eventId: 'event-1', status: 'CONFIRMED' },
        occurredAt: undefined,
      },
    });
  });

  it('coerces a missing actorId to null', async () => {
    const { writeDomainAuditLog } = await import('../audit');
    const { prisma } = await import('~/lib/prisma');

    await writeDomainAuditLog({
      action: 'system.noActor',
      subjectType: 'RSVP',
      subjectId: 'rsvp-2',
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: null,
        action: 'system.noActor',
        subjectType: 'RSVP',
        subjectId: 'rsvp-2',
        payload: undefined,
        occurredAt: undefined,
      },
    });
  });

  it('forwards occurredAt when provided', async () => {
    const { writeDomainAuditLog } = await import('../audit');
    const { prisma } = await import('~/lib/prisma');

    const at = new Date('2026-08-07T12:00:00Z');
    await writeDomainAuditLog({
      actorId: 'user-1',
      action: 'potluck.signup.create',
      subjectType: 'PotluckSignup',
      subjectId: 'signup-1',
      payload: { slotId: 'slot-1', dishName: 'Pasta' },
      occurredAt: at,
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: 'user-1',
        action: 'potluck.signup.create',
        subjectType: 'PotluckSignup',
        subjectId: 'signup-1',
        payload: { slotId: 'slot-1', dishName: 'Pasta' },
        occurredAt: at,
      },
    });
  });

  it('uses the supplied transaction client', async () => {
    const { writeDomainAuditLog } = await import('../audit');
    const tx = { auditLog: { create: vi.fn() } };

    await writeDomainAuditLog(
      {
        actorId: 'user-1',
        action: 'rsvp.adminOverride.update',
        subjectType: 'RSVP',
        subjectId: 'rsvp-1',
      },
      // The function only reads `.auditLog.create`, so the loose mock
      // is fine; the type system is the only thing that requires the
      // full delegate shape.
      tx as unknown as Parameters<typeof writeDomainAuditLog>[1],
    );

    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
  });
});
