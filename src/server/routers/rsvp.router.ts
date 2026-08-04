import { router, protectedProcedure, auditedAdminProcedure } from '~/lib/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { prisma } from '~/lib/prisma';
import {
  RSVPStatus,
  InvitationStatus,
  EventStatus,
  RsvpAttending,
  RegistrationStatus,
} from '~/lib/generated/enums';
import { writeAuditLog, diff } from '~/lib/audit';
import {
  rsvpConfirmSchema,
  rsvpDeclineSchema,
  rsvpUpdateSchema,
  rsvpAdminOverrideSchema,
} from '~/lib/schemas';
import { calculateFeeFromEvent, type FeeAttendee } from '~/lib/fee';
import {
  attendanceFingerprint,
  buildRosterAsNo,
  deriveHeadcount,
  markAllAttendanceNo,
  resolveAndPersistAttendances,
  type MemberAttendanceInput,
  type ResolvedAttendanceRow,
} from '~/server/rsvp-attendance';

async function triggerWorkflow(
  eventId: string,
  userId: string,
  action: 'confirm' | 'decline',
  headcount?: number,
  dietaryNotes?: string,
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
        dietaryNotes,
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

/**
 * Shape accepted by the fee calculator. Accepts both the raw input
 * shape and the resolved (server-trusted) shape; both expose the
 * fields the calculator reads.
 */
type FeeInputRow = {
  attending: RsvpAttending;
  memberAge: number | null | undefined;
};

function toFeeInput(rows: Array<FeeInputRow | ResolvedAttendanceRow>): FeeAttendee[] {
  return rows.map((r) => ({
    attending: r.attending,
    memberAge: r.memberAge ?? null,
  }));
}

/**
 * Recomputes the registration fee from the persisted attendance
 * snapshot and writes it onto the Registration row in the same
 * transaction as the RSVP write. Skips the write when the event
 * has no fee configured (registrationFeeCents === 0 or null) so
 * free events never get an empty Registration row.
 *
 * Returns the amount written (in cents) so the caller can include
 * it in the audit diff.
 */
async function syncRegistrationFee(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  args: {
    eventId: string;
    userId: string;
    householdId: string;
    event: {
      registrationFeeCents: number | null;
      registrationFeeMinAge: number;
      currency: string;
    };
    attendanceRows: Array<FeeInputRow | ResolvedAttendanceRow>;
  },
): Promise<{ amountCents: number; currency: string; skipped: boolean }> {
  const { event } = args;
  const breakdown = calculateFeeFromEvent(toFeeInput(args.attendanceRows), event);
  if (breakdown.amountCents <= 0) {
    // No fee configured for this event. Leave any pre-existing
    // Registration row alone — backfill or a future paid event will
    // have created it; we never lower a snapshot that was already
    // taken at a higher amount.
    return { amountCents: 0, currency: event.currency, skipped: true };
  }

  const existing = await tx.registration.findUnique({
    where: { eventId_userId: { eventId: args.eventId, userId: args.userId } },
    select: { id: true, status: true, refundedCents: true },
  });

  // Never overwrite a Registration that is already PAID / REFUNDED /
  // FORFEITED / CANCELLED. The amount was locked in at charge time
  // and re-computing it now would silently change history.
  if (
    existing &&
    (existing.status === RegistrationStatus.PAID ||
      existing.status === RegistrationStatus.REFUNDED ||
      existing.status === RegistrationStatus.FORFEITED ||
      existing.status === RegistrationStatus.CANCELLED)
  ) {
    return {
      amountCents: breakdown.amountCents,
      currency: event.currency,
      skipped: true,
    };
  }

  await tx.registration.upsert({
    where: { eventId_userId: { eventId: args.eventId, userId: args.userId } },
    update: {
      amountCents: breakdown.amountCents,
      householdId: args.householdId,
    },
    create: {
      eventId: args.eventId,
      userId: args.userId,
      householdId: args.householdId,
      amountCents: breakdown.amountCents,
      currency: event.currency,
      status: RegistrationStatus.PENDING,
    },
  });

  return {
    amountCents: breakdown.amountCents,
    currency: event.currency,
    skipped: false,
  };
}

export const rsvpRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        eventId: z.string(),
        headcount: z.number().int().min(0).default(0),
        dietaryNotes: z.string().optional(),
        memberAttendances: z.array(z.unknown()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
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

      const attendances = (input.memberAttendances as MemberAttendanceInput[] | undefined) ?? [];
      const headcount = deriveHeadcount(attendances, input.headcount);

      const rsvp = await prisma.$transaction(async (tx) => {
        const upserted = await tx.rSVP.create({
          data: {
            eventId: input.eventId,
            userId: ctx.session.user.id,
            householdId: caller.householdId,
            status: RSVPStatus.CONFIRMED,
            headcount,
            dietaryNotes: input.dietaryNotes ?? null,
            respondedAt: new Date(),
          },
        });
        if (attendances.length > 0) {
          await resolveAndPersistAttendances(tx, {
            rsvpId: upserted.id,
            householdId: caller.householdId,
            attendances,
          });
        }
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
          dietaryNotes: input.dietaryNotes ?? null,
        },
      });

      let resolvedAttendanceForFee: ResolvedAttendanceRow[] | null = null;
      if (attendances !== undefined) {
        if (attendances.length === 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Mark attendance for at least one member',
          });
        }
        const persisted = await resolveAndPersistAttendances(tx, {
          rsvpId: after.id,
          householdId,
          attendances,
        });
        resolvedAttendanceForFee = persisted.rows as ResolvedAttendanceRow[];
      } else if (before.memberAttendances) {
        // No new attendance list sent — re-use the prior snapshot so
        // an edit that only changes dietary notes still recomputes the
        // fee against the same roster the user agreed to.
        resolvedAttendanceForFee = before.memberAttendances.map((a) => ({
          householdMemberId: a.householdMemberId,
          memberName: a.memberNameSnapshot,
          memberAge: a.memberAgeSnapshot,
          attending: a.attending,
          isHistorical: false,
        }));
      }

      if (resolvedAttendanceForFee) {
        await syncRegistrationFee(tx, {
          eventId: input.eventId,
          userId: ctx.session.user.id,
          householdId,
          event: {
            registrationFeeCents: event.registrationFeeCents,
            registrationFeeMinAge: event.registrationFeeMinAge,
            currency: event.currency,
          },
          attendanceRows: resolvedAttendanceForFee,
        });
      }

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
          dietaryNotes: before.dietaryNotes,
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
          dietaryNotes: after.dietaryNotes,
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
              dietaryNotes: before.dietaryNotes,
              memberAttendances: (before.memberAttendances ?? []).map((a) => ({
                householdMemberId: a.householdMemberId,
                memberName: a.memberNameSnapshot,
                memberAge: a.memberAgeSnapshot,
                attending: a.attending,
              })),
            },
            newValue: {
              headcount: after.headcount,
              dietaryNotes: after.dietaryNotes,
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
          dietaryNotes: input.dietaryNotes ?? null,
          respondedAt: new Date(),
          waitlistPosition: isWaitlisted ? waitlistPosition : null,
        },
        create: {
          eventId: input.eventId,
          userId: ctx.session.user.id,
          householdId,
          status: isWaitlisted ? RSVPStatus.WAITLISTED : RSVPStatus.CONFIRMED,
          headcount: tentativeHeadcount,
          dietaryNotes: input.dietaryNotes ?? null,
          respondedAt: new Date(),
          waitlistPosition: isWaitlisted ? waitlistPosition : null,
        },
      });

      let resolvedAttendanceForFee: ResolvedAttendanceRow[] | null = null;
      if (attendances !== undefined) {
        if (attendances.length === 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Mark attendance for at least one member',
          });
        }
        const persisted = await resolveAndPersistAttendances(tx, {
          rsvpId: upserted.id,
          householdId,
          attendances,
        });
        resolvedAttendanceForFee = persisted.rows as ResolvedAttendanceRow[];
      } else if (before?.memberAttendances) {
        // No new attendance list sent — re-use the prior snapshot so
        // an edit that only changes dietary notes still recomputes the
        // fee against the same roster the user agreed to.
        resolvedAttendanceForFee = before.memberAttendances.map((a) => ({
          householdMemberId: a.householdMemberId,
          memberName: a.memberNameSnapshot,
          memberAge: a.memberAgeSnapshot,
          attending: a.attending,
          isHistorical: false,
        }));
      }

      if (resolvedAttendanceForFee) {
        await syncRegistrationFee(tx, {
          eventId: input.eventId,
          userId: ctx.session.user.id,
          householdId,
          event: {
            registrationFeeCents: event.registrationFeeCents,
            registrationFeeMinAge: event.registrationFeeMinAge,
            currency: event.currency,
          },
          attendanceRows: resolvedAttendanceForFee,
        });
      }

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
            dietaryNotes: before.dietaryNotes,
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
            dietaryNotes: upserted.dietaryNotes,
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
                dietaryNotes: before.dietaryNotes,
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
                dietaryNotes: upserted.dietaryNotes,
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

    triggerWorkflow(
      input.eventId,
      ctx.session.user.id,
      'confirm',
      tentativeHeadcount,
      input.dietaryNotes,
    );

    return { ...rsvp, isWaitlisted, waitlistPosition };
  }),

  decline: protectedProcedure.input(rsvpDeclineSchema).mutation(async ({ ctx, input }) => {
    const caller = await loadCallerHousehold(ctx.session.user.id);
    const householdId = caller.householdId;

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
          dietaryNotes: null,
          respondedAt: new Date(),
          waitlistPosition: null,
        },
        create: {
          eventId: input.eventId,
          userId: ctx.session.user.id,
          householdId,
          status: RSVPStatus.DECLINED,
          headcount: 0,
          dietaryNotes: null,
          respondedAt: new Date(),
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
              dietaryNotes: existingRsvp.dietaryNotes,
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
              dietaryNotes: updated.dietaryNotes,
              waitlistPosition: updated.waitlistPosition,
              slotsReleased: existingRsvp.potluckSignups.length,
              memberAttendances: (existingRsvp.memberAttendances ?? []).map((a) => ({
                householdMemberId: a.householdMemberId,
                memberName: a.memberNameSnapshot,
                memberAge: a.memberAgeSnapshot,
                attending: RsvpAttending.NO,
              })),
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

    triggerWorkflow(input.eventId, ctx.session.user.id, 'decline');

    return declined;
  }),

  adminOverride: auditedAdminProcedure
    .input(rsvpAdminOverrideSchema)
    .mutation(async ({ input }) => {
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

      return prisma.$transaction(async (tx) => {
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
            dietaryNotes: input.dietaryNotes ?? null,
            respondedAt: new Date(),
          },
          create: {
            eventId: input.eventId,
            userId: input.userId,
            householdId,
            status: input.status,
            headcount,
            dietaryNotes: input.dietaryNotes ?? null,
            respondedAt: new Date(),
          },
        });

        let resolvedAttendanceForFee: ResolvedAttendanceRow[] | null = null;
        if (attendances !== undefined) {
          if (attendances.length === 0) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Mark attendance for at least one member',
            });
          }
          const persisted = await resolveAndPersistAttendances(tx, {
            rsvpId: upserted.id,
            householdId,
            attendances,
          });
          resolvedAttendanceForFee = persisted.rows as ResolvedAttendanceRow[];
        } else if (before?.memberAttendances) {
          resolvedAttendanceForFee = before.memberAttendances.map((a) => ({
            householdMemberId: a.householdMemberId,
            memberName: a.memberNameSnapshot,
            memberAge: a.memberAgeSnapshot,
            attending: a.attending,
            isHistorical: false,
          }));
        }

        if (resolvedAttendanceForFee) {
          await syncRegistrationFee(tx, {
            eventId: input.eventId,
            userId: input.userId,
            householdId,
            event: {
              registrationFeeCents: event.registrationFeeCents,
              registrationFeeMinAge: event.registrationFeeMinAge,
              currency: event.currency,
            },
            attendanceRows: resolvedAttendanceForFee,
          });
        }

        return upserted;
      });
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
   */
  getByEvent: auditedAdminProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ input }) => {
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
   */
  getRsvpFormState: protectedProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ ctx, input }) => {
      const caller = await prisma.user.findUnique({
        where: { id: ctx.session.user.id },
        select: { id: true, householdId: true },
      });
      if (!caller) return null;

      const householdId = caller.householdId ?? caller.id;

      const [members, rsvp] = await Promise.all([
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
      ]);

      return { members, rsvp, householdId };
    }),
});
