import type { Prisma, PrismaClient } from '~/lib/generated/client';

const RSVP_PLAN_SELECT = {
  id: true,
  eventId: true,
  userId: true,
  status: true,
  headcount: true,
  respondedAt: true,
  modifiedAt: true,
  waitlistPosition: true,
} as const;

type RsvpRow = Prisma.RSVPGetPayload<{ select: typeof RSVP_PLAN_SELECT }>;

export type RsvpBackfillClient = Pick<
  PrismaClient,
  'rSVP' | 'potluckSignup' | 'adminAuditLog' | '$transaction'
>;

export interface RsvpBackfillOptions {
  apply: boolean;
}

export interface RsvpMergePlan {
  key: { eventId: string; userId: string };
  winnerId: string;
  loserIds: string[];
}

export interface RsvpBackfillResult {
  mode: 'dry-run' | 'apply';
  groupsFound: number;
  rsvpsDeleted: number;
  potluckSignupsReassigned: number;
  auditLogsWritten: number;
  plans: RsvpMergePlan[];
  errors: string[];
}

export interface RsvpBackfillDelta {
  rsvpsDeleted: number;
  potluckSignupsReassigned: number;
  auditLogsWritten: number;
}

const RSVP_MERGE_ACTION = 'RSVP_MERGE';

function compareRsvpForWinner(a: RsvpRow, b: RsvpRow): number {
  if (a.modifiedAt.getTime() !== b.modifiedAt.getTime()) {
    return b.modifiedAt.getTime() - a.modifiedAt.getTime();
  }
  const aResponded = a.respondedAt?.getTime() ?? 0;
  const bResponded = b.respondedAt?.getTime() ?? 0;
  if (aResponded !== bResponded) {
    return bResponded - aResponded;
  }
  return b.id.localeCompare(a.id);
}

export async function findDuplicateRsvpPlans(client: RsvpBackfillClient): Promise<RsvpMergePlan[]> {
  const grouped = await client.rSVP.groupBy({
    by: ['eventId', 'userId'],
    _count: { _all: true },
    // Prisma's groupBy `having` only exposes per-column aggregates. `id` is the
    // primary key, so the count of distinct id values per group equals the
    // row count per group, which is what we want for "group with > 1 row".
    having: { id: { _count: { gt: 1 } } },
  });

  if (grouped.length === 0) {
    return [];
  }

  const plans: RsvpMergePlan[] = [];
  for (const group of grouped) {
    const rsvps = await client.rSVP.findMany({
      where: { eventId: group.eventId, userId: group.userId },
      select: RSVP_PLAN_SELECT,
    });

    if (rsvps.length < 2) {
      continue;
    }

    const sorted = [...rsvps].sort(compareRsvpForWinner);
    const winner = sorted[0];
    if (!winner) {
      continue;
    }
    const losers = sorted.slice(1);
    plans.push({
      key: { eventId: group.eventId, userId: group.userId },
      winnerId: winner.id,
      loserIds: losers.map((l) => l.id),
    });
  }

  return plans;
}

export async function mergeDuplicateRsvps(
  client: RsvpBackfillClient,
  options: RsvpBackfillOptions,
): Promise<RsvpBackfillResult> {
  const result: RsvpBackfillResult = {
    mode: options.apply ? 'apply' : 'dry-run',
    groupsFound: 0,
    rsvpsDeleted: 0,
    potluckSignupsReassigned: 0,
    auditLogsWritten: 0,
    plans: [],
    errors: [],
  };

  let plans: RsvpMergePlan[];
  try {
    plans = await findDuplicateRsvpPlans(client);
  } catch (error) {
    result.errors.push(
      `Failed to scan for duplicate RSVPs: ${error instanceof Error ? error.message : String(error)}`,
    );
    return result;
  }

  result.groupsFound = plans.length;
  result.plans = plans;

  if (!options.apply || plans.length === 0) {
    return result;
  }

  for (const plan of plans) {
    try {
      const delta = await mergeSingleGroup(client, plan);
      result.rsvpsDeleted += delta.rsvpsDeleted;
      result.potluckSignupsReassigned += delta.potluckSignupsReassigned;
      result.auditLogsWritten += delta.auditLogsWritten;
    } catch (error) {
      result.errors.push(
        `Failed to merge RSVPs for event=${plan.key.eventId} user=${plan.key.userId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  return result;
}

async function mergeSingleGroup(
  client: RsvpBackfillClient,
  plan: RsvpMergePlan,
): Promise<RsvpBackfillDelta> {
  // Per-group transaction: groups are independent, so we accept partial
  // progress over a global abort. mergeDuplicateRsvps surfaces the error
  // and exits non-zero so the operator can re-run for the remaining groups.
  return client.$transaction(async (tx) => {
    const winner = await tx.rSVP.findUnique({ where: { id: plan.winnerId } });
    if (!winner) {
      throw new Error(`Winner RSVP ${plan.winnerId} not found`);
    }

    let rsvpsDeleted = 0;
    let potluckSignupsReassigned = 0;
    let auditLogsWritten = 0;

    for (const loserId of plan.loserIds) {
      const loser = await tx.rSVP.findUnique({ where: { id: loserId } });
      // A missing loser means the plan is stale (row was deleted between the
      // scan and the merge). Throw rather than silently skipping so the audit
      // count and deletion count can never diverge from the plan.
      if (!loser) {
        throw new Error(`Loser RSVP ${loserId} not found`);
      }

      const reassignResult = await tx.potluckSignup.updateMany({
        where: { rsvpId: loser.id },
        data: { rsvpId: winner.id },
      });
      potluckSignupsReassigned += reassignResult.count;

      await tx.adminAuditLog.create({
        data: {
          userId: loser.userId,
          eventId: loser.eventId,
          action: RSVP_MERGE_ACTION,
          oldValue: {
            deletedRsvpId: loser.id,
            status: loser.status,
            headcount: loser.headcount,
            respondedAt: loser.respondedAt,
            waitlistPosition: loser.waitlistPosition,
          },
          newValue: {
            keptRsvpId: winner.id,
            status: winner.status,
            headcount: winner.headcount,
            respondedAt: winner.respondedAt,
            waitlistPosition: winner.waitlistPosition,
          },
        },
      });
      auditLogsWritten += 1;

      await tx.rSVP.delete({ where: { id: loser.id } });
      rsvpsDeleted += 1;
    }

    return { rsvpsDeleted, potluckSignupsReassigned, auditLogsWritten };
  });
}

export function formatRsvpBackfillResult(result: RsvpBackfillResult): string {
  const lines: string[] = [];
  lines.push(`Mode: ${result.mode}`);
  lines.push(`Duplicate (eventId, userId) groups found: ${result.groupsFound}`);
  if (result.plans.length > 0) {
    lines.push('Plan:');
    for (const plan of result.plans) {
      lines.push(
        `  event=${plan.key.eventId} user=${plan.key.userId} keep=${plan.winnerId} delete=[${plan.loserIds.join(', ')}]`,
      );
    }
  }
  if (result.mode === 'apply') {
    lines.push(`RSVPs deleted: ${result.rsvpsDeleted}`);
    lines.push(`Potluck signups reassigned: ${result.potluckSignupsReassigned}`);
    lines.push(`RSVP_MERGE audit entries written: ${result.auditLogsWritten}`);
  }
  if (result.errors.length > 0) {
    lines.push('Errors:');
    for (const error of result.errors) {
      lines.push(`  - ${error}`);
    }
  }
  return lines.join('\n');
}
