import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RegistrationFeeBackfillClient } from '../registration-fee-backfill';

type RegistrationRow = {
  id: string;
  eventId: string;
  userId: string;
  amountCents: number;
  currency: string;
  status: 'PENDING' | 'PAID' | 'REFUNDED' | 'FORFEITED' | 'CANCELLED';
  createdAt: Date;
};

// Cutoff timestamp used by the backfill. Rows with `createdAt` before
// this date are eligible for zeroing.
const CUTOFF = new Date('2026-08-06T09:00:00Z');
const PRE_CUTOFF = new Date('2026-08-05T12:00:00Z');
const POST_CUTOFF = new Date('2026-08-07T12:00:00Z');

function makeRegistration(overrides: Partial<RegistrationRow>): RegistrationRow {
  return {
    id: 'reg-default',
    eventId: 'event-1',
    userId: 'user-1',
    amountCents: 2500,
    currency: 'usd',
    status: 'PENDING',
    createdAt: PRE_CUTOFF,
    ...overrides,
  };
}

interface TestHarness {
  client: RegistrationFeeBackfillClient;
  updatedRegistrationIds: Array<{ id: string; amountCents: number }>;
  auditLogs: Array<{
    userId: string;
    eventId: string;
    action: string;
    oldValue: unknown;
    newValue: unknown;
  }>;
}

function makeClient(opts: { rows?: RegistrationRow[] } = {}): TestHarness {
  const rows = [...(opts.rows ?? [])];
  const updatedRegistrationIds: TestHarness['updatedRegistrationIds'] = [];
  const auditLogs: TestHarness['auditLogs'] = [];

  const registration = {
    findMany: vi.fn(async ({ where }: { where?: { createdAt?: { lt?: Date } } }) => {
      // B6: simulate the createdAt: { lt: cutoff } filter.
      if (where?.createdAt?.lt) {
        return rows.filter((r) => r.createdAt < where.createdAt!.lt!);
      }
      return rows;
    }),
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
      return rows.find((r) => r.id === where.id) ?? null;
    }),
    update: vi.fn(
      async ({ where, data }: { where: { id: string }; data: { amountCents: number } }) => {
        const idx = rows.findIndex((r) => r.id === where.id);
        if (idx < 0) throw new Error('not found');
        const target = rows[idx];
        if (!target) throw new Error('not found');
        const updated = { ...target, amountCents: data.amountCents };
        rows[idx] = updated;
        updatedRegistrationIds.push({ id: where.id, amountCents: data.amountCents });
        return updated;
      },
    ),
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
        tx: Parameters<RegistrationFeeBackfillClient['$transaction']>[0] extends (
          tx: infer Tx,
        ) => unknown
          ? Tx
          : never,
      ) => Promise<T>,
    ) => {
      return fn({ registration, adminAuditLog } as never);
    },
  );

  return {
    client: {
      registration,
      adminAuditLog,
      $transaction,
    } as unknown as RegistrationFeeBackfillClient,
    updatedRegistrationIds,
    auditLogs,
  };
}

describe('findRegistrationFeeBackfillPlans', () => {
  it('returns an empty plan list when there are no registrations', async () => {
    const { client } = makeClient({ rows: [] });
    const { findRegistrationFeeBackfillPlans } = await import('../registration-fee-backfill');
    const plans = await findRegistrationFeeBackfillPlans(client, CUTOFF);
    expect(plans).toEqual([]);
  });

  it('emits one plan per pre-cutoff registration', async () => {
    const { client } = makeClient({
      rows: [
        makeRegistration({ id: 'reg-1', eventId: 'event-1', userId: 'user-1', amountCents: 2500 }),
        makeRegistration({ id: 'reg-2', eventId: 'event-1', userId: 'user-2', amountCents: 0 }),
      ],
    });
    const { findRegistrationFeeBackfillPlans } = await import('../registration-fee-backfill');
    const plans = await findRegistrationFeeBackfillPlans(client, CUTOFF);
    expect(plans).toHaveLength(2);
    expect(plans[0]).toMatchObject({ registrationId: 'reg-1', currentAmountCents: 2500 });
    expect(plans[1]).toMatchObject({ registrationId: 'reg-2', currentAmountCents: 0 });
  });

  it('excludes post-cutoff registrations (B6: scopes to pre-migration rows)', async () => {
    const { client } = makeClient({
      rows: [
        makeRegistration({ id: 'reg-old', createdAt: PRE_CUTOFF }),
        // Post-cutoff rows: created with the new per-attendee
        // calculator, must not be touched.
        makeRegistration({ id: 'reg-new', createdAt: POST_CUTOFF, amountCents: 5000 }),
        makeRegistration({ id: 'reg-newer', createdAt: POST_CUTOFF, amountCents: 7500 }),
      ],
    });
    const { findRegistrationFeeBackfillPlans } = await import('../registration-fee-backfill');
    const plans = await findRegistrationFeeBackfillPlans(client, CUTOFF);
    expect(plans).toHaveLength(1);
    expect(plans[0]?.registrationId).toBe('reg-old');
  });
});

describe('backfillRegistrationFees', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dry-run mode reports plans but does not write or update', async () => {
    const { client, updatedRegistrationIds, auditLogs } = makeClient({
      rows: [
        makeRegistration({ id: 'reg-1', amountCents: 2500 }),
        makeRegistration({ id: 'reg-2', amountCents: 0 }),
      ],
    });

    const { backfillRegistrationFees } = await import('../registration-fee-backfill');
    const result = await backfillRegistrationFees(client, { apply: false });

    expect(result.mode).toBe('dry-run');
    expect(result.cutoff).toBe('2026-08-06T09:00:00.000Z');
    expect(result.scanned).toBe(2);
    expect(result.plans).toHaveLength(2);
    expect(result.registrationsUpdated).toBe(0);
    expect(result.auditLogsWritten).toBe(0);
    expect(updatedRegistrationIds).toEqual([]);
    expect(auditLogs).toEqual([]);
  });

  it('apply mode zeros non-settled registrations and writes an audit entry for each', async () => {
    const { client, updatedRegistrationIds, auditLogs } = makeClient({
      rows: [
        makeRegistration({ id: 'reg-1', amountCents: 2500, status: 'PENDING' }),
        makeRegistration({ id: 'reg-2', amountCents: 0, status: 'PENDING' }),
      ],
    });

    const { backfillRegistrationFees } = await import('../registration-fee-backfill');
    const result = await backfillRegistrationFees(client, { apply: true });

    expect(result.mode).toBe('apply');
    expect(result.scanned).toBe(2);
    expect(result.registrationsUpdated).toBe(1);
    expect(result.auditLogsWritten).toBe(2);
    expect(result.errors).toEqual([]);
    expect(updatedRegistrationIds).toEqual([{ id: 'reg-1', amountCents: 0 }]);
    expect(auditLogs).toHaveLength(2);
    expect(auditLogs[0]).toMatchObject({
      action: 'REGISTRATION_FEE_BACKFILL',
      oldValue: { amountCents: 2500, status: 'PENDING' },
      newValue: expect.objectContaining({ amountCents: 0, changed: true }),
    });
    expect(auditLogs[1]).toMatchObject({
      action: 'REGISTRATION_FEE_BACKFILL',
      oldValue: { amountCents: 0, status: 'PENDING' },
      newValue: expect.objectContaining({ amountCents: 0, changed: false }),
    });
  });

  it('never zeros a PAID registration (settled rows are left alone but still audited)', async () => {
    const { client, updatedRegistrationIds, auditLogs } = makeClient({
      rows: [makeRegistration({ id: 'reg-paid', amountCents: 5000, status: 'PAID' })],
    });

    const { backfillRegistrationFees } = await import('../registration-fee-backfill');
    const result = await backfillRegistrationFees(client, { apply: true });

    expect(result.scanned).toBe(1);
    expect(result.registrationsUpdated).toBe(0);
    expect(result.auditLogsWritten).toBe(1);
    expect(updatedRegistrationIds).toEqual([]);
    // B7 fix: settled rows' newValue.amountCents is the actual
    // amount, not a misleading zero.
    expect(auditLogs[0]).toMatchObject({
      action: 'REGISTRATION_FEE_BACKFILL',
      oldValue: { amountCents: 5000, status: 'PAID' },
      newValue: expect.objectContaining({
        amountCents: 5000,
        changed: false,
        alreadySettled: true,
      }),
    });
  });

  it('never zeros REFUNDED / FORFEITED / CANCELLED registrations and reports the real amount', async () => {
    const settled: Array<RegistrationRow['status']> = ['REFUNDED', 'FORFEITED', 'CANCELLED'];
    for (const status of settled) {
      const { client, updatedRegistrationIds, auditLogs } = makeClient({
        rows: [makeRegistration({ id: `reg-${status}`, amountCents: 5000, status })],
      });

      const { backfillRegistrationFees } = await import('../registration-fee-backfill');
      const result = await backfillRegistrationFees(client, { apply: true });
      expect(result.registrationsUpdated).toBe(0);
      expect(updatedRegistrationIds).toEqual([]);
      expect(auditLogs[0]?.newValue).toMatchObject({
        amountCents: 5000,
        alreadySettled: true,
      });
    }
  });

  it('is idempotent: a second run updates zero rows and still audits each', async () => {
    const { client, updatedRegistrationIds, auditLogs } = makeClient({
      rows: [makeRegistration({ id: 'reg-1', amountCents: 2500 })],
    });

    const { backfillRegistrationFees } = await import('../registration-fee-backfill');
    const first = await backfillRegistrationFees(client, { apply: true });
    expect(first.registrationsUpdated).toBe(1);
    expect(first.auditLogsWritten).toBe(1);

    const second = await backfillRegistrationFees(client, { apply: true });
    expect(second.scanned).toBe(1);
    expect(second.registrationsUpdated).toBe(0);
    expect(second.auditLogsWritten).toBe(1);
    expect(updatedRegistrationIds).toEqual([{ id: 'reg-1', amountCents: 0 }]);
    expect(auditLogs).toHaveLength(2);
  });

  it('continues auditing remaining rows when one registration throws', async () => {
    const rows = [
      makeRegistration({ id: 'reg-1', amountCents: 2500 }),
      makeRegistration({ id: 'reg-2', amountCents: 2500 }),
    ];
    const { client, updatedRegistrationIds, auditLogs } = makeClient({ rows });
    // Make the second findUnique throw to simulate a transient DB error.
    const realFindUnique = client.registration.findUnique as unknown as ReturnType<typeof vi.fn>;
    realFindUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
      if (where.id === 'reg-2') {
        throw new Error('transient db error');
      }
      return rows.find((r) => r.id === where.id) ?? null;
    });

    const { backfillRegistrationFees } = await import('../registration-fee-backfill');
    const result = await backfillRegistrationFees(client, { apply: true });

    expect(result.scanned).toBe(2);
    expect(result.registrationsUpdated).toBe(1);
    expect(result.auditLogsWritten).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/reg-2/);
    expect(updatedRegistrationIds).toEqual([{ id: 'reg-1', amountCents: 0 }]);
    expect(auditLogs).toHaveLength(1);
  });

  it('surfaces a top-level scan error and skips the apply phase', async () => {
    const { client, updatedRegistrationIds, auditLogs } = makeClient({ rows: [] });
    (client.registration.findMany as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('connection lost'),
    );

    const { backfillRegistrationFees } = await import('../registration-fee-backfill');
    const result = await backfillRegistrationFees(client, { apply: true });

    expect(result.scanned).toBe(0);
    expect(result.errors).toEqual(['Failed to scan registrations: connection lost']);
    expect(updatedRegistrationIds).toEqual([]);
    expect(auditLogs).toEqual([]);
  });

  it('B6: never touches post-cutoff registrations even when --apply runs', async () => {
    // Real-world scenario: operator runs the backfill a day after
    // deployment, post-cutoff RSVPs already carry the new fee.
    const { client, updatedRegistrationIds, auditLogs } = makeClient({
      rows: [
        makeRegistration({ id: 'reg-old', amountCents: 2500, createdAt: PRE_CUTOFF }),
        makeRegistration({ id: 'reg-new', amountCents: 5000, createdAt: POST_CUTOFF }),
      ],
    });

    const { backfillRegistrationFees } = await import('../registration-fee-backfill');
    const result = await backfillRegistrationFees(client, { apply: true });

    expect(result.scanned).toBe(1);
    expect(result.plans.map((p) => p.registrationId)).toEqual(['reg-old']);
    expect(result.registrationsUpdated).toBe(1);
    expect(result.auditLogsWritten).toBe(1);
    expect(updatedRegistrationIds).toEqual([{ id: 'reg-old', amountCents: 0 }]);
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0]?.eventId).toBe('event-1');
    expect(auditLogs[0]?.userId).toBe('user-1');
  });

  it('honors a caller-supplied cutoff override', async () => {
    const laterCutoff = new Date('2026-09-01T00:00:00Z');
    const { client } = makeClient({
      rows: [makeRegistration({ id: 'reg-mid', createdAt: new Date('2026-08-15T00:00:00Z') })],
    });

    const { backfillRegistrationFees } = await import('../registration-fee-backfill');
    // With the default cutoff, this row is post-cutoff and excluded.
    const before = await backfillRegistrationFees(client, { apply: false });
    expect(before.scanned).toBe(0);
    // With the later cutoff, it is included.
    const after = await backfillRegistrationFees(client, { apply: false, cutoff: laterCutoff });
    expect(after.scanned).toBe(1);
    expect(after.cutoff).toBe('2026-09-01T00:00:00.000Z');
  });
});

describe('formatRegistrationFeeBackfillResult', () => {
  it('renders dry-run summary without apply counters', async () => {
    const { formatRegistrationFeeBackfillResult } = await import('../registration-fee-backfill');
    const out = formatRegistrationFeeBackfillResult({
      mode: 'dry-run',
      cutoff: '2026-08-06T09:00:00.000Z',
      scanned: 5,
      plans: [],
      registrationsUpdated: 0,
      auditLogsWritten: 0,
      errors: [],
    });
    expect(out).toContain('Mode: dry-run');
    expect(out).toContain(
      'Cutoff (registrations created before this are eligible): 2026-08-06T09:00:00.000Z',
    );
    expect(out).toContain('Registrations scanned: 5');
    expect(out).not.toContain('Registrations updated');
  });

  it('renders apply summary with updated and audit counters', async () => {
    const { formatRegistrationFeeBackfillResult } = await import('../registration-fee-backfill');
    const out = formatRegistrationFeeBackfillResult({
      mode: 'apply',
      cutoff: '2026-08-06T09:00:00.000Z',
      scanned: 3,
      plans: [],
      registrationsUpdated: 2,
      auditLogsWritten: 3,
      errors: [],
    });
    expect(out).toContain('Mode: apply');
    expect(out).toContain('Registrations updated (amountCents -> 0): 2');
    expect(out).toContain('Audit entries written: 3');
  });

  it('renders error lines when present', async () => {
    const { formatRegistrationFeeBackfillResult } = await import('../registration-fee-backfill');
    const out = formatRegistrationFeeBackfillResult({
      mode: 'apply',
      cutoff: '2026-08-06T09:00:00.000Z',
      scanned: 1,
      plans: [],
      registrationsUpdated: 0,
      auditLogsWritten: 0,
      errors: ['first failure', 'second failure'],
    });
    expect(out).toContain('Errors:');
    expect(out).toContain('- first failure');
    expect(out).toContain('- second failure');
  });
});
