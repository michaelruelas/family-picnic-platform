import { router, protectedProcedure, adminProcedure } from '~/lib/trpc';
import { z } from 'zod';
import { prisma } from '~/lib/prisma';
import { RSVPStatus } from '~/lib/generated/enums';

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

      return prisma.rSVP.create({
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
          const spotsRemaining = event.maxCapacity - (currentHeadcount._sum.headcount || 0);
          throw new Error(
            spotsRemaining <= 0
              ? 'Event is full'
              : `Only ${spotsRemaining} spot${spotsRemaining !== 1 ? 's' : ''} remaining`,
          );
        }
      }

      const user = await prisma.user.findUnique({
        where: { id: ctx.session.user.id },
      });

      if (!user) {
        throw new Error('User not found');
      }

      return prisma.rSVP.upsert({
        where: {
          eventId_userId: {
            eventId: input.eventId,
            userId: ctx.session.user.id,
          },
        },
        update: {
          status: RSVPStatus.CONFIRMED,
          headcount: input.headcount,
          dietaryNotes: input.dietaryNotes || null,
          respondedAt: new Date(),
        },
        create: {
          eventId: input.eventId,
          userId: ctx.session.user.id,
          householdId: user.householdId || user.id,
          status: RSVPStatus.CONFIRMED,
          headcount: input.headcount,
          dietaryNotes: input.dietaryNotes || null,
          respondedAt: new Date(),
        },
      });
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

      return prisma.rSVP.upsert({
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
    }),

  adminOverride: adminProcedure
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
