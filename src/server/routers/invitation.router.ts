import { router, adminProcedure } from '~/lib/trpc';
import { z } from 'zod';
import { prisma } from '~/lib/prisma';
import { InvitationStatus } from '~/lib/generated/enums';
import { generateInvitationToken, getInvitationExpiry } from '~/lib/invitation-token';

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
      const token = generateInvitationToken();
      const expiresAt = getInvitationExpiry(30);
      return prisma.invitation.create({
        data: {
          eventId: input.eventId,
          householdId: input.householdId,
          userId: input.userId,
          status: InvitationStatus.PENDING,
          invitedByUserId: ctx.session.user.id,
          token,
          expiresAt,
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

  consume: adminProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input }) => {
      const invitation = await prisma.invitation.findUnique({
        where: { token: input.token },
      });

      if (!invitation) {
        throw new Error('Invitation not found');
      }

      if (invitation.status === InvitationStatus.USED) {
        throw new Error('This invitation has already been used');
      }

      if (invitation.status === InvitationStatus.EXPIRED) {
        throw new Error('This invitation has expired');
      }

      if (invitation.expiresAt && new Date(invitation.expiresAt) < new Date()) {
        await prisma.invitation.update({
          where: { id: invitation.id },
          data: { status: InvitationStatus.EXPIRED },
        });
        throw new Error('This invitation has expired');
      }

      return prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.USED },
        include: {
          event: true,
          household: true,
          user: true,
        },
      });
    }),
});
