import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth';
import { prisma } from '~/lib/prisma';
import {
  RSVPStatus,
  EventStatus,
  RsvpAttending,
  AdminPermission,
  CommunicationStatus,
  CommunicationChannel,
} from '~/lib/generated/enums';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { generateRequestId, createRequestLogger } from '~/lib/logger';
import { createTraceContext, runWithTraceContext } from '~/lib/tracing';
import { diff, writeAuditLog } from '~/lib/audit';
import { rsvpMemberAttendanceInputSchema } from '~/lib/schemas';
import { syncRegistrationFee, toFeeAttendees } from '~/lib/registration-fee';
import {
  attendanceFingerprint,
  buildRosterAsNo,
  deriveHeadcount,
  markAllAttendanceNo,
  resolveAndPersistAttendances,
  type MemberAttendanceInput,
} from '~/server/rsvp-attendance';

function normalizeAttendances(
  attendances: MemberAttendanceInput[] | undefined,
): MemberAttendanceInput[] {
  if (!attendances) return [];
  return attendances.map((a) => ({
    householdMemberId: a.householdMemberId ?? null,
    memberName: a.memberName.trim(),
    memberAge: a.memberAge ?? null,
    attending: a.attending,
  }));
}

function hasAnyYes(attendances: MemberAttendanceInput[] | undefined): boolean {
  if (!attendances) return false;
  return attendances.some((a) => a.attending === RsvpAttending.YES);
}

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

function trpcErrorToResponse(err: unknown): NextResponse | null {
  if (err instanceof TRPCError) {
    const status =
      err.code === 'BAD_REQUEST'
        ? 400
        : err.code === 'FORBIDDEN'
          ? 403
          : err.code === 'NOT_FOUND'
            ? 404
            : err.code === 'CONFLICT'
              ? 409
              : 400;
    return NextResponse.json({ error: err.message, code: err.code }, { status });
  }
  return null;
}

export async function POST(request: Request) {
  const requestId = generateRequestId();
  const session = await getServerSession(authOptions);

  const log = createRequestLogger({
    requestId,
    userId: session?.user?.id,
    route: '/api/rsvp',
  });

  return runWithTraceContext(
    createTraceContext(requestId, session?.user?.id, '/api/rsvp'),
    async () => {
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
      }

      let eventId: string | undefined;

      try {
        const body = await request.json();
        const { eventId: reqEventId, action, headcount, memberAttendances, declineMessage } = body;
        eventId = reqEventId;

        if (!eventId || !action) {
          return NextResponse.json(
            { error: 'eventId and action are required', code: 'BAD_REQUEST' },
            { status: 400 },
          );
        }

        if (action === 'confirm') {
          const confirmResult = z
            .object({
              eventId: z.string().min(1),
              headcount: z.number().int().min(0).optional(),
              memberAttendances: z.array(rsvpMemberAttendanceInputSchema).optional(),
            })
            .safeParse({ eventId, headcount, memberAttendances });

          if (!confirmResult.success) {
            const errors = confirmResult.error.issues.map((i) => i.message);
            return NextResponse.json(
              { error: errors[0] || 'Invalid input', code: 'BAD_REQUEST' },
              { status: 400 },
            );
          }
          if (
            confirmResult.data.memberAttendances !== undefined &&
            confirmResult.data.memberAttendances.length === 0
          ) {
            return NextResponse.json(
              { error: 'Mark attendance for at least one member', code: 'BAD_REQUEST' },
              { status: 400 },
            );
          }
          if (
            confirmResult.data.memberAttendances &&
            !hasAnyYes(confirmResult.data.memberAttendances)
          ) {
            return NextResponse.json(
              {
                error:
                  'At least one member must be marked as going. Use the decline button if no one is attending.',
                code: 'BAD_REQUEST',
              },
              { status: 400 },
            );
          }
        } else if (action === 'decline') {
          const declineResult = z
            .object({
              eventId: z.string().min(1),
              declineMessage: z.string().trim().max(1000, 'Decline note is too long').optional(),
            })
            .safeParse({ eventId, declineMessage });

          if (!declineResult.success) {
            const errors = declineResult.error.issues.map((i) => i.message);
            return NextResponse.json(
              { error: errors[0] || 'Invalid input', code: 'BAD_REQUEST' },
              { status: 400 },
            );
          }
        } else {
          return NextResponse.json(
            { error: 'Invalid action', code: 'BAD_REQUEST' },
            { status: 400 },
          );
        }

        const event = await prisma.event.findUnique({
          where: { id: eventId },
          select: {
            id: true,
            status: true,
            rsvpDeadline: true,
            maxCapacity: true,
            registrationFeeCents: true,
            registrationFeeMinAge: true,
            currency: true,
          },
        });

        if (!event) {
          return NextResponse.json(
            { error: 'Event not found', code: 'NOT_FOUND' },
            { status: 404 },
          );
        }

        if (event.status !== EventStatus.PUBLISHED) {
          return NextResponse.json(
            { error: 'Event is not accepting RSVPs', code: 'BAD_REQUEST' },
            { status: 400 },
          );
        }

        if (event.rsvpDeadline && new Date(event.rsvpDeadline) < new Date()) {
          return NextResponse.json(
            { error: 'RSVP deadline has passed', code: 'BAD_REQUEST' },
            { status: 400 },
          );
        }

        if (action === 'confirm' || action === 'decline') {
          const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { id: true, householdId: true },
          });

          if (!user) {
            return NextResponse.json(
              { error: 'User not found', code: 'NOT_FOUND' },
              { status: 404 },
            );
          }

          const householdId = user.householdId ?? user.id;
          const attendances = normalizeAttendances(memberAttendances);
          // FPP-88: optional decline note. Trim and treat an empty
          // string as "no note" so the UI can submit an empty field
          // without a separate branch.
          const trimmedDeclineMessage =
            typeof declineMessage === 'string' ? declineMessage.trim() : '';
          const declineNote = trimmedDeclineMessage.length > 0 ? trimmedDeclineMessage : null;
          const tentativeHeadcount =
            action === 'decline' ? 0 : deriveHeadcount(attendances, headcount);

          if (action === 'confirm' && tentativeHeadcount < 1) {
            return NextResponse.json(
              { error: 'At least one member must be marked as going.', code: 'BAD_REQUEST' },
              { status: 400 },
            );
          }

          if (action === 'confirm' && event.maxCapacity) {
            const currentHeadcount = await prisma.rSVP.aggregate({
              where: {
                eventId,
                status: RSVPStatus.CONFIRMED,
                userId: { not: session.user.id },
              },
              _sum: { headcount: true },
            });

            const totalAfterRsvp = (currentHeadcount._sum.headcount || 0) + tentativeHeadcount;
            if (totalAfterRsvp > event.maxCapacity) {
              const nextPosition = await prisma.rSVP.aggregate({
                where: {
                  eventId,
                  status: RSVPStatus.WAITLISTED,
                },
                _max: { waitlistPosition: true },
              });
              const waitlistPosition = (nextPosition._max.waitlistPosition || 0) + 1;

              await prisma.$transaction(async (tx) => {
                const existingWaitlistRsvp = await tx.rSVP.findUnique({
                  where: {
                    eventId_userId: {
                      eventId: eventId!,
                      userId: session.user.id,
                    },
                  },
                });

                const waitlisted = await tx.rSVP.upsert({
                  where: {
                    eventId_userId: {
                      eventId: eventId!,
                      userId: session.user.id,
                    },
                  },
                  update: {
                    status: RSVPStatus.WAITLISTED,
                    headcount: tentativeHeadcount,
                    respondedAt: new Date(),
                    waitlistPosition,
                  },
                  create: {
                    eventId: eventId!,
                    userId: session.user.id,
                    householdId,
                    status: RSVPStatus.WAITLISTED,
                    headcount: tentativeHeadcount,
                    respondedAt: new Date(),
                    waitlistPosition,
                  },
                });

                if (attendances.length > 0) {
                  await resolveAndPersistAttendances(tx, {
                    rsvpId: waitlisted.id,
                    householdId,
                    attendances,
                  });
                }

                // Sync the registration fee so this entry point matches
                // the tRPC `confirm` / `update` / `adminOverride`
                // procedures. Reload the full snapshot so omitted
                // members still count toward the fee.
                const snapshotForFee = await tx.rSVP.findUnique({
                  where: { id: waitlisted.id },
                  select: { memberAttendances: true },
                });
                await syncRegistrationFee(tx, {
                  eventId: eventId!,
                  userId: session.user.id,
                  householdId,
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

                if (existingWaitlistRsvp) {
                  const change = diff(
                    {
                      status: existingWaitlistRsvp.status,
                      headcount: existingWaitlistRsvp.headcount,
                      waitlistPosition: existingWaitlistRsvp.waitlistPosition,
                    },
                    {
                      status: waitlisted.status,
                      headcount: waitlisted.headcount,
                      waitlistPosition: waitlisted.waitlistPosition,
                    },
                  );

                  if (change) {
                    await writeAuditLog(
                      {
                        userId: session.user.id,
                        eventId: eventId!,
                        action: 'RSVP_UPDATE',
                        oldValue: {
                          status: existingWaitlistRsvp.status,
                          headcount: existingWaitlistRsvp.headcount,
                          waitlistPosition: existingWaitlistRsvp.waitlistPosition,
                        },
                        newValue: {
                          status: waitlisted.status,
                          headcount: waitlisted.headcount,
                          waitlistPosition: waitlisted.waitlistPosition,
                        },
                      },
                      tx,
                    );
                  }
                }
              });

              return NextResponse.json({
                success: true,
                status: RSVPStatus.WAITLISTED,
                waitlistPosition,
              });
            }
          }

          const rsvpData = {
            eventId: eventId!,
            userId: session.user.id,
            householdId,
            status: action === 'confirm' ? RSVPStatus.CONFIRMED : RSVPStatus.DECLINED,
            headcount: tentativeHeadcount,
            respondedAt: new Date(),
            // FPP-88: only set on decline; confirm passes through with null.
            declineMessage: action === 'decline' ? declineNote : null,
          };

          if (action === 'decline') {
            await prisma.$transaction(async (tx) => {
              const existingRsvp = await tx.rSVP.findUnique({
                where: {
                  eventId_userId: {
                    eventId: eventId!,
                    userId: session.user.id,
                  },
                },
                include: {
                  potluckSignups: {
                    include: { slot: true },
                  },
                  memberAttendances: { orderBy: { createdAt: 'asc' } },
                },
              });

              // FPP-88 review: the waitlist promotion must only
              // run when the decliner was previously CONFIRMED.
              // An unconditional promotion (the pre-review
              // behaviour) would let a WAITLISTED decliner
              // trigger a CONFIRMED promotion of the next
              // waitlisted row, inflating the confirmed
              // headcount. Mirror the tRPC gate so both paths
              // stay in lockstep.
              const wasConfirmed = existingRsvp?.status === RSVPStatus.CONFIRMED;
              const hadWaitlistPosition = existingRsvp?.waitlistPosition;

              for (const signup of existingRsvp?.potluckSignups || []) {
                await tx.potluckSlot.update({
                  where: { id: signup.slotId },
                  data: { currentSignups: { decrement: signup.servings } },
                });
              }

              await tx.potluckSignup.deleteMany({
                where: { rsvpId: existingRsvp?.id },
              });

              const declined = await tx.rSVP.upsert({
                where: {
                  eventId_userId: {
                    eventId: eventId!,
                    userId: session.user.id,
                  },
                },
                update: {
                  status: rsvpData.status,
                  headcount: rsvpData.headcount,
                  respondedAt: rsvpData.respondedAt,
                  declineMessage: rsvpData.declineMessage,
                },
                create: rsvpData,
              });

              if (existingRsvp) {
                await markAllAttendanceNo(tx, existingRsvp.id);
              } else {
                const roster = await buildRosterAsNo(tx, householdId);
                if (roster.length > 0) {
                  await tx.rsvpMemberAttendance.createMany({
                    data: roster.map((row) => ({
                      rsvpId: declined.id,
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
                    userId: session.user.id,
                    eventId: eventId!,
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
                    newValue: {
                      status: declined.status,
                      headcount: declined.headcount,
                      waitlistPosition: declined.waitlistPosition,
                      slotsReleased: existingRsvp.potluckSignups.length,
                      // Decline collapses every row to NO; compute
                      // the new value from the old rows.
                      memberAttendances: (existingRsvp.memberAttendances ?? []).map((a) => ({
                        householdMemberId: a.householdMemberId,
                        memberName: a.memberNameSnapshot,
                        memberAge: a.memberAgeSnapshot,
                        attending: RsvpAttending.NO,
                      })),
                      declineMessage: rsvpData.declineMessage,
                    },
                  },
                  tx,
                );
              }

              if (wasConfirmed) {
                const firstWaitlisted = await tx.rSVP.findFirst({
                  where: {
                    eventId: eventId!,
                    status: RSVPStatus.WAITLISTED,
                  },
                  orderBy: { waitlistPosition: 'asc' },
                });

                if (firstWaitlisted) {
                  await tx.rSVP.update({
                    where: { id: firstWaitlisted.id },
                    data: {
                      status: RSVPStatus.CONFIRMED,
                      waitlistPosition: null,
                      respondedAt: new Date(),
                    },
                  });

                  await tx.rSVP.updateMany({
                    where: {
                      eventId: eventId!,
                      status: RSVPStatus.WAITLISTED,
                      waitlistPosition: { gt: firstWaitlisted.waitlistPosition! },
                    },
                    data: {
                      waitlistPosition: { decrement: 1 },
                    },
                  });

                  await tx.adminAuditLog.create({
                    data: {
                      userId: firstWaitlisted.userId,
                      eventId: eventId!,
                      action: 'WAITLIST_PROMOTION',
                      oldValue: {
                        status: RSVPStatus.WAITLISTED,
                        position: firstWaitlisted.waitlistPosition,
                      },
                      newValue: { status: RSVPStatus.CONFIRMED },
                    },
                  });
                }
              } else if (hadWaitlistPosition) {
                // The decliner was on the waitlist, not
                // confirmed. Renumber the rest of the waitlist
                // so positions stay contiguous but do NOT
                // promote anyone (the freed slot does not free
                // a confirmed seat).
                await tx.rSVP.updateMany({
                  where: {
                    eventId: eventId!,
                    status: RSVPStatus.WAITLISTED,
                    waitlistPosition: { gt: hadWaitlistPosition },
                  },
                  data: {
                    waitlistPosition: { decrement: 1 },
                  },
                });
              }
            });

            // FPP-88: forward the decline note to the event owner so
            // the host actually receives it. Mirrors the tRPC
            // router behaviour; both paths stay in lockstep.
            if (declineNote) {
              const owners = await prisma.eventAdmin.findMany({
                where: {
                  eventId: eventId!,
                  role: AdminPermission.OWNER,
                },
                select: { userId: true },
              });

              if (owners.length > 0) {
                await prisma.communicationLog.createMany({
                  data: owners.map((owner) => ({
                    eventId: eventId!,
                    sentByUserId: session.user.id,
                    recipientUserId: owner.userId,
                    channel: CommunicationChannel.EMAIL,
                    status: CommunicationStatus.QUEUED,
                    body: declineNote,
                  })),
                });
              }
            }

            triggerWorkflow(eventId!, session.user.id, 'decline');

            return NextResponse.json({ success: true, status: RSVPStatus.DECLINED });
          }

          await prisma.$transaction(async (tx) => {
            const existingConfirmRsvp = await tx.rSVP.findUnique({
              where: {
                eventId_userId: {
                  eventId: eventId!,
                  userId: session.user.id,
                },
              },
              include: { memberAttendances: { orderBy: { createdAt: 'asc' } } },
            });

            const updatedRsvp = await tx.rSVP.upsert({
              where: {
                eventId_userId: {
                  eventId: eventId!,
                  userId: session.user.id,
                },
              },
              update: {
                status: rsvpData.status,
                headcount: rsvpData.headcount,
                respondedAt: rsvpData.respondedAt,
              },
              create: rsvpData,
            });

            if (attendances.length > 0) {
              await resolveAndPersistAttendances(tx, {
                rsvpId: updatedRsvp.id,
                householdId,
                attendances,
              });
            }

            // Sync the registration fee so this REST entry point
            // matches the tRPC `confirm` / `update` / `adminOverride`
            // procedures. Reload the full snapshot so omitted
            // members still count toward the fee.
            const snapshotForFee = await tx.rSVP.findUnique({
              where: { id: updatedRsvp.id },
              select: { memberAttendances: true },
            });
            await syncRegistrationFee(tx, {
              eventId: eventId!,
              userId: session.user.id,
              householdId,
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

            if (existingConfirmRsvp) {
              const refreshedAfter = await tx.rSVP.findUnique({
                where: { id: updatedRsvp.id },
                include: { memberAttendances: { orderBy: { createdAt: 'asc' } } },
              });
              const finalAttendances = refreshedAfter?.memberAttendances ?? [];
              const beforeFp = attendanceFingerprint(existingConfirmRsvp.memberAttendances);
              const afterFp = attendanceFingerprint(finalAttendances);

              const change = diff(
                {
                  status: existingConfirmRsvp.status,
                  headcount: existingConfirmRsvp.headcount,
                  waitlistPosition: existingConfirmRsvp.waitlistPosition,
                  memberAttendances: (existingConfirmRsvp.memberAttendances ?? []).map((a) => ({
                    householdMemberId: a.householdMemberId,
                    memberName: a.memberNameSnapshot,
                    memberAge: a.memberAgeSnapshot,
                    attending: a.attending,
                  })),
                },
                {
                  status: updatedRsvp.status,
                  headcount: updatedRsvp.headcount,
                  waitlistPosition: updatedRsvp.waitlistPosition,
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
                    userId: session.user.id,
                    eventId: eventId!,
                    action: 'RSVP_UPDATE',
                    oldValue: {
                      status: existingConfirmRsvp.status,
                      headcount: existingConfirmRsvp.headcount,
                      waitlistPosition: existingConfirmRsvp.waitlistPosition,
                      memberAttendances: (existingConfirmRsvp.memberAttendances ?? []).map((a) => ({
                        householdMemberId: a.householdMemberId,
                        memberName: a.memberNameSnapshot,
                        memberAge: a.memberAgeSnapshot,
                        attending: a.attending,
                      })),
                    },
                    newValue: {
                      status: updatedRsvp.status,
                      headcount: updatedRsvp.headcount,
                      waitlistPosition: updatedRsvp.waitlistPosition,
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
          });

          triggerWorkflow(eventId!, session.user.id, 'confirm', tentativeHeadcount);

          return NextResponse.json({ success: true, status: rsvpData.status });
        }

        return NextResponse.json({ error: 'Invalid action', code: 'BAD_REQUEST' }, { status: 400 });
      } catch (error) {
        const mapped = trpcErrorToResponse(error);
        if (mapped) return mapped;
        log.error({ err: error, eventId }, 'RSVP error');
        return NextResponse.json(
          { error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR' },
          { status: 500 },
        );
      }
    },
  );
}
