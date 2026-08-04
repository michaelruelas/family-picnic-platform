import type { Prisma, PrismaClient } from '~/lib/generated/client';
import { ChargeStatus, RegistrationStatus } from '~/lib/generated/enums';
import { calculateFeeFromEvent, type FeeAttendee } from './fee';

/**
 * Prisma transaction handle. Mirrors the type used by
 * `~/server/rsvp-attendance` so the helper composes cleanly inside
 * any caller `$transaction` (tRPC procedure or REST route).
 */
type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

/**
 * Subset of the Event row the fee calc and the helper need. Pass
 * the minimum select so callers do not need to round-trip a full
 * Event.
 */
export interface SyncRegistrationFeeEventConfig {
  registrationFeeCents: number | null;
  registrationFeeMinAge: number;
  currency: string;
}

export interface SyncRegistrationFeeArgs {
  eventId: string;
  userId: string;
  householdId: string;
  event: SyncRegistrationFeeEventConfig;
  /**
   * The full attendance snapshot. The caller MUST pass the post-
   * persist rows so omitted members still count toward the fee.
   * `resolveAndPersistAttendances` returns only the rows from the
   * input; callers should refetch via
   * `tx.rSVP.findUnique({ include: { memberAttendances } })` after
   * persistence to get the full snapshot.
   */
  attendanceRows: FeeAttendee[];
}

export interface SyncRegistrationFeeResult {
  amountCents: number;
  currency: string;
  status: RegistrationStatus;
  previousAmountCents: number | null;
  changed: boolean;
  chargesCanceled: number;
  settled: boolean;
}

/**
 * Active charge statuses that can still be reused by the checkout
 * flow. When the fee changes we cancel any of these so the next
 * payment attempt creates a fresh charge at the new amount.
 */
const ACTIVE_CHARGE_STATUSES: ChargeStatus[] = [
  ChargeStatus.REQUIRES_PAYMENT_METHOD,
  ChargeStatus.REQUIRES_CONFIRMATION,
  ChargeStatus.REQUIRES_ACTION,
  ChargeStatus.PROCESSING,
  ChargeStatus.REQUIRES_CAPTURE,
];

/**
 * Upserts the Registration row for `(eventId, userId)` with the fee
 * computed from the event config and the full attendance snapshot.
 *
 * Behavior:
 *
 * - Computes the fee via `calculateFeeFromEvent`. The fee is the
 *   product of (count of YES attendees whose age is known and at or
 *   above `registrationFeeMinAge`) and `registrationFeeCents`.
 * - Creates the Registration row if none exists, with status
 *   `PENDING`. Updates the existing row otherwise. Carries
 *   `householdId` forward so denormalization stays current.
 * - Always writes the calculated fee. Fee decreases are reflected
 *   immediately. Free events write `amountCents = 0` (which is the
 *   current behavior anyway because the calculator returns 0).
 * - When the amount changes, cancels any active `Charge` rows for
 *   this Registration. The next checkout attempt creates a fresh
 *   charge at the new amount, so we never reuse a Stripe session
 *   that was priced for the old fee.
 * - Never writes to a Registration in a settled status
 *   (`PAID`, `REFUNDED`, `FORFEITED`, `CANCELLED`). The fee at
 *   charge time is the historical record and stays immutable.
 *
 * Returns a result that callers can surface in audit logs or UI.
 */
export async function syncRegistrationFee(
  tx: Tx,
  args: SyncRegistrationFeeArgs,
): Promise<SyncRegistrationFeeResult> {
  const breakdown = calculateFeeFromEvent(args.attendanceRows, {
    registrationFeeCents: args.event.registrationFeeCents,
    registrationFeeMinAge: args.event.registrationFeeMinAge,
  });
  const targetAmountCents = breakdown.amountCents;

  const existing = await tx.registration.findUnique({
    where: { eventId_userId: { eventId: args.eventId, userId: args.userId } },
    select: {
      id: true,
      status: true,
      amountCents: true,
      currency: true,
    },
  });

  // Defensive: when the caller's mock returns `undefined` instead of
  // `null` (vitest pattern), treat it the same as a missing row.
  const settled =
    existing != null &&
    (existing.status === RegistrationStatus.PAID ||
      existing.status === RegistrationStatus.REFUNDED ||
      existing.status === RegistrationStatus.FORFEITED ||
      existing.status === RegistrationStatus.CANCELLED);

  if (settled) {
    return {
      amountCents: existing?.amountCents ?? targetAmountCents,
      currency: existing?.currency ?? args.event.currency,
      status: existing!.status,
      previousAmountCents: existing?.amountCents ?? null,
      changed: false,
      chargesCanceled: 0,
      settled: true,
    };
  }

  const registrationId =
    existing?.id ??
    (
      await tx.registration.create({
        data: {
          eventId: args.eventId,
          userId: args.userId,
          householdId: args.householdId,
          amountCents: targetAmountCents,
          currency: args.event.currency,
          status: RegistrationStatus.PENDING,
        },
        select: { id: true },
      })
    ).id;

  const previousAmountCents = existing?.amountCents ?? null;
  const amountChanged = previousAmountCents === null || previousAmountCents !== targetAmountCents;

  if (amountChanged) {
    await tx.registration.update({
      where: { id: registrationId },
      data: {
        amountCents: targetAmountCents,
        householdId: args.householdId,
        // Currency stays the same as the original row to preserve any
        // partial-charge state. New rows pick it up from the event.
        ...(existing ? {} : { currency: args.event.currency }),
      },
    });

    // Cancel any active charges so the next checkout attempts use the
    // new amount. Idempotent: a re-run with no amount change skips
    // this step. Status guards keep already-settled Charges (SUCCEEDED,
    // FAILED, CANCELED) intact.
    if (existing) {
      await tx.charge.updateMany({
        where: {
          registrationId,
          status: { in: ACTIVE_CHARGE_STATUSES },
        },
        data: { status: ChargeStatus.CANCELED },
      });
    }
  }

  return {
    amountCents: targetAmountCents,
    currency: existing?.currency ?? args.event.currency,
    status: existing?.status ?? RegistrationStatus.PENDING,
    previousAmountCents,
    changed: amountChanged,
    // We only know the cancel count after the updateMany returns. The
    // caller can re-query if it needs the exact figure; we expose the
    // boolean via `changed` and let callers log from the audit write.
    chargesCanceled: amountChanged ? -1 : 0,
    settled: false,
  };
}

/**
 * Convenience helper for callers that already have the resolved
 * attendance rows from `~/server/rsvp-attendance` and want to map
 * them into the `FeeAttendee` shape in one call.
 */
export function toFeeAttendees(
  rows: Array<{
    attending: Prisma.RsvpMemberAttendanceGetPayload<{}>['attending'];
    memberAge: number | null | undefined;
  }>,
): FeeAttendee[] {
  return rows.map((r) => ({
    attending: r.attending,
    memberAge: r.memberAge ?? null,
  }));
}
