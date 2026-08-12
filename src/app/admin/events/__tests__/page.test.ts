import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  event: { findMany: vi.fn() },
}));

vi.mock('~/lib/prisma', () => ({ prisma: prismaMock }));

vi.mock('~/lib/admin-auth', () => ({
  requireAdminPage: vi.fn(),
}));

vi.mock('~/components/admin/AdminShell', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('~/components/admin/EventsTable', () => ({
  default: () => null,
}));

const { _getEvents } = await import('~/app/admin/events/page');

beforeEach(() => {
  prismaMock.event.findMany.mockReset();
});

describe('active admin events page query (FPP-68)', () => {
  it('excludes archived rows from the active list', async () => {
    prismaMock.event.findMany.mockResolvedValue([]);

    await _getEvents();

    const call = prismaMock.event.findMany.mock.calls[0]?.[0] as {
      where: { archivedAt: null };
      orderBy: { date: 'desc' };
    };

    expect(call.where).toEqual({ archivedAt: null });
    expect(call.orderBy).toEqual({ date: 'desc' });
  });

  it('returns whatever Prisma resolves so the page can map to AdminEventRow', async () => {
    const row = {
      id: 'e1',
      name: 'Active picnic',
      date: new Date('2026-09-12T17:00:00Z'),
      location: 'Park',
      status: 'PUBLISHED',
      maxCapacity: 50,
      rsvpDeadline: new Date('2026-08-25T17:00:00Z'),
      archivedAt: null,
      _count: { rsvps: 10, potluckSlots: 3 },
    };
    prismaMock.event.findMany.mockResolvedValue([row]);

    const result = await _getEvents();
    expect(result).toEqual([row]);
  });
});
