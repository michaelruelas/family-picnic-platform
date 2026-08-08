import type { Prisma, PrismaClient } from '~/lib/generated/client';

// FPP-50 / FPP-18: replay historical domain events into the AuditLog
// table so the audit log page can answer "who signed up, when, and what
// happened" for data that existed before the hooks shipped. The replay
// is best-effort: existing tables only carry create/update timestamps
// and a single actor; we never invent missing fields.

type RsvpRow = Prisma.RSVPGetPayload<{
  select: {
    id: true;
    eventId: true;
    userId: true;
    status: true;
    headcount: true;
    respondedAt: true;
    modifiedAt: true;
  };
}>;

type PotluckSignupRow = Prisma.PotluckSignupGetPayload<{
  select: {
    id: true;
    slotId: true;
    rsvpId: true;
    dishName: true;
    servings: true;
    claimedAt: true;
    rsvp: { select: { eventId: true; userId: true } };
  };
}>;

type EventAdminRow = Prisma.EventAdminGetPayload<{
  select: {
    eventId: true;
    userId: true;
    role: true;
    createdAt: true;
  };
}>;

/**
 * Client surface the backfill needs. Narrow to the models it touches
 * so tests can swap in an in-memory harness without rebuilding the
 * full Prisma client.
 */
export type AuditLogBackfillClient = Pick<
  PrismaClient,
  'rSVP' | 'potluckSignup' | 'eventAdmin' | 'auditLog'
>;

export interface AuditLogBackfillOptions {
  apply: boolean;
}

export interface AuditLogBackfillPlan {
  action: string;
  subjectType: 'RSVP' | 'PotluckSignup' | 'EventAdmin';
  subjectId: string;
  actorId: string | null;
  occurredAt: Date;
  payload: Record<string, unknown>;
}

export interface AuditLogBackfillResult {
  mode: 'dry-run' | 'apply';
  scanned: { rsvps: number; potluckSignups: number; eventAdmins: number };
  plans: AuditLogBackfillPlan[];
  entriesWritten: number;
  entriesSkipped: number;
  errors: string[];
}

const BACKFILL_MARKER = 'backfill-audit-log';
const BACKFILL_BATCH = 500;

function actorId(value: string | null | undefined): string | null {
  return value ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Scans the source tables and produces a plan: one entry per historical
 * domain event we can reconstruct from the existing rows. The plan is
 * deterministic and idempotent — re-running the script produces the
 * same plan and the apply step dedupes against previously-written
 * entries.
 */
export async function findAuditLogBackfillPlans(
  client: AuditLogBackfillClient,
): Promise<AuditLogBackfillPlan[]> {
  const [rsvps, signups, admins] = await Promise.all([
    client.rSVP.findMany({
      select: {
        id: true,
        eventId: true,
        userId: true,
        status: true,
        headcount: true,
        respondedAt: true,
        modifiedAt: true,
      },
      orderBy: { modifiedAt: 'asc' },
    }),
    client.potluckSignup.findMany({
      select: {
        id: true,
        slotId: true,
        rsvpId: true,
        dishName: true,
        servings: true,
        claimedAt: true,
        rsvp: { select: { eventId: true, userId: true } },
      },
      orderBy: { claimedAt: 'asc' },
    }),
    client.eventAdmin.findMany({
      select: {
        eventId: true,
        userId: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  return [
    ...rsvps.map((rsvp) => buildRsvpPlan(rsvp)),
    ...signups.map((signup) => buildPotluckPlan(signup)),
    ...admins.map((admin) => buildEventAdminPlan(admin)),
  ].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
}

function buildRsvpPlan(row: RsvpRow): AuditLogBackfillPlan {
  // RSVP rows do not carry a dedicated `createdAt`. `respondedAt` is
  // stamped on confirm/decline; `modifiedAt` is bumped on every update.
  // We surface the first response as the event time (respondedAt when
  // present, otherwise modifiedAt so a freshly-inserted INVITED row is
  // not lost).
  const occurredAt = row.respondedAt ?? row.modifiedAt;
  return {
    action: 'rsvp.signup',
    subjectType: 'RSVP',
    subjectId: row.id,
    actorId: actorId(row.userId),
    occurredAt,
    payload: {
      source: BACKFILL_MARKER,
      eventId: row.eventId,
      status: row.status,
      headcount: row.headcount,
      modifiedAt: row.modifiedAt.toISOString(),
      respondedAt: row.respondedAt?.toISOString() ?? null,
    },
  };
}

function buildPotluckPlan(row: PotluckSignupRow): AuditLogBackfillPlan {
  return {
    action: 'potluck.signup.create',
    subjectType: 'PotluckSignup',
    subjectId: row.id,
    actorId: actorId(row.rsvp.userId),
    occurredAt: row.claimedAt,
    payload: {
      source: BACKFILL_MARKER,
      slotId: row.slotId,
      eventId: row.rsvp.eventId,
      rsvpId: row.rsvpId,
      dishName: row.dishName,
      servings: row.servings,
    },
  };
}

function buildEventAdminPlan(row: EventAdminRow): AuditLogBackfillPlan {
  return {
    action: 'event.admin.add',
    subjectType: 'EventAdmin',
    subjectId: `${row.eventId}:${row.userId}`,
    actorId: actorId(row.userId),
    occurredAt: row.createdAt,
    payload: {
      source: BACKFILL_MARKER,
      eventId: row.eventId,
      userId: row.userId,
      role: row.role,
    },
  };
}

/**
 * Returns the subset of plans not yet present in the AuditLog table.
 * Idempotency key: `(subjectType, subjectId, action)` where the
 * payload carries the BACKFILL_MARKER. Two backfilled entries with the
 * same triple are treated as duplicates because the source rows are
 * append-only at the DB level.
 */
export async function filterNewPlans(
  client: AuditLogBackfillClient,
  plans: AuditLogBackfillPlan[],
): Promise<{ newPlans: AuditLogBackfillPlan[]; skipped: number }> {
  if (plans.length === 0) return { newPlans: [], skipped: 0 };

  // Group plans by subject so we can issue a single findMany per
  // subjectType. Subject + action together are unique because the
  // source tables are append-only.
  const triples = plans.map((plan) => ({
    subjectType: plan.subjectType,
    subjectId: plan.subjectId,
    action: plan.action,
  }));

  const existing = await client.auditLog.findMany({
    where: {
      OR: triples.map((t) => ({
        subjectType: t.subjectType,
        subjectId: t.subjectId,
        action: t.action,
        payload: { path: ['source'], equals: BACKFILL_MARKER },
      })),
    },
    select: { subjectType: true, subjectId: true, action: true },
  });

  const seen = new Set(
    existing.map((row) => `${row.subjectType}::${row.subjectId}::${row.action}`),
  );

  const newPlans: AuditLogBackfillPlan[] = [];
  for (const plan of plans) {
    const key = `${plan.subjectType}::${plan.subjectId}::${plan.action}`;
    if (!seen.has(key)) {
      newPlans.push(plan);
      seen.add(key);
    }
  }

  return { newPlans, skipped: plans.length - newPlans.length };
}

export async function backfillAuditLog(
  client: AuditLogBackfillClient,
  options: AuditLogBackfillOptions,
): Promise<AuditLogBackfillResult> {
  const result: AuditLogBackfillResult = {
    mode: options.apply ? 'apply' : 'dry-run',
    scanned: { rsvps: 0, potluckSignups: 0, eventAdmins: 0 },
    plans: [],
    entriesWritten: 0,
    entriesSkipped: 0,
    errors: [],
  };

  let plans: AuditLogBackfillPlan[];
  try {
    plans = await findAuditLogBackfillPlans(client);
  } catch (error) {
    result.errors.push(
      `Failed to scan source tables: ${error instanceof Error ? error.message : String(error)}`,
    );
    return result;
  }

  result.scanned = {
    rsvps: plans.filter((p) => p.subjectType === 'RSVP').length,
    potluckSignups: plans.filter((p) => p.subjectType === 'PotluckSignup').length,
    eventAdmins: plans.filter((p) => p.subjectType === 'EventAdmin').length,
  };

  if (!options.apply) {
    result.plans = plans;
    return result;
  }

  let deduped: { newPlans: AuditLogBackfillPlan[]; skipped: number };
  try {
    deduped = await filterNewPlans(client, plans);
  } catch (error) {
    result.errors.push(
      `Failed to dedupe against existing audit log: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return result;
  }
  result.plans = deduped.newPlans;
  result.entriesSkipped = deduped.skipped;

  // Insert in batches so the apply step stays bounded even for large
  // historical datasets.
  for (let i = 0; i < deduped.newPlans.length; i += BACKFILL_BATCH) {
    const batch = deduped.newPlans.slice(i, i + BACKFILL_BATCH);
    try {
      const count = await writeAuditLogBatch(client, batch);
      result.entriesWritten += count;
    } catch (error) {
      result.errors.push(
        `Failed to write batch ${i}-${i + batch.length}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  return result;
}

async function writeAuditLogBatch(
  client: AuditLogBackfillClient,
  batch: AuditLogBackfillPlan[],
): Promise<number> {
  // AuditLog.createMany is the cheapest path. The append-only trigger
  // permits INSERTs without restriction.
  const res = await client.auditLog.createMany({
    data: batch.map((plan) => ({
      actorId: plan.actorId,
      action: plan.action,
      subjectType: plan.subjectType,
      subjectId: plan.subjectId,
      payload: plan.payload as Prisma.InputJsonValue,
      occurredAt: plan.occurredAt,
    })),
  });
  return res.count;
}

export function formatAuditLogBackfillResult(result: AuditLogBackfillResult): string {
  const lines: string[] = [];
  lines.push(`Mode: ${result.mode}`);
  lines.push(`RSVP rows scanned: ${result.scanned.rsvps}`);
  lines.push(`PotluckSignup rows scanned: ${result.scanned.potluckSignups}`);
  lines.push(`EventAdmin rows scanned: ${result.scanned.eventAdmins}`);
  lines.push(`Plans produced: ${result.plans.length}`);
  if (result.mode === 'apply') {
    lines.push(`Audit entries written: ${result.entriesWritten}`);
    lines.push(`Audit entries skipped (already backfilled): ${result.entriesSkipped}`);
  } else {
    lines.push('Re-run with --apply to write the AuditLog entries.');
  }
  if (result.errors.length > 0) {
    lines.push('Errors:');
    for (const error of result.errors) {
      lines.push(`  - ${error}`);
    }
  }
  return lines.join('\n');
}

// Exposed for tests; the marker constant lets tests assert the
// payload carries the backfill provenance.
export const __test__ = { BACKFILL_MARKER, isRecord };
