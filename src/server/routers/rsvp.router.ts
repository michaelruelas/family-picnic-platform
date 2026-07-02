import { router, protectedProcedure, auditedAdminProcedure } from '~/lib/trpc';
import { z } from 'zod';
import { prisma } from '~/lib/prisma';
import { RSVPStatus, InvitationStatus } from '~/lib/generated/enums';

export const rsvpRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        eventId: z.string(),
        headcount: z.number().int().min(1).default(1),
        dietaryNotes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const event = await prisma.event.findUnique({
        where: { id: input.eventId },
      });

      if (!event) {
        throw new Error('Event not found');
      }

      if (event.status !== 'PUBLISHED') {
        throw new Error('Event is not accepting RSVPs');
      }

      if (event.rsvpDeadline && new Date(event.rsvpDeadline) < new Date()) {
        throw new Error('RSVP deadline has passed');
      }

      const user = await prisma.user.findUnique({
        where: { id: ctx.session.user.id },
      });

      if (!user) {
        throw new Error('User not found');
      }

      const rsvp = await prisma.rSVP.create({
        data: {
          eventId: input.eventId,
          userId: ctx.session.user.id,
          householdId: user.householdId || user.id,
          status: RSVPStatus.CONFIRMED,
          headcount: input.headcount,
          dietaryNotes: input.dietaryNotes || null,
          respondedAt: new Date(),
        },
      });

      await prisma.invitation.updateMany({
        where: {
          eventId: input.eventId,
          OR: [{ userId: ctx.session.user.id }, { householdId: user.householdId || user.id }],
          status: InvitationStatus.PENDING,
        },
        data: { status: InvitationStatus.USED },
      });

      return rsvp;
    }),

  update: protectedProcedure
    .input(
      z.object({
        eventId: z.string(),
        headcount: z.number().int().min(1),
        dietaryNotes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return prisma.rSVP.update({
        where: {
          eventId_userId: {
            eventId: input.eventId,
            userId: ctx.session.user.id,
          },
        },
        data: {
          headcount: input.headcount,
          dietaryNotes: input.dietaryNotes || null,
        },
      });
    }),

  confirm: protectedProcedure
    .input(
      z.object({
        eventId: z.string(),
        headcount: z.number().int().min(1).default(1),
        dietaryNotes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const event = await prisma.event.findUnique({
        where: { id: input.eventId },
      });

      if (!event) {
        throw new Error('Event not found');
      }

      if (event.status !== 'PUBLISHED') {
        throw new Error('Event is not accepting RSVPs');
      }

      if (event.rsvpDeadline && new Date(event.rsvpDeadline) < new Date()) {
        throw new Error('RSVP deadline has passed');
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

        const totalAfterRsvp = (currentHeadcount._sum.headcount || 0) + input.headcount;
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

      const user = await prisma.user.findUnique({
        where: { id: ctx.session.user.id },
      });

      if (!user) {
        throw new Error('User not found');
      }

      const rsvp = await prisma.rSVP.upsert({
        where: {
          eventId_userId: {
            eventId: input.eventId,
            userId: ctx.session.user.id,
          },
        },
        update: {
          status: isWaitlisted ? RSVPStatus.WAITLISTED : RSVPStatus.CONFIRMED,
          headcount: input.headcount,
          dietaryNotes: input.dietaryNotes || null,
          respondedAt: new Date(),
          waitlistPosition: isWaitlisted ? waitlistPosition : null,
        },
        create: {
          eventId: input.eventId,
          userId: ctx.session.user.id,
          householdId: user.householdId || user.id,
          status: isWaitlisted ? RSVPStatus.WAITLISTED : RSVPStatus.CONFIRMED,
          headcount: input.headcount,
          dietaryNotes: input.dietaryNotes || null,
          respondedAt: new Date(),
          waitlistPosition: isWaitlisted ? waitlistPosition : null,
        },
      });

      if (!isWaitlisted) {
        await prisma.invitation.updateMany({
          where: {
            eventId: input.eventId,
            OR: [{ userId: ctx.session.user.id }, { householdId: user.householdId || user.id }],
            status: InvitationStatus.PENDING,
          },
          data: { status: InvitationStatus.USED },
        });
      }

      return { ...rsvp, isWaitlisted, waitlistPosition };
    }),

  decline: protectedProcedure
    .input(z.object({ eventId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = await prisma.user.findUnique({
        where: { id: ctx.session.user.id },
      });

      if (!user) {
        throw new Error('User not found');
      }

      const existingRsvp = await prisma.rSVP.findUnique({
        where: {
          eventId_userId: {
            eventId: input.eventId,
            userId: ctx.session.user.id,
          },
        },
      });

      const wasConfirmed = existingRsvp?.status === RSVPStatus.CONFIRMED;
      const hadWaitlistPosition = existingRsvp?.waitlistPosition;

      const rsvp = await prisma.rSVP.upsert({
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
          householdId: user.householdId || user.id,
          status: RSVPStatus.DECLINED,
          headcount: 0,
          dietaryNotes: null,
          respondedAt: new Date(),
        },
      });

      if (wasConfirmed) {
        await prisma.$transaction(async (tx) => {
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
          }
        });
      } else if (hadWaitlistPosition) {
        await prisma.rSVP.updateMany({
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

      return rsvp;
    }),

  adminOverride: auditedAdminProcedure
    .input(
      z.object({
        eventId: z.string(),
        userId: z.string(),
        status: z.enum(['CONFIRMED', 'DECLINED']),
        headcount: z.number().int().min(0).optional(),
        dietaryNotes: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const user = await prisma.user.findUnique({
        where: { id: input.userId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      return prisma.rSVP.upsert({
        where: {
          eventId_userId: {
            eventId: input.eventId,
            userId: input.userId,
          },
        },
        update: {
          status: input.status,
          headcount: input.headcount ?? (input.status === 'CONFIRMED' ? 1 : 0),
          dietaryNotes: input.dietaryNotes ?? null,
          respondedAt: new Date(),
        },
        create: {
          eventId: input.eventId,
          userId: input.userId,
          householdId: user.householdId || user.id,
          status: input.status,
          headcount: input.headcount ?? (input.status === 'CONFIRMED' ? 1 : 0),
          dietaryNotes: input.dietaryNotes ?? null,
          respondedAt: new Date(),
        },
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

  getByEvent: protectedProcedure
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
      });
    }),
});
