import { router, protectedProcedure, eventAdminProcedure } from '~/lib/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { prisma } from '~/lib/prisma';
import {
  RSVPStatus,
  InvitationStatus,
  EventStatus,
  RsvpAttending,
  AdminPermission,
  CommunicationStatus,
  CommunicationChannel,
  CommunicationLogKind,
} from '~/lib/generated/enums';
import { writeAuditLog, writeDomainAuditLog, diff } from '~/lib/audit';
import {
  rsvpConfirmSchema,
  rsvpDeclineSchema,
  rsvpUpdateSchema,
  rsvpAdminOverrideSchema,
} from '~/lib/schemas';
import { syncRegistrationFee, toFeeAttendees } from '~/lib/registration-fee';
import {
  attendanceFingerprint,
  buildRosterAsNo,
  deriveHeadcount,
  markAllAttendanceNo,
  resolveAndPersistAttendances,
  type MemberAttendanceInput,
} from '~/server/rsvp-attendance';

async function triggerWorkflow(
  eventId: string,
  userId: string,
  action: 'confirm' | 'decline',
  headcount?: number,
) {
  try {
    const { getOpenWorkflow } = await import('~/lib/ow-client');
    const { rsvpConfirm, rsvpDecline } = await import('~/lib/ow-workflows');
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { householdId: true },
    });
    if (!user) return;

    const ow = await getOpenWorkflow();
    if (action === 'confirm') {
      await ow.runWorkflow(rsvpConfirm.spec, {
        eventId,
        userId,
        householdId: user.householdId || userId,
        headcount: headcount ?? 1,
      });
    } else {
      await ow.runWorkflow(rsvpDecline.spec, {
        eventId,
        userId,
        householdId: user.householdId || userId,
      });
    }
  } catch (error) {
    console.error(`Failed to trigger ${action} workflow:`, error);
  }
}

/**
 * Loads the household's householdId for the calling user, throwing
 * 401 when the user record cannot be found. Centralised so the
 * create/confirm/update/decline/adminOverride handlers all share
 * one lookup and do not re-query inside the transaction.
 */
async function loadCallerHousehold(
  sessionUserId: string,
): Promise<{ id: string; householdId: string }> {
  const user = await prisma.user.findUnique({
    where: { id: sessionUserId },
    select: { id: true, householdId: true },
  });
  if (!user) {
    throw new Error('User not found');
  }
  return { id: user.id, householdId: user.householdId ?? user.id };
}

/**
 * Returns true when the user supplied at least one YES attendance.
 * Used to decide between a CONFIRMED RSVP and an auto-decline when
 * the form ships an explicit "all NO" roster.
 */
function hasAnyYes(attendances: MemberAttendanceInput[] | undefined): boolean {
  if (!attendances) return false;
  return attendances.some((a) => a.attending === RsvpAttending.YES);
}

export const rsvpRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        eventId: z.string(),
        headcount: z.number().int().min(0).default(0),
        memberAttendances: z.array(z.unknown()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const event = await prisma.event.findUnique({
        where: { id: input.eventId },
        select: {
          id: true,
          status: true,
          rsvpDeadline: true,
          registrationFeeCents: true,
          registrationFeeMinAge: true,
          currency: true,
        },
      });

      if (!event) {
        throw new Error('Event not found');
      }

      if (event.status !== EventStatus.PUBLISHED) {
        throw new Error('Event is not accepting RSVPs');
      }

      if (event.rsvpDeadline && new Date(event.rsvpDeadline) < new Date()) {
        throw new Error('RSVP deadline has passed');
      }

      const caller = await loadCallerHousehold(ctx.session.user.id);

      const attendances = (input.memberAttendances as MemberAttendanceInput[] | undefined) ?? [];
      const headcount = deriveHeadcount(attendances, input.headcount);

      const rsvp = await prisma.$transaction(async (tx) => {
        // FPP-111: each user links to ONE account by email address, so
        // an RSVP must update the existing (eventId, userId) entry
        // rather than create a fresh one. `create` would insert a
        // duplicate row when the user already responded (e.g. a
        // returning invitee), which breaks the confirm/update/decline
        // single-entry invariant. `upsert`, mirroring the `confirm`
        // procedure, updates in place when a row exists.
        const upserted = await tx.rSVP.upsert({
          where: {
            eventId_userId: {
              eventId: input.eventId,
              userId: ctx.session.user.id,
            },
          },
          update: {
            householdId: caller.householdId,
            status: RSVPStatus.CONFIRMED,
            headcount,
            respondedAt: new Date(),
          },
          create: {
            eventId: input.eventId,
            userId: ctx.session.user.id,
            householdId: caller.householdId,
            status: RSVPStatus.CONFIRMED,
            headcount,
            respondedAt: new Date(),
          },
        });
        if (attendances.length > 0) {
          await resolveAndPersistAttendances(
            tx,
            {
              rsvpId: upserted.id,
              householdId: caller.householdId,
              attendances,
            },
            { replace: true },
          );
        }
        // Sync the registration fee so this entry point matches
        // `confirm` / `update` / `adminOverride`. The full snapshot
        // is reloaded to avoid undercounting when the user submits a
        // partial list.
        const snapshotForFee = await tx.rSVP.findUnique({
          where: { id: upserted.id },
          select: { memberAttendances: true },
        });
        await syncRegistrationFee(tx, {
          eventId: input.eventId,
          userId: ctx.session.user.id,
          householdId: caller.householdId,
          event: {
            registrationFeeCents: event.registrationFeeCents,
            registrationFeeMinAge: event.registrationFeeMinAge,
            currency: event.currency,
          },
          attendanceRows: toFeeAttendees(
            (snapshotForFee?.memberAttendances ?? []).map((a) => ({
              attending: a.attending,
              memberAge: a.memberAgeSnapshot,
            })),
          ),
        });
        // FPP-50 review: write the domain audit entry inside the
        // transaction so the audit row is atomic with the RSVP
        // write. If the audit insert fails the RSVP rolls back too,
        // matching the AdminAuditLog guarantees on the admin path.
        await writeDomainAuditLog(
          {
            actorId: ctx.session.user.id,
            action: 'rsvp.signup',
            subjectType: 'RSVP',
            subjectId: upserted.id,
            payload: {
              eventId: input.eventId,
              status: upserted.status,
              headcount,
              memberAttendances: attendances,
            },
          },
          tx,
        );
        return { ...upserted, headcount };
      });

      await prisma.invitation.updateMany({
        where: {
          eventId: input.eventId,
          OR: [{ userId: ctx.session.user.id }, { householdId: caller.householdId }],
          status: InvitationStatus.PENDING,
        },
        data: { status: InvitationStatus.USED },
      });

      return rsvp;
    }),

  update: protectedProcedure.input(rsvpUpdateSchema).mutation(async ({ ctx, input }) => {
    const event = await prisma.event.findUnique({
      where: { id: input.eventId },
      select: {
        id: true,
        registrationFeeCents: true,
        registrationFeeMinAge: true,
        currency: true,
      },
    });
    if (!event) {
      throw new Error('Event not found');
    }

    return prisma.$transaction(async (tx) => {
      const before = await tx.rSVP.findUnique({
        where: {
          eventId_userId: {
            eventId: input.eventId,
            userId: ctx.session.user.id,
          },
        },
        include: { memberAttendances: { orderBy: { createdAt: 'asc' } } },
      });

      if (!before) {
        throw new Error('No existing RSVP to update');
      }

      const householdId = before.householdId;
      const attendances = input.memberAttendances;
      const headcount =
        attendances !== undefined
          ? deriveHeadcount(attendances, undefined)
          : (input.headcount ?? before.headcount);

      const after = await tx.rSVP.update({
        where: {
          eventId_userId: {
            eventId: input.eventId,
            userId: ctx.session.user.id,
          },
        },
        data: {
          headcount,
        },
      });

      if (attendances !== undefined) {
        if (attendances.length === 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Mark attendance for at least one member',
          });
        }
        await resolveAndPersistAttendances(
          tx,
          {
            rsvpId: after.id,
            householdId,
            attendances,
          },
          { replace: true },
        );
      }

      // Reload the persisted attendance snapshot for the fee calculation
      // so the fee reflects the latest attendance rows.
      const snapshotForFee = await tx.rSVP.findUnique({
        where: { id: after.id },
        select: { memberAttendances: true },
      });
      const finalAttendanceRows = snapshotForFee?.memberAttendances ?? [];

      await syncRegistrationFee(tx, {
        eventId: input.eventId,
        userId: ctx.session.user.id,
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

      const refreshedAfter = await tx.rSVP.findUnique({
        where: { id: after.id },
        include: { memberAttendances: { orderBy: { createdAt: 'asc' } } },
      });
      const finalAttendances = refreshedAfter?.memberAttendances ?? [];
      const beforeFp = attendanceFingerprint(before.memberAttendances);
      const afterFp = attendanceFingerprint(finalAttendances);

      const change = diff(
        {
          status: before.status,
          headcount: before.headcount,
          memberAttendances: (before.memberAttendances ?? []).map((a) => ({
            householdMemberId: a.householdMemberId,
            memberName: a.memberNameSnapshot,
            memberAge: a.memberAgeSnapshot,
            attending: a.attending,
          })),
        },
        {
          status: after.status,
          headcount: after.headcount,
          memberAttendances: finalAttendances.map((a) => ({
            householdMemberId: a.householdMemberId,
            memberName: a.memberNameSnapshot,
            memberAge: a.memberAgeSnapshot,
            attending: a.attending,
          })),
        },
      );

      if (change) {
        await writeAuditLog(
          {
            userId: ctx.session.user.id,
            eventId: input.eventId,
            action: 'RSVP_UPDATE',
            oldValue: {
              headcount: before.headcount,
              memberAttendances: (before.memberAttendances ?? []).map((a) => ({
                householdMemberId: a.householdMemberId,
                memberName: a.memberNameSnapshot,
                memberAge: a.memberAgeSnapshot,
                attending: a.attending,
              })),
            },
            newValue: {
              headcount: after.headcount,
              memberAttendances: finalAttendances.map((a) => ({
                householdMemberId: a.householdMemberId,
                memberName: a.memberNameSnapshot,
                memberAge: a.memberAgeSnapshot,
                attending: a.attending,
              })),
              attendanceFingerprintChanged: beforeFp !== afterFp,
            },
          },
          tx,
        );
        // FPP-50 review: also write to the domain audit log so the
        // RSVP change is captured against the subject RSVP for the
        // unified audit view.
        await writeDomainAuditLog(
          {
            actorId: ctx.session.user.id,
            action: 'rsvp.update',
            subjectType: 'RSVP',
            subjectId: after.id,
            payload: {
              eventId: input.eventId,
              headcount: after.headcount,
              memberAttendances: finalAttendances.map((a) => ({
                householdMemberId: a.householdMemberId,
                memberName: a.memberNameSnapshot,
                memberAge: a.memberAgeSnapshot,
                attending: a.attending,
              })),
              attendanceFingerprintChanged: beforeFp !== afterFp,
            },
          },
          tx,
        );
      }

      return after;
    });
  }),

  confirm: protectedProcedure.input(rsvpConfirmSchema).mutation(async ({ ctx, input }) => {
    const event = await prisma.event.findUnique({
      where: { id: input.eventId },
    });

    if (!event) {
      throw new Error('Event not found');
    }

    if (event.status !== EventStatus.PUBLISHED) {
      throw new Error('Event is not accepting RSVPs');
    }

    if (event.rsvpDeadline && new Date(event.rsvpDeadline) < new Date()) {
      throw new Error('RSVP deadline has passed');
    }

    const caller = await loadCallerHousehold(ctx.session.user.id);
    const householdId = caller.householdId;

    // If the client supplies a memberAttendances list and every row
    // is NO, the user has declined without using the decline path.
    // Reject so we never write a CONFIRMED RSVP with headcount 0.
    const attendances = input.memberAttendances;
    if (attendances !== undefined && attendances.length > 0 && !hasAnyYes(attendances)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message:
          'At least one member must be marked as going. Use the decline button if no one is attending.',
      });
    }

    const tentativeHeadcount = deriveHeadcount(attendances, input.headcount);
    if (tentativeHeadcount < 1) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'At least one member must be marked as going.',
      });
    }

    let isWaitlisted = false;
    let waitlistPosition: number | null = null;

    if (event.maxCapacity) {
      const currentHeadcount = await prisma.rSVP.aggregate({
        where: {
          eventId: input.eventId,
          status: RSVPStatus.CONFIRMED,
          userId: { not: ctx.session.user.id },
        },
        _sum: { headcount: true },
      });

      const totalAfterRsvp = (currentHeadcount._sum.headcount || 0) + tentativeHeadcount;
      if (totalAfterRsvp > event.maxCapacity) {
        const waitlistCount = await prisma.rSVP.count({
          where: {
            eventId: input.eventId,
            status: RSVPStatus.WAITLISTED,
          },
        });
        isWaitlisted = true;
        waitlistPosition = waitlistCount + 1;
      }
    }

    const rsvp = await prisma.$transaction(async (tx) => {
      const before = await tx.rSVP.findUnique({
        where: {
          eventId_userId: {
            eventId: input.eventId,
            userId: ctx.session.user.id,
          },
        },
        include: { memberAttendances: { orderBy: { createdAt: 'asc' } } },
      });

      const upserted = await tx.rSVP.upsert({
        where: {
          eventId_userId: {
            eventId: input.eventId,
            userId: ctx.session.user.id,
          },
        },
        update: {
          status: isWaitlisted ? RSVPStatus.WAITLISTED : RSVPStatus.CONFIRMED,
          headcount: tentativeHeadcount,
          respondedAt: new Date(),
          waitlistPosition: isWaitlisted ? waitlistPosition : null,
        },
        create: {
          eventId: input.eventId,
          userId: ctx.session.user.id,
          householdId,
          status: isWaitlisted ? RSVPStatus.WAITLISTED : RSVPStatus.CONFIRMED,
          headcount: tentativeHeadcount,
          respondedAt: new Date(),
          waitlistPosition: isWaitlisted ? waitlistPosition : null,
        },
      });

      if (attendances !== undefined) {
        if (attendances.length === 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Mark attendance for at least one member',
          });
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
      }

      // Reload the persisted attendance snapshot for the fee calculation
      // so the fee reflects the latest attendance rows.
      const snapshotForFee = await tx.rSVP.findUnique({
        where: { id: upserted.id },
        select: { memberAttendances: true },
      });
      const finalAttendanceRows = snapshotForFee?.memberAttendances ?? [];

      await syncRegistrationFee(tx, {
        eventId: input.eventId,
        userId: ctx.session.user.id,
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

      if (before) {
        const refreshedAfter = await tx.rSVP.findUnique({
          where: { id: upserted.id },
          include: { memberAttendances: { orderBy: { createdAt: 'asc' } } },
        });
        const finalAttendances = refreshedAfter?.memberAttendances ?? [];
        const beforeFp = attendanceFingerprint(before.memberAttendances);
        const afterFp = attendanceFingerprint(finalAttendances);

        const change = diff(
          {
            status: before.status,
            headcount: before.headcount,
            waitlistPosition: before.waitlistPosition,
            memberAttendances: (before.memberAttendances ?? []).map((a) => ({
              householdMemberId: a.householdMemberId,
              memberName: a.memberNameSnapshot,
              memberAge: a.memberAgeSnapshot,
              attending: a.attending,
            })),
          },
          {
            status: upserted.status,
            headcount: upserted.headcount,
            waitlistPosition: upserted.waitlistPosition,
            memberAttendances: finalAttendances.map((a) => ({
              householdMemberId: a.householdMemberId,
              memberName: a.memberNameSnapshot,
              memberAge: a.memberAgeSnapshot,
              attending: a.attending,
            })),
          },
        );

        if (change) {
          await writeAuditLog(
            {
              userId: ctx.session.user.id,
              eventId: input.eventId,
              action: 'RSVP_UPDATE',
              oldValue: {
                status: before.status,
                headcount: before.headcount,
                waitlistPosition: before.waitlistPosition,
                memberAttendances: (before.memberAttendances ?? []).map((a) => ({
                  householdMemberId: a.householdMemberId,
                  memberName: a.memberNameSnapshot,
                  memberAge: a.memberAgeSnapshot,
                  attending: a.attending,
                })),
              },
              newValue: {
                status: upserted.status,
                headcount: upserted.headcount,
                waitlistPosition: upserted.waitlistPosition,
                memberAttendances: finalAttendances.map((a) => ({
                  householdMemberId: a.householdMemberId,
                  memberName: a.memberNameSnapshot,
                  memberAge: a.memberAgeSnapshot,
                  attending: a.attending,
                })),
                attendanceFingerprintChanged: beforeFp !== afterFp,
              },
            },
            tx,
          );
          // FPP-50 review: mirror the update on the domain audit log
          // so admins filtering by subject_type / subject_id / event
          // see re-confirms alongside first-time confirms.
          await writeDomainAuditLog(
            {
              actorId: ctx.session.user.id,
              action: 'rsvp.confirm.update',
              subjectType: 'RSVP',
              subjectId: upserted.id,
              payload: {
                eventId: input.eventId,
                status: upserted.status,
                headcount: upserted.headcount,
                waitlistPosition: upserted.waitlistPosition,
                memberAttendances: finalAttendances.map((a) => ({
                  householdMemberId: a.householdMemberId,
                  memberName: a.memberNameSnapshot,
                  memberAge: a.memberAgeSnapshot,
                  attending: a.attending,
                })),
                attendanceFingerprintChanged: beforeFp !== afterFp,
              },
            },
            tx,
          );
        }
      } else {
        // FPP-50: first-time confirmation was previously invisible to the
        // audit log (the diff branch above only fires when `before` exists).
        // Emit a domain entry so the event registration is captured.
        await writeDomainAuditLog(
          {
            actorId: ctx.session.user.id,
            action: 'rsvp.confirm',
            subjectType: 'RSVP',
            subjectId: upserted.id,
            payload: {
              eventId: input.eventId,
              status: upserted.status,
              headcount: upserted.headcount,
              waitlistPosition: upserted.waitlistPosition,
              isWaitlisted,
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
      }

      return upserted;
    });

    if (!isWaitlisted) {
      await prisma.invitation.updateMany({
        where: {
          eventId: input.eventId,
          OR: [{ userId: ctx.session.user.id }, { householdId }],
          status: InvitationStatus.PENDING,
        },
        data: { status: InvitationStatus.USED },
      });
    }

    triggerWorkflow(input.eventId, ctx.session.user.id, 'confirm', tentativeHeadcount);

    return { ...rsvp, isWaitlisted, waitlistPosition };
  }),

  decline: protectedProcedure.input(rsvpDeclineSchema).mutation(async ({ ctx, input }) => {
    const caller = await loadCallerHousehold(ctx.session.user.id);
    const householdId = caller.householdId;
    // FPP-88: trim and treat empty strings as "no note" so the UI
    // can submit an empty field without a separate branch.
    const declineMessage = input.declineMessage?.trim() || null;

    const existingRsvp = await prisma.rSVP.findUnique({
      where: {
        eventId_userId: {
          eventId: input.eventId,
          userId: ctx.session.user.id,
        },
      },
      include: {
        potluckSignups: {
          include: { slot: true },
        },
        memberAttendances: { orderBy: { createdAt: 'asc' } },
      },
    });

    const wasConfirmed = existingRsvp?.status === RSVPStatus.CONFIRMED;
    const hadWaitlistPosition = existingRsvp?.waitlistPosition;

    const declined = await prisma.$transaction(async (tx) => {
      for (const signup of existingRsvp?.potluckSignups || []) {
        await tx.potluckSlot.update({
          where: { id: signup.slotId },
          data: { currentSignups: { decrement: signup.servings } },
        });
      }

      await tx.potluckSignup.deleteMany({
        where: { rsvpId: existingRsvp?.id },
      });

      const updated = await tx.rSVP.upsert({
        where: {
          eventId_userId: {
            eventId: input.eventId,
            userId: ctx.session.user.id,
          },
        },
        update: {
          status: RSVPStatus.DECLINED,
          headcount: 0,
          respondedAt: new Date(),
          waitlistPosition: null,
          declineMessage,
        },
        create: {
          eventId: input.eventId,
          userId: ctx.session.user.id,
          householdId,
          status: RSVPStatus.DECLINED,
          headcount: 0,
          respondedAt: new Date(),
          declineMessage,
        },
      });

      if (existingRsvp) {
        await markAllAttendanceNo(tx, existingRsvp.id);
      } else {
        // First-time decline: materialize the current roster as NO
        // so the confirmation page can summarise every member. The
        // rows are still owned by the RSVP and can be flipped when
        // the user later confirms.
        const roster = await buildRosterAsNo(tx, householdId);
        if (roster.length > 0) {
          await tx.rsvpMemberAttendance.createMany({
            data: roster.map((row) => ({
              rsvpId: updated.id,
              householdMemberId: row.householdMemberId,
              memberNameSnapshot: row.memberName,
              memberAgeSnapshot: row.memberAge,
              attending: row.attending,
            })),
          });
        }
      }

      if (existingRsvp) {
        await writeAuditLog(
          {
            userId: ctx.session.user.id,
            eventId: input.eventId,
            action: 'RSVP_UPDATE',
            oldValue: {
              status: existingRsvp.status,
              headcount: existingRsvp.headcount,
              waitlistPosition: existingRsvp.waitlistPosition,
              memberAttendances: (existingRsvp.memberAttendances ?? []).map((a) => ({
                householdMemberId: a.householdMemberId,
                memberName: a.memberNameSnapshot,
                memberAge: a.memberAgeSnapshot,
                attending: a.attending,
              })),
            },
            // Decline collapses every attendance row to NO;
            // we can compute the new value from the old rows
            // without re-fetching.
            newValue: {
              status: updated.status,
              headcount: updated.headcount,
              waitlistPosition: updated.waitlistPosition,
              slotsReleased: existingRsvp.potluckSignups.length,
              memberAttendances: (existingRsvp.memberAttendances ?? []).map((a) => ({
                householdMemberId: a.householdMemberId,
                memberName: a.memberNameSnapshot,
                memberAge: a.memberAgeSnapshot,
                attending: RsvpAttending.NO,
              })),
              declineMessage,
            },
          },
          tx,
        );
        // FPP-50 review: mirror the decline on the domain audit log so
        // the unified view shows RSVP state transitions for the
        // subject RSVP. Without this, declines would only surface
        // under the AdminAuditLog source tag with no `subject_type`
        // to filter by.
        await writeDomainAuditLog(
          {
            actorId: ctx.session.user.id,
            action: 'rsvp.decline',
            subjectType: 'RSVP',
            subjectId: updated.id,
            payload: {
              eventId: input.eventId,
              status: updated.status,
              slotsReleased: existingRsvp.potluckSignups.length,
              memberAttendances: (existingRsvp.memberAttendances ?? []).map((a) => ({
                householdMemberId: a.householdMemberId,
                memberName: a.memberNameSnapshot,
                memberAge: a.memberAgeSnapshot,
                attending: RsvpAttending.NO,
              })),
              declineMessage,
            },
          },
          tx,
        );
      } else {
        // FPP-50 review: first-time decline is a registration event
        // (the user registers their decision not to attend). Capture
        // it on the domain log so the subject RSVP surfaces in the
        // unified view.
        await writeDomainAuditLog(
          {
            actorId: ctx.session.user.id,
            action: 'rsvp.decline',
            subjectType: 'RSVP',
            subjectId: updated.id,
            payload: {
              eventId: input.eventId,
              status: updated.status,
              slotsReleased: 0,
              declineMessage,
            },
          },
          tx,
        );
      }

      if (wasConfirmed) {
        const nextWaitlisted = await tx.rSVP.findFirst({
          where: {
            eventId: input.eventId,
            status: RSVPStatus.WAITLISTED,
          },
          orderBy: { waitlistPosition: 'asc' },
        });

        if (nextWaitlisted) {
          await tx.rSVP.update({
            where: { id: nextWaitlisted.id },
            data: {
              status: RSVPStatus.CONFIRMED,
              waitlistPosition: null,
              respondedAt: new Date(),
            },
          });

          await tx.rSVP.updateMany({
            where: {
              eventId: input.eventId,
              status: RSVPStatus.WAITLISTED,
              waitlistPosition: { gt: nextWaitlisted.waitlistPosition || 0 },
            },
            data: {
              waitlistPosition: { decrement: 1 },
            },
          });

          await tx.adminAuditLog.create({
            data: {
              userId: nextWaitlisted.userId,
              eventId: input.eventId,
              action: 'WAITLIST_PROMOTION',
              oldValue: {
                status: RSVPStatus.WAITLISTED,
                position: nextWaitlisted.waitlistPosition,
              },
              newValue: { status: RSVPStatus.CONFIRMED },
            },
          });
        }
      } else if (hadWaitlistPosition) {
        await tx.rSVP.updateMany({
          where: {
            eventId: input.eventId,
            status: RSVPStatus.WAITLISTED,
            waitlistPosition: { gt: hadWaitlistPosition },
          },
          data: {
            waitlistPosition: { decrement: 1 },
          },
        });
      }

      return updated;
    });

    // FPP-88: forward the decline note to the event owner so the
    // host actually receives it. We write one CommunicationLog row
    // per owner with the message in `body`. Done outside the
    // RSVP transaction because the recipients live on a separate
    // table and the send pipeline (TODO: FPP-89) reads its own
    // queue.
    if (declineMessage) {
      const owners = await prisma.eventAdmin.findMany({
        where: {
          eventId: input.eventId,
          role: AdminPermission.OWNER,
        },
        select: { userId: true },
      });

      if (owners.length > 0) {
        await prisma.communicationLog.createMany({
          data: owners.map((owner) => ({
            eventId: input.eventId,
            sentByUserId: ctx.session.user.id,
            recipientUserId: owner.userId,
            channel: CommunicationChannel.EMAIL,
            status: CommunicationStatus.QUEUED,
            // FPP-88 review: tag the row so the send pipeline
            // can branch on `kind` instead of sniffing `body`.
            // Without this, an invitation URL and a decline
            // note are indistinguishable in the queue.
            kind: CommunicationLogKind.DECLINE_NOTE,
            body: declineMessage,
          })),
        });
      }
    }

    triggerWorkflow(input.eventId, ctx.session.user.id, 'decline');

    return declined;
  }),

  // FPP-104: per-event gate. A HOST with an EventAdmin row on the
  // event can override RSVPs on their own picnic. Super-admins /
  // ADMIN_ADULT users pass via the platform-level admin branch.
  // Aligns the tRPC proc with the REST `/api/admin/rsvp/override`
  // route (FPP-102) and the existing event-scoped tRPC builders.
  adminOverride: eventAdminProcedure(rsvpAdminOverrideSchema, (input) => input.eventId).mutation(
    async ({ ctx, input }) => {
      const targetUser = await prisma.user.findUnique({
        where: { id: input.userId },
        select: { id: true, householdId: true },
      });

      if (!targetUser) {
        throw new Error('User not found');
      }

      const event = await prisma.event.findUnique({
        where: { id: input.eventId },
        select: {
          id: true,
          registrationFeeCents: true,
          registrationFeeMinAge: true,
          currency: true,
        },
      });
      if (!event) {
        throw new Error('Event not found');
      }

      // FPP-102: optional decline note. The schema trims the
      // value before we see it, so an empty string is the only
      // "no note" sentinel. Map `""` to `null` so the column
      // stays unset and the audit log can detect the difference
      // between "no note" and "empty note typed in".
      const declineMessage =
        input.declineMessage && input.declineMessage.length > 0 ? input.declineMessage : null;

      const householdId = targetUser.householdId ?? targetUser.id;
      const attendances = input.memberAttendances;
      const headcount =
        attendances !== undefined
          ? deriveHeadcount(attendances, undefined)
          : (input.headcount ?? (input.status === RSVPStatus.CONFIRMED ? 1 : 0));

      if (input.status === RSVPStatus.CONFIRMED && headcount < 1) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'At least one member must be marked as going for a confirmed RSVP.',
        });
      }

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
            // admin re-confirming a previously-declined RSVP
            // should clear the stale note.
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
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Mark attendance for at least one member',
            });
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
          // snapshot. Mirrors the user-facing decline proc.
          await markAllAttendanceNo(tx, upserted.id);
        }

        // Reload the persisted attendance snapshot for the fee calculation
        // so the fee reflects the latest attendance rows.
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

        // FPP-50: surface admin RSVP overrides on the audit log so the
        // action is filterable by actor, subject, and time. The generic
        // `auditedAdminProcedure` middleware records the path against
        // AdminAuditLog; this entry captures the diff against the
        // subject RSVP for the domain log.
        await writeDomainAuditLog(
          {
            actorId: ctx.session.user.id,
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

        return upserted;
      });

      // FPP-102: forward a non-empty decline note from the admin
      // path to the event owner. Mirrors the user-facing decline
      // proc so a manual DECLINED entry from the admin MembersTable
      // also delivers the note via the FPP-101 email worker.
      if (input.status === RSVPStatus.DECLINED && declineMessage) {
        const owners = await prisma.eventAdmin.findMany({
          where: { eventId: input.eventId, role: AdminPermission.OWNER },
          select: { userId: true },
        });
        if (owners.length > 0) {
          await prisma.communicationLog.createMany({
            data: owners.map((owner) => ({
              eventId: input.eventId,
              sentByUserId: ctx.session.user.id,
              recipientUserId: owner.userId,
              channel: CommunicationChannel.EMAIL,
              status: CommunicationStatus.QUEUED,
              kind: CommunicationLogKind.DECLINE_NOTE,
              body: declineMessage,
            })),
          });
        }
      }

      return result;
    },
  ),

  /**
   * FPP-102: admin-only RSVP detail fetch used by the manual entry
   * modal. Returns the full RSVP with member attendances plus the
   * household's current roster so the modal can prefill status,
   * headcount, decline message, and per-member attendance. Returns
   * `null` when no RSVP row exists for the supplied id (so the
   * caller can branch on missing data).
   *
   * FPP-104: per-event gate. The input is just the rsvp id, so the
   * `getEventId` lookup resolves the parent event. Mirrors the
   * `potluck.updateSlot` / `potluck.deleteSlot` pattern — a
   * missing RSVP throws `TRPCError(NOT_FOUND)` from the resolver
   * so the gate never sees a dangling empty-string eventId.
   */
  getById: eventAdminProcedure(z.object({ rsvpId: z.string().min(1) }), async (input) => {
    const rsvp = await prisma.rSVP.findUnique({
      where: { id: input.rsvpId },
      select: { eventId: true },
    });
    if (!rsvp) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'RSVP not found' });
    }
    return rsvp.eventId;
  }).query(async ({ input }) => {
    const rsvp = await prisma.rSVP.findUnique({
      where: { id: input.rsvpId },
      include: {
        // The user/household context (name, email) is already
        // passed to the modal as the `targetUser` prop from the
        // row the admin clicked. We only need the householdId
        // to scope the roster lookup.
        user: { select: { householdId: true } },
        memberAttendances: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!rsvp) return null;

    const householdId = rsvp.user.householdId ?? rsvp.userId;
    const members = await prisma.householdMember.findMany({
      where: { householdId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, age: true, relationship: true },
    });

    return {
      rsvp: {
        id: rsvp.id,
        eventId: rsvp.eventId,
        userId: rsvp.userId,
        householdId: rsvp.householdId,
        status: rsvp.status,
        headcount: rsvp.headcount,
        declineMessage: rsvp.declineMessage,
        respondedAt: rsvp.respondedAt ? rsvp.respondedAt.toISOString() : null,
        memberAttendances: rsvp.memberAttendances.map((a) => ({
          id: a.id,
          householdMemberId: a.householdMemberId,
          memberNameSnapshot: a.memberNameSnapshot,
          memberAgeSnapshot: a.memberAgeSnapshot,
          attending: a.attending,
        })),
      },
      members,
    };
  }),

  getHeadcount: protectedProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ input }) => {
      const result = await prisma.rSVP.aggregate({
        where: {
          eventId: input.eventId,
          status: RSVPStatus.CONFIRMED,
        },
        _sum: { headcount: true },
        _count: { id: true },
      });

      return {
        totalHeadcount: result._sum.headcount || 0,
        totalRsvps: result._count.id || 0,
      };
    }),

  /**
   * Admin-only view: returns every RSVP for an event including
   * per-member attendance. Restricted because the rows include
   * `householdMemberId` and `memberNameSnapshot` that the
   * `getRsvpFormState` flow already sources from the database, and
   * we do not want authenticated non-admins scraping the full
   * household roster for any event.
   *
   * FPP-104: per-event gate. A HOST with an EventAdmin row for the
   * event can view the full attendee roster for their own picnic.
   */
  getByEvent: eventAdminProcedure(
    z.object({ eventId: z.string() }),
    (input) => input.eventId,
  ).query(async ({ input }) => {
    return prisma.rSVP.findMany({
      where: { eventId: input.eventId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        memberAttendances: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { respondedAt: 'desc' },
    });
  }),

  getMyRsvp: protectedProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ ctx, input }) => {
      return prisma.rSVP.findUnique({
        where: {
          eventId_userId: {
            eventId: input.eventId,
            userId: ctx.session.user.id,
          },
        },
        include: {
          memberAttendances: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });
    }),

  /**
   * Returns the household's roster with the per-RSVP attendance for
   * the caller's RSVP. The household members are the source of truth
   * for "who is in the household", while the memberAttendances hold
   * the per-event answer. We also include historical rows whose
   * member has since been soft-deleted so the form can show them
   * and the user can keep or flip them to NO.
   *
   * FPP-34: the caller's phone + sms consent also surface here so the
   * RSVP form can hydrate the optional SMS opt-in without an extra
   * round-trip to the user router.
   */
  getRsvpFormState: protectedProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ ctx, input }) => {
      const caller = await prisma.user.findUnique({
        where: { id: ctx.session.user.id },
        select: {
          id: true,
          name: true,
          householdId: true,
          phoneNumber: true,
          smsConsent: true,
        },
      });
      if (!caller) return null;

      const householdId = caller.householdId ?? caller.id;

      const [members, rsvp, household] = await Promise.all([
        prisma.householdMember.findMany({
          where: { householdId, deletedAt: null },
          orderBy: { createdAt: 'asc' },
          select: { id: true, name: true, age: true, notes: true, relationship: true },
        }),
        prisma.rSVP.findUnique({
          where: {
            eventId_userId: { eventId: input.eventId, userId: caller.id },
          },
          include: {
            memberAttendances: { orderBy: { createdAt: 'asc' } },
          },
        }),
        caller.householdId
          ? prisma.household.findUnique({
              where: { id: caller.householdId },
              select: { name: true },
            })
          : Promise.resolve(null),
      ]);

      return {
        members,
        rsvp,
        userName: caller.name,
        householdId,
        hasHousehold: Boolean(caller.householdId),
        householdName: household?.name ?? null,
        // FPP-34: phone + smsConsent feed the RSVP form's optional
        // SMS opt-in. Returned as a snapshot the client can hydrate
        // without an extra request.
        phoneNumber: caller.phoneNumber ?? null,
        smsConsent: caller.smsConsent,
      };
    }),
});
