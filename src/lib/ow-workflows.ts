import { defineWorkflow } from 'openworkflow';
import { prisma } from '~/lib/prisma';
import { CommunicationStatus, ScheduledBroadcastStatus } from '~/lib/generated/enums';

interface ScheduledBroadcastInput {
  broadcastId: string;
  eventId: string;
  message: string;
  channel: 'EMAIL' | 'SMS';
  recipientType: string;
  recipientIds?: string[];
  sentByUserId: string;
}

interface ScheduledBroadcastOutput {
  deliveredCount: number;
}

async function resolveRecipients(
  eventId: string,
  recipientType: string,
  recipientIds?: string[],
): Promise<string[]> {
  switch (recipientType) {
    case 'ALL': {
      const users = await prisma.user.findMany({
        where: { householdId: { not: null } },
        select: { id: true },
      });
      return users.map((u) => u.id);
    }
    case 'NOT_RESPONDED': {
      const users = await prisma.user.findMany({
        where: {
          householdId: { not: null },
          rsvps: {
            none: {
              eventId,
              status: { in: ['CONFIRMED', 'DECLINED'] },
            },
          },
        },
        select: { id: true },
      });
      return users.map((u) => u.id);
    }
    case 'HOUSEHOLD': {
      const householdIds = recipientIds ?? [];
      const users = await prisma.user.findMany({
        where: { householdId: { in: householdIds } },
        select: { id: true },
      });
      return users.map((u) => u.id);
    }
    case 'INDIVIDUAL':
      return recipientIds ?? [];
    default:
      return [];
  }
}

async function createCommunicationLogs(
  eventId: string,
  sentByUserId: string,
  channel: 'EMAIL' | 'SMS',
  recipientUserIds: string[],
): Promise<number> {
  const logs = await Promise.all(
    recipientUserIds.map((userId) =>
      prisma.communicationLog.create({
        data: {
          eventId,
          sentByUserId,
          recipientUserId: userId,
          channel,
          status: CommunicationStatus.QUEUED,
        },
      }),
    ),
  );
  return logs.length;
}

export const scheduledBroadcastDelivery = defineWorkflow<
  ScheduledBroadcastInput,
  ScheduledBroadcastOutput
>(
  { name: 'scheduled-broadcast-delivery' },
  async ({ input, step }) => {
    const recipientUserIds = await step.run(
      { name: 'resolve-recipients' },
      () => resolveRecipients(input.eventId, input.recipientType, input.recipientIds),
    );

    if (recipientUserIds.length === 0) {
      await step.run({ name: 'mark-broadcast-completed' }, () =>
        prisma.scheduledBroadcast.update({
          where: { id: input.broadcastId },
          data: { status: ScheduledBroadcastStatus.SENT, processedAt: new Date() },
        }),
      );
      return { deliveredCount: 0 };
    }

    const deliveredCount = await step.run(
      { name: 'create-communication-logs' },
      () =>
        createCommunicationLogs(
          input.eventId,
          input.sentByUserId,
          input.channel,
          recipientUserIds,
        ),
    );

    await step.run({ name: 'mark-broadcast-sent' }, () =>
      prisma.scheduledBroadcast.update({
        where: { id: input.broadcastId },
        data: { status: ScheduledBroadcastStatus.SENT, processedAt: new Date() },
      }),
    );

    return { deliveredCount };
  },
);