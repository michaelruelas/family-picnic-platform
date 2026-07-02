import { router, auditedAdminProcedure, protectedProcedure } from '~/lib/trpc';
import { z } from 'zod';
import { prisma } from '~/lib/prisma';
import { CommunicationStatus, CommunicationChannel } from '~/lib/generated/enums';

export const communicationRouter = router({
  sendBroadcast: auditedAdminProcedure
    .input(
      z.object({
        eventId: z.string(),
        message: z.string().min(1),
        channel: z.enum(['EMAIL', 'SMS']),
        recipientType: z.enum(['ALL', 'HOUSEHOLD', 'INDIVIDUAL', 'NOT_RESPONDED']),
        recipientIds: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      let recipientUserIds: string[] = [];

      switch (input.recipientType) {
        case 'ALL':
          recipientUserIds = (
            await prisma.user.findMany({
              where: { householdId: { not: null } },
              select: { id: true },
            })
          ).map((u) => u.id);
          break;
        case 'NOT_RESPONDED':
          recipientUserIds = (
            await prisma.user.findMany({
              where: {
                householdId: { not: null },
                rsvps: {
                  none: {
                    eventId: input.eventId,
                    status: { in: ['CONFIRMED', 'DECLINED'] },
                  },
                },
              },
              select: { id: true },
            })
          ).map((u) => u.id);
          break;
        case 'HOUSEHOLD':
          if (!input.recipientIds) throw new Error('recipientIds required for HOUSEHOLD type');
          recipientUserIds = (
            await prisma.user.findMany({
              where: { householdId: { in: input.recipientIds } },
              select: { id: true },
            })
          ).map((u) => u.id);
          break;
        case 'INDIVIDUAL':
          if (!input.recipientIds) throw new Error('recipientIds required for INDIVIDUAL type');
          recipientUserIds = input.recipientIds;
          break;
      }

      const logs = await Promise.all(
        recipientUserIds.map((userId) =>
          prisma.communicationLog.create({
            data: {
              eventId: input.eventId,
              sentByUserId: ctx.session.user.id,
              recipientUserId: userId,
              channel: input.channel,
              status: CommunicationStatus.QUEUED,
            },
          }),
        ),
      );

      return { success: true, count: logs.length };
    }),

  scheduleMessage: auditedAdminProcedure
    .input(
      z.object({
        eventId: z.string(),
        message: z.string().min(1),
        channel: z.enum(['EMAIL', 'SMS']),
        scheduledAt: z.string().datetime(),
        recipientType: z.enum(['ALL', 'HOUSEHOLD', 'INDIVIDUAL', 'NOT_RESPONDED']),
        recipientIds: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      return {
        success: true,
        message: 'Message scheduled',
        scheduledFor: input.scheduledAt,
      };
    }),

  getDeliveryStatus: auditedAdminProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ input }) => {
      return prisma.communicationLog.findMany({
        where: { eventId: input.eventId },
        include: {
          recipient: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { attemptedAt: 'desc' },
      });
    }),

  unsubscribe: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
        channel: z.enum(['EMAIL', 'SMS']),
        eventId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.session.user.id !== input.userId) {
        throw new Error('Unauthorized');
      }

      let eventId = input.eventId;
      if (!eventId) {
        const latestEvent = await prisma.event.findFirst({
          orderBy: { date: 'desc' },
          select: { id: true },
        });
        eventId = latestEvent?.id;
      }

      if (input.channel === 'SMS') {
        await prisma.user.update({
          where: { id: input.userId },
          data: { communicationPreference: 'EMAIL' },
        });
      } else {
        await prisma.user.update({
          where: { id: input.userId },
          data: { communicationPreference: 'NONE' },
        });
      }

      if (eventId) {
        await prisma.communicationLog.create({
          data: {
            eventId,
            sentByUserId: ctx.session.user.id,
            recipientUserId: input.userId,
            channel: input.channel as CommunicationChannel,
            status: CommunicationStatus.UNSUBSCRIBED,
          },
        });
      }

      return { success: true };
    }),

  getMyPreferences: protectedProcedure.query(async ({ ctx }) => {
    const user = await prisma.user.findUnique({
      where: { id: ctx.session.user.id },
      select: {
        communicationPreference: true,
      },
    });
    return user;
  }),
});
