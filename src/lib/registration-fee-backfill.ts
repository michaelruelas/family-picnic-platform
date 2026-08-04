import type { Prisma, PrismaClient } from '~/lib/generated/client';

const REGISTRATION_FEE_BACKFILL_ACTION = 'REGISTRATION_FEE_BACKFILL';

type RegistrationRow = Prisma.RegistrationGetPayload<{
  select: {
    id: true;
    eventId: true;
    userId: true;
    amountCents: true;
    currency: true;
    status: true;
  };
}>;

/**
 * Client surface the backfill needs. Pick this narrow so the
 * library is testable against an in-memory mock harness (mirrors
 * the `RsvpBackfillClient` pattern).
 */
export type RegistrationFeeBackfillClient = Pick<
  PrismaClient,
  'registration' | 'adminAuditLog' | '$transaction'
>;

export interface RegistrationFeeBackfillOptions {
  apply: boolean;
}

export interface RegistrationFeeBackfillPlan {
  registrationId: string;
  eventId: string;
  userId: string;
  currentAmountCents: number;
}

export interface RegistrationFeeBackfillResult {
  mode: 'dry-run' | 'apply';
  scanned: number;
  plans: RegistrationFeeBackfillPlan[];
  registrationsUpdated: number;
  auditLogsWritten: number;
  errors: string[];
}

/**
 * Finds every existing Registration row and produces a plan that
 * pins `amountCents` to 0. The plan is idempotent: a row whose
 * `amountCents` is already 0 is included in the plan (so the audit
 * trail still records the backfill run for that registration) but
 * the apply step writes no change for it.
 *
 * Per ticket FPP-14 / AC: "One-time script sets `paid=0` and
 * `fee_total=0` for all existing households. Idempotent. Audit
 * entry written for each." FPP-47 already shipped
 * `Registration.amountCents` and `Registration.status` (default
 * PENDING), so "fee_total=0" maps to `amountCents = 0` and
 * "paid=0" maps to leaving `status` alone (it defaults to PENDING
 * anyway, and any PAID registrations must NOT be zeroed — those
 * reflect real charges that already settled).
 */
export async function findRegistrationFeeBackfillPlans(
  client: RegistrationFeeBackfillClient,
): Promise<RegistrationFeeBackfillPlan[]> {
  const rows: RegistrationRow[] = await client.registration.findMany({
    select: {
      id: true,
      eventId: true,
      userId: true,
      amountCents: true,
      currency: true,
      status: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  return rows.map((r) => ({
    registrationId: r.id,
    eventId: r.eventId,
    userId: r.userId,
    currentAmountCents: r.amountCents,
  }));
}

/**
 * Runs the backfill in dry-run or apply mode. In apply mode every
 * existing Registration gets `amountCents = 0` (no charge applied
 * retroactively, per ticket AC) and a per-row audit entry. Already-
 * zero rows are still audited so the run leaves a complete trail.
 *
 * Per-row errors are collected but never abort the whole run; the
 * caller surfaces the `errors` array and exits non-zero when it
 * is non-empty (mirrors `mergeDuplicateRsvps` semantics).
 */
export async function backfillRegistrationFees(
  client: RegistrationFeeBackfillClient,
  options: RegistrationFeeBackfillOptions,
): Promise<RegistrationFeeBackfillResult> {
  const result: RegistrationFeeBackfillResult = {
    mode: options.apply ? 'apply' : 'dry-run',
    scanned: 0,
    plans: [],
    registrationsUpdated: 0,
    auditLogsWritten: 0,
    errors: [],
  };

  let plans: RegistrationFeeBackfillPlan[];
  try {
    plans = await findRegistrationFeeBackfillPlans(client);
  } catch (error) {
    result.errors.push(
      `Failed to scan registrations: ${error instanceof Error ? error.message : String(error)}`,
    );
    return result;
  }

  result.scanned = plans.length;
  result.plans = plans;

  if (!options.apply || plans.length === 0) {
    return result;
  }

  for (const plan of plans) {
    try {
      const delta = await backfillSingleRegistration(client, plan);
      result.registrationsUpdated += delta.registrationsUpdated;
      result.auditLogsWritten += delta.auditLogsWritten;
    } catch (error) {
      result.errors.push(
        `Failed to backfill registration=${plan.registrationId} event=${plan.eventId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  return result;
}

interface RegistrationFeeBackfillDelta {
  registrationsUpdated: number;
  auditLogsWritten: number;
}

async function backfillSingleRegistration(
  client: RegistrationFeeBackfillClient,
  plan: RegistrationFeeBackfillPlan,
): Promise<RegistrationFeeBackfillDelta> {
  return client.$transaction(async (tx) => {
    const row = await tx.registration.findUnique({
      where: { id: plan.registrationId },
      select: { id: true, amountCents: true, status: true },
    });
    if (!row) {
      throw new Error(`Registration ${plan.registrationId} not found`);
    }

    let registrationsUpdated = 0;
    // Only zero rows that haven't been paid yet. A PAID / REFUNDED
    // / FORFEITED / CANCELLED registration reflects real money
    // movement and must not be rewritten.
    const isSettled =
      row.status === 'PAID' ||
      row.status === 'REFUNDED' ||
      row.status === 'FORFEITED' ||
      row.status === 'CANCELLED';

    if (!isSettled && row.amountCents !== 0) {
      await tx.registration.update({
        where: { id: row.id },
        data: { amountCents: 0 },
      });
      registrationsUpdated += 1;
    }

    await tx.adminAuditLog.create({
      data: {
        userId: plan.userId,
        eventId: plan.eventId,
        action: REGISTRATION_FEE_BACKFILL_ACTION,
        oldValue: {
          amountCents: row.amountCents,
          status: row.status,
        },
        newValue: {
          amountCents: 0,
          status: row.status,
          source: 'backfill-registration-fees',
          changed: !isSettled && row.amountCents !== 0,
          alreadySettled: isSettled,
        },
      },
    });

    return { registrationsUpdated, auditLogsWritten: 1 };
  });
}

export function formatRegistrationFeeBackfillResult(result: RegistrationFeeBackfillResult): string {
  const lines: string[] = [];
  lines.push(`Mode: ${result.mode}`);
  lines.push(`Registrations scanned: ${result.scanned}`);
  lines.push(`Plans produced: ${result.plans.length}`);
  if (result.mode === 'apply') {
    lines.push(`Registrations updated (amountCents -> 0): ${result.registrationsUpdated}`);
    lines.push(`Audit entries written: ${result.auditLogsWritten}`);
  }
  if (result.errors.length > 0) {
    lines.push('Errors:');
    for (const error of result.errors) {
      lines.push(`  - ${error}`);
    }
  }
  return lines.join('\n');
}
