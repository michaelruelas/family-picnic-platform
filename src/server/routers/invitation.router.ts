import { router, auditedAdminProcedure } from '~/lib/trpc';
import { z } from 'zod';
import { prisma } from '~/lib/prisma';
import { InvitationStatus, CommunicationStatus, CommunicationChannel } from '~/lib/generated/enums';
import { generateInvitationToken, getInvitationExpiry } from '~/lib/invitation-token';

export const invitationRouter = router({
  send: auditedAdminProcedure
    .input(
      z.object({
        eventId: z.string(),
        householdId: z.string().optional(),
        userId: z.string().optional(),
        channel: z.enum(['EMAIL', 'SMS']).default('EMAIL'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!input.householdId && !input.userId) {
        throw new Error('Either householdId or userId must be provided');
      }
      const token = generateInvitationToken();
      const expiresAt = getInvitationExpiry(30);
      const invitation = await prisma.invitation.create({
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

      let recipientUserIds: string[] = [];
      if (input.userId) {
        recipientUserIds = [input.userId];
      } else if (input.householdId) {
        const users = await prisma.user.findMany({
          where: { householdId: input.householdId },
          select: { id: true },
        });
        recipientUserIds = users.map((u) => u.id);
      }

      await Promise.all(
        recipientUserIds.map((recipientUserId) =>
          prisma.communicationLog.create({
            data: {
              eventId: input.eventId,
              sentByUserId: ctx.session.user.id,
              recipientUserId,
              channel: input.channel as CommunicationChannel,
              status: CommunicationStatus.QUEUED,
            },
          }),
        ),
      );

      return invitation;
    }),

  resend: auditedAdminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      return prisma.invitation.update({
        where: { id: input.id },
        data: { status: InvitationStatus.PENDING },
      });
    }),

  trackDelivery: auditedAdminProcedure
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
          sentAt: input.status === 'SENT' || input.status === 'DELIVERED' ? new Date() : null,
        },
      });
    }),

  getByEvent: auditedAdminProcedure
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

  getByHousehold: auditedAdminProcedure
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

  consume: auditedAdminProcedure
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
