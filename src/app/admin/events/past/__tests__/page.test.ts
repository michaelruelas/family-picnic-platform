import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  event: { findMany: vi.fn() },
}));

vi.mock('~/lib/prisma', () => ({ prisma: prismaMock }));

// `requireAdminPage` redirects when the caller is not an admin; mock
// it so importing the page module does not throw when the page-level
// tests run. The unit tests in this file only call the exported
// `getPastEvents` helper.
vi.mock('~/lib/admin-auth', () => ({
  requireAdminPage: vi.fn(),
}));

// AdminShell and EventsTable pull in client-side hooks. Stub them
// with empty implementations so the page module can be imported in
// this server-test environment.
vi.mock('~/components/admin/AdminShell', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('~/components/admin/EventsTable', () => ({
  default: () => null,
}));

const { getPastEvents } = await import('~/app/admin/events/past/page');

beforeEach(() => {
  prismaMock.event.findMany.mockReset();
});

describe('getPastEvents (FPP-68)', () => {
  it('queries events where archivedAt is non-null OR (archivedAt is null AND date < now)', async () => {
    prismaMock.event.findMany.mockResolvedValue([]);

    await getPastEvents();

    const call = prismaMock.event.findMany.mock.calls[0]?.[0] as {
      where: { OR: Array<Record<string, unknown>> };
      orderBy: { date: 'desc' };
    };

    expect(call.orderBy).toEqual({ date: 'desc' });
    // First OR branch: archived rows (any timestamp).
    expect(call.where.OR[0]).toEqual({ archivedAt: { not: null } });
    // Second OR branch: legacy rows that pre-date FPP-68.
    expect(call.where.OR[1]).toHaveProperty('archivedAt', null);
    expect(call.where.OR[1]).toHaveProperty('date.lt');
    // `lt` is a Date — confirm it's a recent Date instance rather
    // than a literal so the test stays stable across CI clocks.
    const ltValue = (call.where.OR[1] as { date: { lt: Date } }).date.lt;
    expect(ltValue).toBeInstanceOf(Date);
    const now = Date.now();
    expect(ltValue.getTime()).toBeLessThanOrEqual(now);
    expect(now - ltValue.getTime()).toBeLessThan(60_000);
  });

  it('includes the rsvp + potluck-slot counts for the table', async () => {
    prismaMock.event.findMany.mockResolvedValue([]);

    await getPastEvents();

    const call = prismaMock.event.findMany.mock.calls[0]?.[0] as {
      include: { _count: { select: { rsvps: true; potluckSlots: true } } };
    };

    expect(call.include._count.select).toEqual({
      rsvps: true,
      potluckSlots: true,
    });
  });

  it('returns the rows Prisma resolves', async () => {
    const row = {
      id: 'e1',
      name: 'Past picnic',
      date: new Date('2024-08-15T17:00:00Z'),
      location: 'Park',
      status: 'PUBLISHED',
      maxCapacity: null,
      rsvpDeadline: null,
      archivedAt: new Date('2024-09-01T00:00:00Z'),
      _count: { rsvps: 5, potluckSlots: 2 },
    };
    prismaMock.event.findMany.mockResolvedValue([row]);

    const result = await getPastEvents();
    expect(result).toEqual([row]);
  });
});
