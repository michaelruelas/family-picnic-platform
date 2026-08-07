import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  adminAuditLog: { findMany: vi.fn() },
  auditLog: { findMany: vi.fn() },
}));

vi.mock('~/lib/prisma', () => ({
  prisma: mockPrisma,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listAuditLogEntries', () => {
  it('queries both AdminAuditLog and AuditLog in parallel', async () => {
    const { listAuditLogEntries } = await import('../audit-entries');

    mockPrisma.adminAuditLog.findMany.mockResolvedValue([]);
    mockPrisma.auditLog.findMany.mockResolvedValue([]);

    await listAuditLogEntries();

    expect(mockPrisma.adminAuditLog.findMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledTimes(1);
  });

  it('merges entries from both sources sorted by occurred time', async () => {
    const { listAuditLogEntries } = await import('../audit-entries');

    mockPrisma.adminAuditLog.findMany.mockResolvedValue([
      {
        id: 'a-1',
        action: 'event.create',
        createdAt: new Date('2026-08-07T10:00:00Z'),
        userId: 'u-1',
        eventId: 'e-1',
        oldValue: null,
        newValue: { name: 'Picnic' },
        user: { id: 'u-1', name: 'Admin', email: 'admin@x.com' },
        event: { id: 'e-1', name: 'Annual Picnic' },
      },
    ]);
    mockPrisma.auditLog.findMany.mockResolvedValue([
      {
        id: 'd-1',
        action: 'rsvp.signup',
        subjectType: 'RSVP',
        subjectId: 'rsvp-1',
        payload: { eventId: 'e-1' },
        occurredAt: new Date('2026-08-07T12:00:00Z'),
        actorId: 'u-2',
        actor: { id: 'u-2', name: 'User', email: 'user@x.com' },
      },
    ]);

    const result = await listAuditLogEntries();

    expect(result).toHaveLength(2);
    expect(result[0]?.source).toBe('domain');
    expect(result[1]?.source).toBe('admin');
    const adminRow = result.find((r) => r.source === 'admin');
    expect(adminRow?.eventName).toBe('Annual Picnic');
    const domainRow = result.find((r) => r.source === 'domain');
    expect(domainRow?.subjectType).toBe('RSVP');
    expect(domainRow?.subjectId).toBe('rsvp-1');
  });

  it('passes time-range filter to both queries', async () => {
    const { listAuditLogEntries } = await import('../audit-entries');

    mockPrisma.adminAuditLog.findMany.mockResolvedValue([]);
    mockPrisma.auditLog.findMany.mockResolvedValue([]);

    const from = new Date('2026-08-01T00:00:00Z');
    const to = new Date('2026-08-31T23:59:59Z');
    await listAuditLogEntries({ from, to });

    const adminCall = mockPrisma.adminAuditLog.findMany.mock.calls[0]?.[0] as {
      where: { createdAt: { gte?: Date; lte?: Date } };
    };
    const domainCall = mockPrisma.auditLog.findMany.mock.calls[0]?.[0] as {
      where: { occurredAt: { gte?: Date; lte?: Date } };
    };
    expect(adminCall.where.createdAt.gte).toEqual(from);
    expect(adminCall.where.createdAt.lte).toEqual(to);
    expect(domainCall.where.occurredAt.gte).toEqual(from);
    expect(domainCall.where.occurredAt.lte).toEqual(to);
  });

  it('passes subject filters to the AuditLog query only', async () => {
    const { listAuditLogEntries } = await import('../audit-entries');

    mockPrisma.adminAuditLog.findMany.mockResolvedValue([]);
    mockPrisma.auditLog.findMany.mockResolvedValue([]);

    await listAuditLogEntries({ subjectType: 'RSVP', subjectId: 'rsvp-1' });

    const adminCall = mockPrisma.adminAuditLog.findMany.mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
    };
    const domainCall = mockPrisma.auditLog.findMany.mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
    };
    expect(adminCall.where).not.toHaveProperty('subjectType');
    expect(domainCall.where).toMatchObject({
      subjectType: 'RSVP',
      subjectId: 'rsvp-1',
    });
  });

  it('filters AuditLog rows by eventId via the payload JSON path', async () => {
    const { listAuditLogEntries } = await import('../audit-entries');

    mockPrisma.adminAuditLog.findMany.mockResolvedValue([]);
    mockPrisma.auditLog.findMany.mockResolvedValue([]);

    await listAuditLogEntries({ eventId: 'evt-1' });

    const domainCall = mockPrisma.auditLog.findMany.mock.calls[0]?.[0] as {
      where: { payload?: { path: string[]; equals: string } };
    };
    expect(domainCall.where.payload).toEqual({
      path: ['eventId'],
      equals: 'evt-1',
    });
  });
});
