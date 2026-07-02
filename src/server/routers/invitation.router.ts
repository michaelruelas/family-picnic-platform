import { router, adminProcedure } from '~/lib/trpc';
import { z } from 'zod';
import { prisma } from '~/lib/prisma';
import { InvitationStatus } from '~/lib/generated/enums';

export const invitationRouter = router({
  send: adminProcedure
    .input(
      z.object({
        eventId: z.string(),
        householdId: z.string().optional(),
        userId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!input.householdId && !input.userId) {
        throw new Error('Either householdId or userId must be provided');
      }
      return prisma.invitation.create({
        data: {
          eventId: input.eventId,
          householdId: input.householdId,
          userId: input.userId,
          status: InvitationStatus.PENDING,
          invitedByUserId: ctx.session.user.id,
        },
      });
    }),

  resend: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      return prisma.invitation.update({
        where: { id: input.id },
        data: { status: InvitationStatus.PENDING },
      });
    }),

  trackDelivery: adminProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(['PENDING', 'SENT', 'DELIVERED']),
      }),
    )
    .mutation(async ({ input }) => {
      return prisma.invitation.update({
        where: { id: input.id },
        data: {
          status: input.status,
          sentAt: input.status === 'SENT' ? new Date() : undefined,
        },
      });
    }),

  getByEvent: adminProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ input }) => {
      return prisma.invitation.findMany({
        where: { eventId: input.eventId },
        include: {
          household: true,
          user: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    }),

  getByHousehold: adminProcedure
    .input(z.object({ householdId: z.string() }))
    .query(async ({ input }) => {
      return prisma.invitation.findMany({
        where: { householdId: input.householdId },
        include: {
          event: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    }),
});
