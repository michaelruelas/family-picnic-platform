import { router, auditedAdminProcedure, protectedProcedure } from '~/lib/trpc';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { prisma } from '~/lib/prisma';
import {
  CommunicationStatus,
  CommunicationChannel,
  CommunicationPreference,
  RSVPStatus,
} from '~/lib/generated/enums';
import {
  checkAdminBroadcastRateLimit,
  checkRecipientGroupRateLimit,
  checkAllRecipientRateLimits,
  getRateLimitStatus,
  rateLimitError,
} from '~/lib/rate-limit';
import { adminSendSmsInputSchema } from '~/lib/schemas/sms';
import {
  sendSMS,
  getFromPhoneNumber,
  isValidE164,
  isConfigured as twilioConfigured,
} from '~/lib/twilio';

export const communicationRouter = router({
  getRateLimitStatus: auditedAdminProcedure.query(async ({ ctx }) => {
    return getRateLimitStatus(ctx.session.user.id);
  }),

  sendBroadcast: auditedAdminProcedure
    .input(
      z.object({
        eventId: z.string(),
        message: z.string().min(1),
        channel: z.enum([CommunicationChannel.EMAIL, CommunicationChannel.SMS]),
        recipientType: z.enum(['ALL', 'HOUSEHOLD', 'INDIVIDUAL', 'NOT_RESPONDED']),
        recipientIds: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const adminBroadcastResult = await checkAdminBroadcastRateLimit(ctx.session.user.id);
      if (!adminBroadcastResult.allowed) {
        rateLimitError(adminBroadcastResult, 'broadcasts per hour');
      }

      const recipientGroupResult = await checkRecipientGroupRateLimit(
        ctx.session.user.id,
        input.eventId,
        input.recipientType,
        input.recipientIds,
      );
      if (!recipientGroupResult.allowed) {
        rateLimitError(recipientGroupResult, 'broadcasts to same recipient group');
      }

      let recipientUserIds: string[] = [];

      const preferenceFilter = {
        communicationPreference: {
          in:
            input.channel === CommunicationChannel.SMS
              ? [CommunicationPreference.SMS, CommunicationPreference.BOTH]
              : [CommunicationPreference.EMAIL, CommunicationPreference.BOTH],
        },
      };

      switch (input.recipientType) {
        case 'ALL':
          recipientUserIds = (
            await prisma.user.findMany({
              where: { householdId: { not: null }, ...preferenceFilter },
              select: { id: true },
            })
          ).map((u) => u.id);
          break;
        case 'NOT_RESPONDED':
          recipientUserIds = (
            await prisma.user.findMany({
              where: {
                householdId: { not: null },
                ...preferenceFilter,
                rsvps: {
                  none: {
                    eventId: input.eventId,
                    status: { in: [RSVPStatus.CONFIRMED, RSVPStatus.DECLINED] },
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
              where: { householdId: { in: input.recipientIds }, ...preferenceFilter },
              select: { id: true },
            })
          ).map((u) => u.id);
          break;
        case 'INDIVIDUAL':
          if (!input.recipientIds) throw new Error('recipientIds required for INDIVIDUAL type');
          recipientUserIds = input.recipientIds;
          break;
      }

      const recipientLimitResults = await checkAllRecipientRateLimits(recipientUserIds);
      const blockedRecipients = recipientLimitResults.filter((r) => !r.allowed);
      if (blockedRecipients.length > 0) {
        const blockedCount = blockedRecipients.length;
        const totalCount = recipientUserIds.length;
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: `${blockedCount} of ${totalCount} recipients have exceeded the daily message limit (2 messages/day). These recipients cannot receive messages today.`,
          cause: {
            type: 'recipient_rate_limit',
            blockedRecipients: blockedRecipients.map((r) => ({
              userId: r.userId,
              remaining: r.remaining,
            })),
          },
        });
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
        channel: z.enum([CommunicationChannel.EMAIL, CommunicationChannel.SMS]),
        scheduledAt: z.string().datetime(),
        recipientType: z.enum(['ALL', 'HOUSEHOLD', 'INDIVIDUAL', 'NOT_RESPONDED']),
        recipientIds: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const scheduledDate = new Date(input.scheduledAt);
      if (isNaN(scheduledDate.getTime())) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid scheduledAt date',
        });
      }

      const broadcast = await prisma.scheduledBroadcast.create({
        data: {
          eventId: input.eventId,
          sentByUserId: ctx.session.user.id,
          message: input.message,
          channel: input.channel,
          recipientType: input.recipientType,
          recipientIds: input.recipientIds ?? [],
          scheduledAt: scheduledDate,
        },
      });

      return {
        success: true,
        id: broadcast.id,
        scheduledFor: broadcast.scheduledAt.toISOString(),
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
        channel: z.enum([CommunicationChannel.EMAIL, CommunicationChannel.SMS]),
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

  sendSms: auditedAdminProcedure.input(adminSendSmsInputSchema).mutation(async ({ ctx, input }) => {
    if (!twilioConfigured()) {
      throw new TRPCError({
        code: 'SERVICE_UNAVAILABLE',
        message: 'SMS provider not configured',
      });
    }

    const fromPhone = getFromPhoneNumber();
    if (!fromPhone || !isValidE164(fromPhone)) {
      throw new TRPCError({
        code: 'SERVICE_UNAVAILABLE',
        message: 'SMS provider not configured',
      });
    }

    const event = await prisma.event.findUnique({
      where: { id: input.eventId },
      select: { id: true },
    });
    if (!event) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
    }

    const recipient = await prisma.user.findUnique({
      where: { id: input.recipientUserId },
      select: {
        id: true,
        phoneNumber: true,
        smsConsent: true,
      },
    });
    if (!recipient) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Recipient not found' });
    }

    if (!recipient.smsConsent) {
      await prisma.communicationLog.create({
        data: {
          eventId: input.eventId,
          sentByUserId: ctx.session.user.id,
          recipientUserId: recipient.id,
          channel: CommunicationChannel.SMS,
          status: CommunicationStatus.FAILED,
          errorCode: 'NO_CONSENT',
          errorMessage: 'Recipient has not granted SMS consent',
          fromPhoneNumber: fromPhone,
        },
      });
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Recipient has not consented to SMS messages',
      });
    }

    if (!recipient.phoneNumber || !isValidE164(recipient.phoneNumber)) {
      await prisma.communicationLog.create({
        data: {
          eventId: input.eventId,
          sentByUserId: ctx.session.user.id,
          recipientUserId: recipient.id,
          channel: CommunicationChannel.SMS,
          status: CommunicationStatus.FAILED,
          errorCode: 'NO_PHONE',
          errorMessage: 'Recipient has no valid E.164 phone number on file',
          fromPhoneNumber: fromPhone,
        },
      });
      throw new TRPCError({
        code: 'UNPROCESSABLE_CONTENT',
        message: 'Recipient has no valid phone number on file',
      });
    }

    const result = await sendSMS({
      to: recipient.phoneNumber,
      body: input.message,
    });

    const status = result.success ? CommunicationStatus.SENT : CommunicationStatus.FAILED;

    const logRow = await prisma.communicationLog.create({
      data: {
        eventId: input.eventId,
        sentByUserId: ctx.session.user.id,
        recipientUserId: recipient.id,
        channel: CommunicationChannel.SMS,
        messageId: result.messageId,
        toPhoneNumber: recipient.phoneNumber,
        fromPhoneNumber: fromPhone,
        status,
        errorCode: result.errorCode?.toString(),
        errorMessage: result.error,
        deliveredAt: result.success ? new Date() : null,
      },
    });

    if (!result.success) {
      throw new TRPCError({
        code: 'BAD_GATEWAY',
        message: 'SMS provider rejected the message',
        cause: {
          errorCode: result.errorCode,
          communicationLogId: logRow.id,
        },
      });
    }

    return {
      success: true,
      communicationLogId: logRow.id,
      messageId: result.messageId,
    };
  }),
});
