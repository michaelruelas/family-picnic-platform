import { NextResponse } from 'next/server';
import { requireEventAdminApi } from '~/lib/admin-auth';
import { prisma } from '~/lib/prisma';
import {
  RSVPStatus,
  AdminPermission,
  CommunicationChannel,
  CommunicationStatus,
  CommunicationLogKind,
} from '~/lib/generated/enums';
import { rsvpAdminOverrideSchema } from '~/lib/schemas';
import { writeAuditLog, writeDomainAuditLog } from '~/lib/audit';
import { syncRegistrationFee, toFeeAttendees } from '~/lib/registration-fee';
import {
  deriveHeadcount,
  markAllAttendanceNo,
  resolveAndPersistAttendances,
} from '~/server/rsvp-attendance';

/**
 * FPP-102: REST mirror of `rsvp.adminOverride` so the admin
 * MembersTable modal can call a plain fetch without bundling a tRPC
 * client. Mirrors the tRPC proc:
 *
 * - FPP-104: per-event gate via `requireEventAdminApi(eventId)` —
 *   a HOST with an EventAdmin row for the event can override
 *   RSVPs on their own event. Super-admins / ADMIN_ADULT still
 *   pass via the platform-level admin branch.
 * - Validates the payload with `rsvpAdminOverrideSchema`.
 * - Inside a single `$transaction`:
 *   - Upserts the RSVP with the supplied status + headcount.
 *   - Resolves and persists `memberAttendances` (default
 *     replace=false to preserve historical rows).
 *   - Re-syncs the registration fee from the full persisted
 *     attendance snapshot so omitted members still count.
 *   - Writes a diff-aware `AuditLog` row keyed to the subject RSVP
 *     (actor = calling admin) so admin overrides show up in the
 *     unified audit view.
 *   - Writes an `AdminAuditLog` row with the request path so the
 *     middleware's audited admin trail still gets a per-request
 *     entry (the tRPC middleware does this for us, the REST
 *     endpoint has to do it explicitly).
 * - When the new status is `DECLINED` and a `declineMessage` is
 *   supplied, writes a `CommunicationLogKind.DECLINE_NOTE` row for
 *   every `EventAdmin.role = OWNER` so the FPP-101 email worker can
 *   pick them up.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = rsvpAdminOverrideSchema.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message ?? 'Invalid input';
    return NextResponse.json({ error: firstIssue }, { status: 400 });
  }
  const input = parsed.data;

  // FPP-104: per-event gate. We know the eventId from the validated
  // body so we can run the gate before the user lookup, mirroring
  // the tRPC `eventAdminProcedure` middleware that runs after the
  // Zod parse.
  const auth = await requireEventAdminApi(input.eventId);
  if (!auth.ok) return auth.response;
  const { session } = auth;

  try {
    const targetUser = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true, householdId: true },
    });
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const event = await prisma.event.findUnique({
      where: { id: input.eventId },
      select: {
        id: true,
        status: true,
        registrationFeeCents: true,
        registrationFeeMinAge: true,
        currency: true,
      },
    });
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const householdId = targetUser.householdId ?? targetUser.id;
    const attendances = input.memberAttendances;
    const headcount =
      attendances !== undefined
        ? deriveHeadcount(attendances, undefined)
        : (input.headcount ?? (input.status === RSVPStatus.CONFIRMED ? 1 : 0));

    if (input.status === RSVPStatus.CONFIRMED && headcount < 1) {
      return NextResponse.json(
        { error: 'At least one member must be marked as going for a confirmed RSVP.' },
        { status: 400 },
      );
    }

    // FPP-102: optional decline note. The schema trims the
    // value before we see it, so an empty string is the only
    // "no note" sentinel. Map `""` to `null` so the column stays
    // unset and the audit log can detect the difference between
    // "no note" and "empty note typed in".
    const declineMessage =
      input.declineMessage && input.declineMessage.length > 0 ? input.declineMessage : null;

    const result = await prisma.$transaction(async (tx) => {
      const before = await tx.rSVP.findUnique({
        where: {
          eventId_userId: {
            eventId: input.eventId,
            userId: input.userId,
          },
        },
        include: { memberAttendances: { orderBy: { createdAt: 'asc' } } },
      });

      const upserted = await tx.rSVP.upsert({
        where: {
          eventId_userId: {
            eventId: input.eventId,
            userId: input.userId,
          },
        },
        update: {
          status: input.status,
          headcount,
          respondedAt: new Date(),
          // FPP-102: only stamp declineMessage on decline. An
          // admin re-confirming a previously-declined RSVP should
          // clear the stale note.
          declineMessage: input.status === RSVPStatus.DECLINED ? declineMessage : null,
        },
        create: {
          eventId: input.eventId,
          userId: input.userId,
          householdId,
          status: input.status,
          headcount,
          respondedAt: new Date(),
          declineMessage: input.status === RSVPStatus.DECLINED ? declineMessage : null,
        },
      });

      if (attendances !== undefined) {
        if (attendances.length === 0) {
          throw new Error('Mark attendance for at least one member');
        }
        await resolveAndPersistAttendances(
          tx,
          {
            rsvpId: upserted.id,
            householdId,
            attendances,
          },
          { replace: true },
        );
      } else if (input.status === RSVPStatus.DECLINED) {
        // FPP-102: when the admin declines without sending a new
        // attendance list (the modal hides the per-member grid on
        // decline), flip any pre-existing YES/MAYBE rows to NO so
        // the decline produces a consistent "no one is going"
        // snapshot. Mirrors the tRPC `adminOverride` proc and the
        // user-facing decline proc.
        await markAllAttendanceNo(tx, upserted.id);
      }

      const snapshotForFee = await tx.rSVP.findUnique({
        where: { id: upserted.id },
        select: { memberAttendances: true },
      });
      const finalAttendanceRows = snapshotForFee?.memberAttendances ?? [];

      await syncRegistrationFee(tx, {
        eventId: input.eventId,
        userId: input.userId,
        householdId,
        event: {
          registrationFeeCents: event.registrationFeeCents,
          registrationFeeMinAge: event.registrationFeeMinAge,
          currency: event.currency,
        },
        attendanceRows: toFeeAttendees(
          finalAttendanceRows.map((a) => ({
            attending: a.attending,
            memberAge: a.memberAgeSnapshot,
          })),
        ),
      });

      await writeDomainAuditLog(
        {
          actorId: session.user.id,
          action: before ? 'rsvp.adminOverride.update' : 'rsvp.adminOverride.create',
          subjectType: 'RSVP',
          subjectId: upserted.id,
          payload: {
            eventId: input.eventId,
            targetUserId: input.userId,
            before: before ? { status: before.status, headcount: before.headcount } : null,
            after: { status: upserted.status, headcount: upserted.headcount },
            declineMessage: input.status === RSVPStatus.DECLINED ? declineMessage : null,
            memberAttendances: finalAttendanceRows.map((a) => ({
              householdMemberId: a.householdMemberId,
              memberName: a.memberNameSnapshot,
              memberAge: a.memberAgeSnapshot,
              attending: a.attending,
            })),
          },
        },
        tx,
      );

      // Mirror the `auditedAdminProcedure` middleware: stamp the
      // request path on `AdminAuditLog` so the per-request trail
      // matches the tRPC procedure exactly. The tRPC middleware
      // fires after the resolver returns, but we want the audit
      // entry to roll back if the resolver throws — writing it
      // inside the same transaction guarantees that.
      await writeAuditLog(
        {
          userId: session.user.id,
          eventId: input.eventId,
          action: 'rsvp.adminOverride',
        },
        tx,
      );

      return { rsvp: upserted, finalAttendanceRows };
    });

    // FPP-88 / FPP-102: forward the decline note to the event
    // owner(s) via a CommunicationLog row. Mirrors the tRPC
    // decline/adminOverride behaviour so the FPP-101 email worker
    // can deliver. Runs outside the RSVP transaction because the
    // recipients live on a separate table.
    if (input.status === RSVPStatus.DECLINED && declineMessage) {
      const owners = await prisma.eventAdmin.findMany({
        where: { eventId: input.eventId, role: AdminPermission.OWNER },
        select: { userId: true },
      });
      if (owners.length > 0) {
        await prisma.communicationLog.createMany({
          data: owners.map((owner) => ({
            eventId: input.eventId,
            sentByUserId: session.user.id,
            recipientUserId: owner.userId,
            channel: CommunicationChannel.EMAIL,
            status: CommunicationStatus.QUEUED,
            kind: CommunicationLogKind.DECLINE_NOTE,
            body: declineMessage,
          })),
        });
      }
    }

    return NextResponse.json({
      rsvpId: result.rsvp.id,
      status: result.rsvp.status,
      headcount: result.rsvp.headcount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    // Validation errors from `resolveAndPersistAttendances` arrive
    // here as plain Errors. Map them to 400 so the client can
    // surface the message.
    if (
      message === 'Mark attendance for at least one member' ||
      message === 'Duplicate attendance entry for the same member'
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error('Failed to override RSVP:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
