import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RsvpBackfillClient } from '../rsvp-backfill';

type RsvpRow = {
  id: string;
  eventId: string;
  userId: string;
  status: string;
  headcount: number;
  dietaryNotes: string | null;
  respondedAt: Date | null;
  modifiedAt: Date;
  waitlistPosition: number | null;
};

function makeRsvp(overrides: Partial<RsvpRow>): RsvpRow {
  return {
    id: 'rsvp-default',
    eventId: 'event-1',
    userId: 'user-1',
    status: 'CONFIRMED',
    headcount: 1,
    dietaryNotes: null,
    respondedAt: new Date('2026-01-01T00:00:00Z'),
    modifiedAt: new Date('2026-01-01T00:00:00Z'),
    waitlistPosition: null,
    ...overrides,
  };
}

interface TestHarness {
  client: RsvpBackfillClient;
  deletedRsvps: string[];
  auditLogs: Array<{
    userId: string;
    eventId: string;
    action: string;
    oldValue: unknown;
    newValue: unknown;
  }>;
}

function makeClient(opts: {
  groups?: Array<{ eventId: string; userId: string; count: number }>;
  rsvpsByGroup?: Map<string, RsvpRow[]>;
  potluckReassignCounts?: Map<string, number>;
}): TestHarness {
  const groups = opts.groups ?? [];
  const rsvpsByGroup = opts.rsvpsByGroup ?? new Map<string, RsvpRow[]>();
  const potluckReassignCounts = opts.potluckReassignCounts ?? new Map<string, number>();
  const deletedRsvps: string[] = [];
  const auditLogs: TestHarness['auditLogs'] = [];

  const rSVP = {
    groupBy: vi.fn(async () =>
      groups.map((g) => ({
        eventId: g.eventId,
        userId: g.userId,
        _count: { _all: g.count },
      })),
    ),
    findMany: vi.fn(async ({ where }: { where: { eventId: string; userId: string } }) => {
      const key = `${where.eventId}:${where.userId}`;
      return rsvpsByGroup.get(key) ?? [];
    }),
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
      for (const rows of rsvpsByGroup.values()) {
        const found = rows.find((r) => r.id === where.id);
        if (found) return found;
      }
      return null;
    }),
    delete: vi.fn(async ({ where }: { where: { id: string } }) => {
      deletedRsvps.push(where.id);
      for (const rows of rsvpsByGroup.values()) {
        const idx = rows.findIndex((r) => r.id === where.id);
        if (idx >= 0) rows.splice(idx, 1);
      }
      return { id: where.id };
    }),
  };

  const potluckSignup = {
    updateMany: vi.fn(async ({ where }: { where: { rsvpId: string } }) => {
      const count = potluckReassignCounts.get(where.rsvpId) ?? 0;
      return { count };
    }),
  };

  const adminAuditLog = {
    create: vi.fn(
      async ({
        data,
      }: {
        data: {
          userId: string;
          eventId: string;
          action: string;
          oldValue: unknown;
          newValue: unknown;
        };
      }) => {
        auditLogs.push(data);
        return data;
      },
    ),
  };

  const $transaction = vi.fn(
    async <T>(
      fn: (
        tx: Parameters<RsvpBackfillClient['$transaction']>[0] extends (tx: infer Tx) => unknown
          ? Tx
          : never,
      ) => Promise<T>,
    ) => {
      return fn({ rSVP, potluckSignup, adminAuditLog } as never);
    },
  );

  return {
    client: { rSVP, potluckSignup, adminAuditLog, $transaction } as unknown as RsvpBackfillClient,
    deletedRsvps,
    auditLogs,
  };
}

describe('findDuplicateRsvpPlans', () => {
  it('returns an empty plan list when no duplicates exist', async () => {
    const groups: Array<{ eventId: string; userId: string; count: number }> = [];
    const rsvpsByGroup = new Map<string, RsvpRow[]>();
    const { client } = makeClient({ groups, rsvpsByGroup });

    const { findDuplicateRsvpPlans } = await import('../rsvp-backfill');
    const plans = await findDuplicateRsvpPlans(client);

    expect(plans).toEqual([]);
  });

  it('skips groups that report a count > 1 but only have one row at fetch time', async () => {
    const groups = [{ eventId: 'event-1', userId: 'user-1', count: 2 }];
    const rsvpsByGroup = new Map<string, RsvpRow[]>([['event-1:user-1', [makeRsvp({ id: 'r1' })]]]);
    const { client } = makeClient({ groups, rsvpsByGroup });

    const { findDuplicateRsvpPlans } = await import('../rsvp-backfill');
    const plans = await findDuplicateRsvpPlans(client);

    expect(plans).toEqual([]);
  });

  it('picks the most recently modified RSVP as the winner', async () => {
    const groups = [{ eventId: 'event-1', userId: 'user-1', count: 3 }];
    const rsvpsByGroup = new Map<string, RsvpRow[]>([
      [
        'event-1:user-1',
        [
          makeRsvp({
            id: 'old',
            modifiedAt: new Date('2026-01-01T00:00:00Z'),
            headcount: 1,
          }),
          makeRsvp({
            id: 'newest',
            modifiedAt: new Date('2026-03-01T00:00:00Z'),
            headcount: 4,
            dietaryNotes: 'vegan',
          }),
          makeRsvp({
            id: 'middle',
            modifiedAt: new Date('2026-02-01T00:00:00Z'),
            headcount: 2,
          }),
        ],
      ],
    ]);
    const { client } = makeClient({ groups, rsvpsByGroup });

    const { findDuplicateRsvpPlans } = await import('../rsvp-backfill');
    const plans = await findDuplicateRsvpPlans(client);

    expect(plans).toEqual([
      {
        key: { eventId: 'event-1', userId: 'user-1' },
        winnerId: 'newest',
        loserIds: ['middle', 'old'],
      },
    ]);
  });

  it('uses respondedAt as a tiebreaker when modifiedAt is equal', async () => {
    const sameTime = new Date('2026-01-01T00:00:00Z');
    const groups = [{ eventId: 'event-1', userId: 'user-1', count: 2 }];
    const rsvpsByGroup = new Map<string, RsvpRow[]>([
      [
        'event-1:user-1',
        [
          makeRsvp({
            id: 'older-response',
            modifiedAt: sameTime,
            respondedAt: new Date('2026-01-01T00:00:00Z'),
          }),
          makeRsvp({
            id: 'newer-response',
            modifiedAt: sameTime,
            respondedAt: new Date('2026-02-01T00:00:00Z'),
          }),
        ],
      ],
    ]);
    const { client } = makeClient({ groups, rsvpsByGroup });

    const { findDuplicateRsvpPlans } = await import('../rsvp-backfill');
    const plans = await findDuplicateRsvpPlans(client);

    expect(plans[0]?.winnerId).toBe('newer-response');
    expect(plans[0]?.loserIds).toEqual(['older-response']);
  });

  it('uses id as a stable tiebreaker when both modifiedAt and respondedAt match', async () => {
    const sameTime = new Date('2026-01-01T00:00:00Z');
    const groups = [{ eventId: 'event-1', userId: 'user-1', count: 2 }];
    const rsvpsByGroup = new Map<string, RsvpRow[]>([
      [
        'event-1:user-1',
        [
          makeRsvp({ id: 'r-aaa', modifiedAt: sameTime, respondedAt: sameTime }),
          makeRsvp({ id: 'r-zzz', modifiedAt: sameTime, respondedAt: sameTime }),
        ],
      ],
    ]);
    const { client } = makeClient({ groups, rsvpsByGroup });

    const { findDuplicateRsvpPlans } = await import('../rsvp-backfill');
    const plans = await findDuplicateRsvpPlans(client);

    expect(plans[0]?.winnerId).toBe('r-zzz');
    expect(plans[0]?.loserIds).toEqual(['r-aaa']);
  });
});

describe('mergeDuplicateRsvps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dry-run mode reports plans but does not write or delete', async () => {
    const groups = [{ eventId: 'event-1', userId: 'user-1', count: 2 }];
    const rsvpsByGroup = new Map<string, RsvpRow[]>([
      [
        'event-1:user-1',
        [
          makeRsvp({ id: 'winner', modifiedAt: new Date('2026-02-01T00:00:00Z') }),
          makeRsvp({ id: 'loser', modifiedAt: new Date('2026-01-01T00:00:00Z') }),
        ],
      ],
    ]);
    const { client, deletedRsvps, auditLogs } = makeClient({ groups, rsvpsByGroup });

    const { mergeDuplicateRsvps } = await import('../rsvp-backfill');
    const result = await mergeDuplicateRsvps(client, { apply: false });

    expect(result.mode).toBe('dry-run');
    expect(result.groupsFound).toBe(1);
    expect(result.plans).toEqual([
      {
        key: { eventId: 'event-1', userId: 'user-1' },
        winnerId: 'winner',
        loserIds: ['loser'],
      },
    ]);
    expect(result.rsvpsDeleted).toBe(0);
    expect(result.potluckSignupsReassigned).toBe(0);
    expect(result.auditLogsWritten).toBe(0);
    expect(deletedRsvps).toEqual([]);
    expect(auditLogs).toEqual([]);
  });

  it('apply mode merges duplicates, reassigns potluck signups, and writes audit entries', async () => {
    const groups = [{ eventId: 'event-1', userId: 'user-1', count: 2 }];
    const winner = makeRsvp({
      id: 'winner',
      modifiedAt: new Date('2026-02-01T00:00:00Z'),
      status: 'CONFIRMED',
      headcount: 3,
      dietaryNotes: 'vegetarian',
    });
    const loser = makeRsvp({
      id: 'loser',
      modifiedAt: new Date('2026-01-01T00:00:00Z'),
      status: 'CONFIRMED',
      headcount: 1,
      dietaryNotes: null,
    });
    const rsvpsByGroup = new Map<string, RsvpRow[]>([['event-1:user-1', [winner, loser]]]);
    const potluckReassignCounts = new Map<string, number>([['loser', 2]]);
    const { client, deletedRsvps, auditLogs } = makeClient({
      groups,
      rsvpsByGroup,
      potluckReassignCounts,
    });

    const { mergeDuplicateRsvps } = await import('../rsvp-backfill');
    const result = await mergeDuplicateRsvps(client, { apply: true });

    expect(result.mode).toBe('apply');
    expect(result.rsvpsDeleted).toBe(1);
    expect(result.potluckSignupsReassigned).toBe(2);
    expect(result.auditLogsWritten).toBe(1);
    expect(result.errors).toEqual([]);
    expect(deletedRsvps).toEqual(['loser']);
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0]).toMatchObject({
      userId: 'user-1',
      eventId: 'event-1',
      action: 'RSVP_MERGE',
      oldValue: expect.objectContaining({ deletedRsvpId: 'loser' }),
      newValue: expect.objectContaining({ keptRsvpId: 'winner' }),
    });

    const callOrder = [
      ...vi.mocked(client.rSVP.findUnique).mock.invocationCallOrder,
      ...vi.mocked(client.potluckSignup.updateMany).mock.invocationCallOrder,
      ...vi.mocked(client.adminAuditLog.create).mock.invocationCallOrder,
      ...vi.mocked(client.rSVP.delete).mock.invocationCallOrder,
    ];
    expect(callOrder).toEqual([...callOrder].sort((a, b) => a - b));
  });

  it('is idempotent: a second run with no duplicates left is a no-op', async () => {
    const { client, deletedRsvps, auditLogs } = makeClient({
      groups: [],
      rsvpsByGroup: new Map(),
    });

    const { mergeDuplicateRsvps } = await import('../rsvp-backfill');
    const result = await mergeDuplicateRsvps(client, { apply: true });

    expect(result.groupsFound).toBe(0);
    expect(result.rsvpsDeleted).toBe(0);
    expect(result.potluckSignupsReassigned).toBe(0);
    expect(result.auditLogsWritten).toBe(0);
    expect(result.plans).toEqual([]);
    expect(deletedRsvps).toEqual([]);
    expect(auditLogs).toEqual([]);
  });

  it('continues merging other groups when one group fails', async () => {
    const groups = [
      { eventId: 'event-1', userId: 'user-1', count: 2 },
      { eventId: 'event-2', userId: 'user-2', count: 2 },
    ];
    const rsvpsByGroup = new Map<string, RsvpRow[]>([
      [
        'event-1:user-1',
        [
          makeRsvp({
            id: 'w1',
            eventId: 'event-1',
            userId: 'user-1',
            modifiedAt: new Date('2026-02-01T00:00:00Z'),
          }),
          makeRsvp({
            id: 'l1',
            eventId: 'event-1',
            userId: 'user-1',
            modifiedAt: new Date('2026-01-01T00:00:00Z'),
          }),
        ],
      ],
      [
        'event-2:user-2',
        [
          makeRsvp({
            id: 'w2',
            eventId: 'event-2',
            userId: 'user-2',
            modifiedAt: new Date('2026-02-01T00:00:00Z'),
          }),
          makeRsvp({
            id: 'l2',
            eventId: 'event-2',
            userId: 'user-2',
            modifiedAt: new Date('2026-01-01T00:00:00Z'),
          }),
        ],
      ],
    ]);
    const { client, auditLogs, deletedRsvps } = makeClient({ groups, rsvpsByGroup });

    const realFindUnique = client.rSVP.findUnique;
    let callCount = 0;
    client.rSVP.findUnique = vi.fn(async (args: { where: { id: string } }) => {
      callCount += 1;
      if (callCount === 1) {
        throw new Error('boom');
      }
      return realFindUnique(args);
    }) as unknown as RsvpBackfillClient['rSVP']['findUnique'];

    const { mergeDuplicateRsvps } = await import('../rsvp-backfill');
    const result = await mergeDuplicateRsvps(client, { apply: true });

    expect(result.groupsFound).toBe(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('event=event-1');
    expect(result.errors[0]).toContain('user=user-1');
    expect(result.errors[0]).toContain('boom');
    expect(result.rsvpsDeleted).toBe(1);
    expect(deletedRsvps).toEqual(['l2']);
    expect(auditLogs).toHaveLength(1);
  });

  it('records a top-level error and returns early when the initial scan fails', async () => {
    const groupBy = vi.fn(async () => {
      throw new Error('db offline');
    });
    const client = {
      rSVP: {
        groupBy,
        findMany: vi.fn(),
        findUnique: vi.fn(),
        delete: vi.fn(),
      },
      potluckSignup: { updateMany: vi.fn() },
      adminAuditLog: { create: vi.fn() },
      $transaction: vi.fn(),
    } as unknown as RsvpBackfillClient;

    const { mergeDuplicateRsvps } = await import('../rsvp-backfill');
    const result = await mergeDuplicateRsvps(client, { apply: true });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('db offline');
    expect(result.groupsFound).toBe(0);
    expect(result.rsvpsDeleted).toBe(0);
  });
});

describe('formatRsvpBackfillResult', () => {
  it('renders dry-run output with the plan but no write counts', async () => {
    const { formatRsvpBackfillResult } = await import('../rsvp-backfill');
    const output = formatRsvpBackfillResult({
      mode: 'dry-run',
      groupsFound: 1,
      rsvpsDeleted: 0,
      potluckSignupsReassigned: 0,
      auditLogsWritten: 0,
      plans: [
        {
          key: { eventId: 'event-1', userId: 'user-1' },
          winnerId: 'winner',
          loserIds: ['loser-a', 'loser-b'],
        },
      ],
      errors: [],
    });

    expect(output).toContain('Mode: dry-run');
    expect(output).toContain('Duplicate (eventId, userId) groups found: 1');
    expect(output).toContain('keep=winner');
    expect(output).toContain('delete=[loser-a, loser-b]');
    expect(output).not.toContain('RSVPs deleted');
  });

  it('renders apply output with write counts and errors when present', async () => {
    const { formatRsvpBackfillResult } = await import('../rsvp-backfill');
    const output = formatRsvpBackfillResult({
      mode: 'apply',
      groupsFound: 1,
      rsvpsDeleted: 1,
      potluckSignupsReassigned: 2,
      auditLogsWritten: 1,
      plans: [
        {
          key: { eventId: 'event-1', userId: 'user-1' },
          winnerId: 'winner',
          loserIds: ['loser'],
        },
      ],
      errors: ['something went wrong'],
    });

    expect(output).toContain('Mode: apply');
    expect(output).toContain('RSVPs deleted: 1');
    expect(output).toContain('Potluck signups reassigned: 2');
    expect(output).toContain('RSVP_MERGE audit entries written: 1');
    expect(output).toContain('Errors:');
    expect(output).toContain('something went wrong');
  });
});
