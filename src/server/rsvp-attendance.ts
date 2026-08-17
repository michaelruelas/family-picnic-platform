import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { prisma } from '~/lib/prisma';
import { RsvpAttending } from '~/lib/generated/enums';
import { ATTENDEE_NAME_MAX } from '~/lib/schemas/attendee-name';
import { rsvpMemberAttendanceInputSchema } from '~/lib/schemas/rsvp-member-attendance';

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export type MemberAttendanceInput = z.infer<typeof rsvpMemberAttendanceInputSchema>;

/**
 * Client input with `undefined` collapsed to `null`, produced by
 * `dedupeAndValidate`. Downstream code reads only this shape, so
 * `householdMemberId` and `memberAge` are never `undefined`.
 */
interface NormalizedMemberAttendanceInput {
  householdMemberId: string | null;
  memberName: string;
  memberAge: number | null;
  attending: RsvpAttending;
}

/**
 * The validated, server-trusted shape that downstream code (audit
 * log, headcount derivation, attendance diffs) consumes. Names and
 * ages are always sourced from the database; the client-supplied
 * `memberName` and `memberAge` are kept only for the ad-hoc guest
 * case where there is no roster member to look up.
 */
export interface ResolvedAttendanceRow {
  /** When `null`, the row is an ad-hoc guest that is not tied to a HouseholdMember. */
  householdMemberId: string | null;
  memberName: string;
  memberAge: number | null;
  attending: RsvpAttending;
  /** Marks a row that was carried over from history (member soft-deleted). */
  isHistorical: boolean;
}

export interface PersistAttendanceInput {
  rsvpId: string;
  householdId: string;
  attendances: MemberAttendanceInput[];
}

/**
 * Reject obviously malformed client input before any database call.
 * The schema is already enforced by Zod, but duplicates are caught
 * here because the database unique index is a per-row guard, not a
 * payload-shape guard.
 *
 * Duplicate detection keys on `householdMemberId` only. Ad-hoc guests
 * (id = null) intentionally bypass the check so one RSVP can carry
 * several guests in the same payload.
 */
function dedupeAndValidate(
  attendances: MemberAttendanceInput[],
): NormalizedMemberAttendanceInput[] {
  if (attendances.length === 0) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Mark attendance for at least one member',
    });
  }
  const seenIds = new Set<string>();
  const out: NormalizedMemberAttendanceInput[] = [];
  for (const att of attendances) {
    if (att.householdMemberId !== null && att.householdMemberId !== undefined) {
      if (seenIds.has(att.householdMemberId)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Duplicate attendance entry for the same member',
        });
      }
      if (att.householdMemberId.length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'householdMemberId must be a non-empty string or null',
        });
      }
      seenIds.add(att.householdMemberId);
    }
    out.push({
      householdMemberId: att.householdMemberId ?? null,
      memberName: att.memberName,
      memberAge: att.memberAge ?? null,
      attending: att.attending,
    });
  }
  return out;
}

/**
 * Server-side resolver: looks up the household roster, replaces any
 * client-supplied name/age for known members with the database row,
 * and validates that every `householdMemberId` belongs to the same
 * household as the RSVP. Ad-hoc guests (id = null) keep the
 * client-supplied name/age.
 *
 * Returns the list of rows that the caller may persist, plus the
 * list of historical rows (member soft-deleted between RSVP write
 * and the current edit) that the caller must preserve.
 */
export async function resolveAttendancesForHousehold(
  tx: Tx,
  householdId: string,
  attendances: MemberAttendanceInput[],
): Promise<{
  rows: Array<Omit<ResolvedAttendanceRow, 'isHistorical'>>;
}> {
  const dedup = dedupeAndValidate(attendances);
  const memberIds = dedup.map((a) => a.householdMemberId).filter((k): k is string => k !== null);

  const members =
    memberIds.length > 0
      ? await tx.householdMember.findMany({
          where: { id: { in: memberIds }, householdId },
          select: { id: true, name: true, age: true, deletedAt: true },
        })
      : [];
  const memberById = new Map(members.map((m) => [m.id, m]));

  const rows: Array<Omit<ResolvedAttendanceRow, 'isHistorical'>> = [];
  for (const att of dedup) {
    if (att.householdMemberId === null) {
      // Ad-hoc guest. The client is the only source of truth for the
      // name and age. We still trim and clamp so a malicious client
      // cannot write arbitrary text into the snapshot.
      rows.push({
        householdMemberId: null,
        memberName: att.memberName.trim().slice(0, ATTENDEE_NAME_MAX),
        memberAge:
          att.memberAge !== null && att.memberAge !== undefined
            ? Math.max(0, Math.min(120, att.memberAge))
            : null,
        attending: att.attending,
      });
      continue;
    }

    const memberId = att.householdMemberId;
    const member = memberById.get(memberId);
    if (!member) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'householdMemberId does not belong to this household',
      });
    }
    if (member.deletedAt !== null) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Cannot mark attendance for a removed household member',
      });
    }
    rows.push({
      householdMemberId: member.id,
      memberName: member.name,
      memberAge: member.age,
      attending: att.attending,
    });
  }
  return { rows };
}

/**
 * Builds the household roster as `attending: NO` rows. Used by the
 * decline path so a first-time decline still summarizes every
 * household member on the confirmation page.
 */
export async function buildRosterAsNo(
  tx: Tx,
  householdId: string,
): Promise<Array<Omit<ResolvedAttendanceRow, 'isHistorical'>>> {
  const members = await tx.householdMember.findMany({
    where: { householdId, deletedAt: null },
    select: { id: true, name: true, age: true },
    orderBy: { createdAt: 'asc' },
  });
  return members.map((m) => ({
    householdMemberId: m.id,
    memberName: m.name,
    memberAge: m.age,
    attending: RsvpAttending.NO,
  }));
}

interface ReplaceOptions {
  /**
   * When the caller wants to replace the entire roster (e.g. on a
   * fresh confirm), pass `replace: true`. When the caller wants to
   * flip a subset while preserving historical rows that the form
   * did not include, pass `replace: false` (default).
   */
  replace?: boolean;
}

/**
 * Persist the resolved attendance rows. The behaviour is:
 *
 * - Every row in `rows` is upserted by `(rsvpId, householdMemberId)`
 *   so concurrent edits of the same member settle on the latest
 *   value.
 * - Ad-hoc rows (id = null) are matched by memberName + memberAge so
 *   editing a guest is a true update, not a delete-then-insert.
 * - If `replace` is true, the entire set is replaced; otherwise,
 *   historical rows (rows where the underlying HouseholdMember has
 *   since been soft-deleted) are preserved so a member delete does
 *   not erase attendance history on the next RSVP edit.
 */
export async function persistResolvedAttendances(
  tx: Tx,
  rsvpId: string,
  rows: Array<Omit<ResolvedAttendanceRow, 'isHistorical'>>,
  options: ReplaceOptions = {},
): Promise<void> {
  if (rows.length === 0 && !options.replace) return;
  if (options.replace) {
    await tx.rsvpMemberAttendance.deleteMany({ where: { rsvpId } });
  }
  for (const row of rows) {
    // Match ad-hoc rows by (rsvpId, name, age) so a re-submit that
    // still contains the same guest updates the existing row
    // instead of creating a duplicate.
    if (row.householdMemberId === null) {
      const existing = await tx.rsvpMemberAttendance.findFirst({
        where: {
          rsvpId,
          householdMemberId: null,
          memberNameSnapshot: row.memberName,
          memberAgeSnapshot: row.memberAge,
        },
        select: { id: true },
      });
      if (existing) {
        await tx.rsvpMemberAttendance.update({
          where: { id: existing.id },
          data: { attending: row.attending },
        });
        continue;
      }
    } else {
      const existing = await tx.rsvpMemberAttendance.findUnique({
        where: {
          rsvpId_householdMemberId: {
            rsvpId,
            householdMemberId: row.householdMemberId,
          },
        },
        select: { id: true },
      });
      if (existing) {
        await tx.rsvpMemberAttendance.update({
          where: { id: existing.id },
          data: {
            attending: row.attending,
            memberNameSnapshot: row.memberName,
            memberAgeSnapshot: row.memberAge,
          },
        });
        continue;
      }
    }
    await tx.rsvpMemberAttendance.create({
      data: {
        rsvpId,
        householdMemberId: row.householdMemberId,
        memberNameSnapshot: row.memberName,
        memberAgeSnapshot: row.memberAge,
        attending: row.attending,
      },
    });
  }
}

/**
 * Convenience wrapper for callers that already have an
 * `attendances` array (the raw client input). Resolves, then
 * persists with the default replace semantics.
 */
export async function resolveAndPersistAttendances(
  tx: Tx,
  input: PersistAttendanceInput,
): Promise<{
  rows: Array<Omit<ResolvedAttendanceRow, 'isHistorical'>>;
}> {
  const { rows } = await resolveAttendancesForHousehold(tx, input.householdId, input.attendances);
  await persistResolvedAttendances(tx, input.rsvpId, rows);
  return { rows };
}

/**
 * Flips every row on the RSVP to `attending: NO` in one statement.
 * Used by the decline path. Historical rows (member soft-deleted,
 * householdMemberId = null) keep their snapshot and are also
 * flipped, so the confirmation still shows them as "not going".
 */
export async function markAllAttendanceNo(tx: Tx, rsvpId: string): Promise<void> {
  await tx.rsvpMemberAttendance.updateMany({
    where: { rsvpId },
    data: { attending: RsvpAttending.NO },
  });
}

/**
 * Stable string form of a list of attendance rows, used by the
 * audit log to detect attendance-only edits (e.g. swapping who is
 * going while preserving headcount).
 *
 * Accepts either the resolved shape (`memberName`, `memberAge`)
 * or the raw Prisma row shape (`memberNameSnapshot`,
 * `memberAgeSnapshot`) so the audit log can fingerprint the rows
 * it just fetched without remapping.
 */
export function attendanceFingerprint(
  rows: Array<Partial<ResolvedAttendanceRow> & { attending: RsvpAttending }> | null | undefined,
): string {
  if (!rows) return '';
  return rows
    .map((r) => {
      const rAny = r as Record<string, unknown>;
      const name =
        (rAny.memberName as string | undefined) ??
        (rAny.memberNameSnapshot as string | undefined) ??
        '';
      const age =
        (rAny.memberAge as number | null | undefined) ??
        (rAny.memberAgeSnapshot as number | null | undefined) ??
        null;
      return `${r.householdMemberId ?? 'guest'}:${name}:${age ?? ''}:${r.attending}`;
    })
    .sort()
    .join('|');
}

export function deriveHeadcount(
  attendances: MemberAttendanceInput[] | undefined,
  fallback: number | undefined,
): number {
  if (!attendances || attendances.length === 0) {
    // A bare legacy confirm with no attendance list still needs a
    // positive headcount so capacity checks behave. Returning 0 here
    // would be silently confusing.
    return Math.max(1, fallback ?? 1);
  }
  return attendances.filter((a) => a.attending === RsvpAttending.YES).length;
}
