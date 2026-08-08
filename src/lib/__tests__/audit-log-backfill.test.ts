import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AuditLogBackfillClient, AuditLogBackfillPlan } from '../audit-log-backfill';

type RsvpRow = {
  id: string;
  eventId: string;
  userId: string;
  status: 'CONFIRMED' | 'DECLINED' | 'WAITLISTED';
  headcount: number;
  respondedAt: Date | null;
  modifiedAt: Date;
};

type PotluckSignupRow = {
  id: string;
  slotId: string;
  rsvpId: string;
  dishName: string;
  servings: number;
  claimedAt: Date;
  rsvp: { eventId: string; userId: string };
};

type EventAdminRow = {
  eventId: string;
  userId: string;
  role: 'OWNER' | 'COADMIN' | 'INVITER';
  createdAt: Date;
};

const BACKFILL_MARKER = 'backfill-audit-log';

function makeRsvp(overrides: Partial<RsvpRow>): RsvpRow {
  return {
    id: 'rsvp-default',
    eventId: 'event-1',
    userId: 'user-1',
    status: 'CONFIRMED',
    headcount: 1,
    respondedAt: new Date('2026-08-01T00:00:00Z'),
    modifiedAt: new Date('2026-08-02T00:00:00Z'),
    ...overrides,
  };
}

function makeSignup(overrides: Partial<PotluckSignupRow>): PotluckSignupRow {
  return {
    id: 'signup-default',
    slotId: 'slot-1',
    rsvpId: 'rsvp-1',
    dishName: 'Pasta',
    servings: 4,
    claimedAt: new Date('2026-08-01T00:00:00Z'),
    rsvp: { eventId: 'event-1', userId: 'user-1' },
    ...overrides,
  };
}

function makeAdmin(overrides: Partial<EventAdminRow>): EventAdminRow {
  return {
    eventId: 'event-1',
    userId: 'user-1',
    role: 'COADMIN',
    createdAt: new Date('2026-08-01T00:00:00Z'),
    ...overrides,
  };
}

interface TestHarness {
  client: AuditLogBackfillClient;
  writtenEntries: Array<{
    actorId: string | null;
    action: string;
    subjectType: string;
    subjectId: string;
    payload: unknown;
    occurredAt: Date;
  }>;
}

function makeClient(
  opts: {
    rsvps?: RsvpRow[];
    signups?: PotluckSignupRow[];
    admins?: EventAdminRow[];
    existingAudit?: Array<{
      subjectType: string;
      subjectId: string;
      action: string;
    }>;
  } = {},
): TestHarness {
  const rsvps = opts.rsvps ?? [];
  const signups = opts.signups ?? [];
  const admins = opts.admins ?? [];
  const existingAudit = opts.existingAudit ?? [];
  const written: TestHarness['writtenEntries'] = [];

  const rSVP = {
    findMany: vi.fn(async () => rsvps),
  };

  const potluckSignup = {
    findMany: vi.fn(async () => signups),
  };

  const eventAdmin = {
    findMany: vi.fn(async () => admins),
  };

  const auditLog = {
    findMany: vi.fn(async ({ where }: { where: { OR?: unknown[] } }) => {
      // Mirror the OR-of-triples filter the library constructs.
      const ors = (where.OR ?? []) as Array<{
        subjectType: string;
        subjectId: string;
        action: string;
        payload?: { path: string[]; equals: string };
      }>;
      return existingAudit.filter((row) =>
        ors.some(
          (or) =>
            or.subjectType === row.subjectType &&
            or.subjectId === row.subjectId &&
            or.action === row.action,
        ),
      );
    }),
    createMany: vi.fn(async ({ data }: { data: TestHarness['writtenEntries'] }) => {
      written.push(...data);
      return { count: data.length };
    }),
  };

  return {
    client: { rSVP, potluckSignup, eventAdmin, auditLog } as unknown as AuditLogBackfillClient,
    writtenEntries: written,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('findAuditLogBackfillPlans', () => {
  it('produces one plan per source row', async () => {
    const harness = makeClient({
      rsvps: [makeRsvp({ id: 'rsvp-1' })],
      signups: [makeSignup({ id: 'signup-1' })],
      admins: [makeAdmin({})],
    });
    const { findAuditLogBackfillPlans } = await import('../audit-log-backfill');

    const plans = await findAuditLogBackfillPlans(harness.client);

    expect(plans).toHaveLength(3);
    const subjects = plans.map((p) => p.subjectType).sort();
    expect(subjects).toEqual(['EventAdmin', 'PotluckSignup', 'RSVP']);
  });

  it('tags the RSVP plan with the rsvp.signup action', async () => {
    const harness = makeClient({ rsvps: [makeRsvp({ id: 'rsvp-1' })] });
    const { findAuditLogBackfillPlans } = await import('../audit-log-backfill');

    const [plan] = await findAuditLogBackfillPlans(harness.client);

    expect(plan).toMatchObject({
      action: 'rsvp.signup',
      subjectType: 'RSVP',
      subjectId: 'rsvp-1',
      actorId: 'user-1',
    });
    expect(plan && (plan.payload as Record<string, unknown>).source).toBe(BACKFILL_MARKER);
  });

  it('uses the composite event:user as the EventAdmin subject id', async () => {
    const harness = makeClient({
      admins: [makeAdmin({ eventId: 'event-2', userId: 'user-7' })],
    });
    const { findAuditLogBackfillPlans } = await import('../audit-log-backfill');

    const [plan] = await findAuditLogBackfillPlans(harness.client);

    expect(plan).toMatchObject({
      action: 'event.admin.add',
      subjectType: 'EventAdmin',
      subjectId: 'event-2:user-7',
    });
  });

  it('returns an empty plan list when the tables are empty', async () => {
    const harness = makeClient();
    const { findAuditLogBackfillPlans } = await import('../audit-log-backfill');

    const plans = await findAuditLogBackfillPlans(harness.client);
    expect(plans).toEqual([]);
  });
});

describe('filterNewPlans', () => {
  it('drops plans whose (subject, action) triple already exists', async () => {
    const plans: AuditLogBackfillPlan[] = [
      {
        action: 'rsvp.signup',
        subjectType: 'RSVP',
        subjectId: 'rsvp-1',
        actorId: 'user-1',
        occurredAt: new Date(),
        payload: { source: BACKFILL_MARKER },
      },
      {
        action: 'rsvp.signup',
        subjectType: 'RSVP',
        subjectId: 'rsvp-2',
        actorId: 'user-1',
        occurredAt: new Date(),
        payload: { source: BACKFILL_MARKER },
      },
    ];
    const harness = makeClient({
      existingAudit: [{ subjectType: 'RSVP', subjectId: 'rsvp-1', action: 'rsvp.signup' }],
    });
    const { filterNewPlans } = await import('../audit-log-backfill');

    const { newPlans, skipped } = await filterNewPlans(harness.client, plans);

    expect(skipped).toBe(1);
    expect(newPlans).toHaveLength(1);
    expect(newPlans[0]?.subjectId).toBe('rsvp-2');
  });
});

describe('backfillAuditLog', () => {
  it('dry-run does not write any audit entries', async () => {
    const harness = makeClient({
      rsvps: [makeRsvp({ id: 'rsvp-1' })],
      signups: [makeSignup({ id: 'signup-1' })],
      admins: [makeAdmin({})],
    });
    const { backfillAuditLog } = await import('../audit-log-backfill');

    const result = await backfillAuditLog(harness.client, { apply: false });

    expect(result.mode).toBe('dry-run');
    expect(result.entriesWritten).toBe(0);
    expect(result.plans).toHaveLength(3);
    expect(harness.writtenEntries).toHaveLength(0);
  });

  it('apply mode writes the planned entries and stamps the backfill marker', async () => {
    const harness = makeClient({
      rsvps: [makeRsvp({ id: 'rsvp-1' })],
      signups: [makeSignup({ id: 'signup-1' })],
      admins: [makeAdmin({})],
    });
    const { backfillAuditLog } = await import('../audit-log-backfill');

    const result = await backfillAuditLog(harness.client, { apply: true });

    expect(result.mode).toBe('apply');
    expect(result.entriesWritten).toBe(3);
    expect(result.entriesSkipped).toBe(0);
    for (const entry of harness.writtenEntries) {
      expect((entry.payload as Record<string, unknown>).source).toBe(BACKFILL_MARKER);
    }
  });

  it('apply mode is idempotent: re-running writes nothing', async () => {
    const harness = makeClient({
      rsvps: [makeRsvp({ id: 'rsvp-1' })],
      existingAudit: [{ subjectType: 'RSVP', subjectId: 'rsvp-1', action: 'rsvp.signup' }],
    });
    const { backfillAuditLog } = await import('../audit-log-backfill');

    const result = await backfillAuditLog(harness.client, { apply: true });

    expect(result.entriesWritten).toBe(0);
    expect(result.entriesSkipped).toBe(1);
    expect(harness.writtenEntries).toHaveLength(0);
  });

  it('records per-row errors but continues scanning', async () => {
    const rSVP = {
      findMany: vi.fn(async () => {
        throw new Error('rsvp table offline');
      }),
    };
    const harness: TestHarness = {
      client: {
        rSVP,
        potluckSignup: { findMany: vi.fn(async () => []) },
        eventAdmin: { findMany: vi.fn(async () => []) },
        auditLog: {
          findMany: vi.fn(async () => []),
          createMany: vi.fn(),
        },
      } as unknown as AuditLogBackfillClient,
      writtenEntries: [],
    };
    const { backfillAuditLog } = await import('../audit-log-backfill');

    const result = await backfillAuditLog(harness.client, { apply: true });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/rsvp table offline/);
    expect(result.entriesWritten).toBe(0);
  });
});

describe('formatAuditLogBackfillResult', () => {
  it('summarises apply-mode runs', async () => {
    const { formatAuditLogBackfillResult } = await import('../audit-log-backfill');
    const output = formatAuditLogBackfillResult({
      mode: 'apply',
      scanned: { rsvps: 4, potluckSignups: 2, eventAdmins: 1 },
      plans: [],
      entriesWritten: 7,
      entriesSkipped: 0,
      errors: [],
    });
    expect(output).toContain('Mode: apply');
    expect(output).toContain('Audit entries written: 7');
  });
});
