import { defineWorkflow } from 'openworkflow';
import { prisma } from '~/lib/prisma';
import {
  CommunicationStatus,
  ScheduledBroadcastStatus,
  RSVPStatus,
  EventStatus,
  InvitationStatus,
} from '~/lib/generated/enums';

// ─── Scheduled Broadcast ─────────────────────────────────────────────

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
>({ name: 'scheduled-broadcast-delivery' }, async ({ input, step }) => {
  const recipientUserIds = await step.run({ name: 'resolve-recipients' }, () =>
    resolveRecipients(input.eventId, input.recipientType, input.recipientIds),
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

  const deliveredCount = await step.run({ name: 'create-communication-logs' }, () =>
    createCommunicationLogs(input.eventId, input.sentByUserId, input.channel, recipientUserIds),
  );

  await step.run({ name: 'mark-broadcast-sent' }, () =>
    prisma.scheduledBroadcast.update({
      where: { id: input.broadcastId },
      data: { status: ScheduledBroadcastStatus.SENT, processedAt: new Date() },
    }),
  );

  return { deliveredCount };
});

// ─── RSVP Confirm ────────────────────────────────────────────────────

interface RsvpConfirmInput {
  eventId: string;
  userId: string;
  householdId: string;
  headcount: number;
  dietaryNotes?: string;
}

interface RsvpConfirmOutput {
  status: 'CONFIRMED' | 'WAITLISTED';
  waitlistPosition: number | null;
}

export const rsvpConfirm = defineWorkflow<RsvpConfirmInput, RsvpConfirmOutput>(
  { name: 'rsvp-confirm' },
  async ({ input, step }) => {
    const event = await step.run({ name: 'validate-event' }, () =>
      prisma.event.findUnique({ where: { id: input.eventId } }),
    );

    if (!event) throw new Error('Event not found');
    if (event.status !== EventStatus.PUBLISHED) throw new Error('Event is not accepting RSVPs');
    if (event.rsvpDeadline && new Date(event.rsvpDeadline) < new Date())
      throw new Error('RSVP deadline has passed');

    const { isWaitlisted, waitlistPosition } = await step.run(
      { name: 'check-capacity' },
      async () => {
        if (!event.maxCapacity) {
          return { isWaitlisted: false, waitlistPosition: null };
        }

        const currentHeadcount = await prisma.rSVP.aggregate({
          where: {
            eventId: input.eventId,
            status: RSVPStatus.CONFIRMED,
            userId: { not: input.userId },
          },
          _sum: { headcount: true },
        });

        const totalAfterRsvp = (currentHeadcount._sum.headcount || 0) + input.headcount;
        if (totalAfterRsvp <= event.maxCapacity) {
          return { isWaitlisted: false, waitlistPosition: null };
        }

        const waitlistCount = await prisma.rSVP.count({
          where: { eventId: input.eventId, status: RSVPStatus.WAITLISTED },
        });
        return { isWaitlisted: true, waitlistPosition: waitlistCount + 1 };
      },
    );

    await step.run({ name: 'upsert-rsvp' }, () =>
      prisma.rSVP.upsert({
        where: { eventId_userId: { eventId: input.eventId, userId: input.userId } },
        update: {
          status: isWaitlisted ? RSVPStatus.WAITLISTED : RSVPStatus.CONFIRMED,
          headcount: input.headcount,
          dietaryNotes: input.dietaryNotes || null,
          respondedAt: new Date(),
          waitlistPosition: isWaitlisted ? waitlistPosition : null,
        },
        create: {
          eventId: input.eventId,
          userId: input.userId,
          householdId: input.householdId,
          status: isWaitlisted ? RSVPStatus.WAITLISTED : RSVPStatus.CONFIRMED,
          headcount: input.headcount,
          dietaryNotes: input.dietaryNotes || null,
          respondedAt: new Date(),
          waitlistPosition: isWaitlisted ? waitlistPosition : null,
        },
      }),
    );

    if (!isWaitlisted) {
      await step.run({ name: 'mark-invitations' }, () =>
        prisma.invitation.updateMany({
          where: {
            eventId: input.eventId,
            OR: [{ userId: input.userId }, { householdId: input.householdId }],
            status: InvitationStatus.PENDING,
          },
          data: { status: InvitationStatus.USED },
        }),
      );
    }

    return {
      status: isWaitlisted ? 'WAITLISTED' : 'CONFIRMED',
      waitlistPosition,
    };
  },
);

// ─── RSVP Decline ────────────────────────────────────────────────────

interface RsvpDeclineInput {
  eventId: string;
  userId: string;
  householdId: string;
}

interface RsvpDeclineOutput {
  releasedSlots: number;
  promotedUsers: number;
}

async function promoteWaitlistedUsers(eventId: string, freedHeadcount: number): Promise<number> {
  let promotedCount = 0;
  let remainingCapacity = freedHeadcount;

  while (remainingCapacity > 0) {
    const nextWaitlisted = await prisma.rSVP.findFirst({
      where: { eventId, status: RSVPStatus.WAITLISTED },
      orderBy: { waitlistPosition: 'asc' },
    });

    if (!nextWaitlisted) break;

    const userHeadcount = nextWaitlisted.headcount;
    if (userHeadcount > remainingCapacity) break;

    await prisma.$transaction(async (tx) => {
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
          eventId,
          status: RSVPStatus.WAITLISTED,
          waitlistPosition: { gt: nextWaitlisted.waitlistPosition! },
        },
        data: { waitlistPosition: { decrement: 1 } },
      });

      await tx.adminAuditLog.create({
        data: {
          userId: nextWaitlisted.userId,
          eventId,
          action: 'WAITLIST_PROMOTION',
          oldValue: { status: RSVPStatus.WAITLISTED, position: nextWaitlisted.waitlistPosition },
          newValue: { status: RSVPStatus.CONFIRMED },
        },
      });
    });

    promotedCount++;
    remainingCapacity -= userHeadcount;
  }

  return promotedCount;
}

export const rsvpDecline = defineWorkflow<RsvpDeclineInput, RsvpDeclineOutput>(
  { name: 'rsvp-decline' },
  async ({ input, step }) => {
    const existingRsvp = await step.run({ name: 'fetch-existing-rsvp' }, () =>
      prisma.rSVP.findUnique({
        where: { eventId_userId: { eventId: input.eventId, userId: input.userId } },
        include: { potluckSignups: { include: { slot: true } } },
      }),
    );

    const wasConfirmed = existingRsvp?.status === RSVPStatus.CONFIRMED;
    const freedHeadcount = existingRsvp?.headcount || 0;

    const relesedSlotCount = await step.run({ name: 'release-potluck-slots' }, async () => {
      if (!existingRsvp?.potluckSignups?.length) return 0;

      await prisma.$transaction(async (tx) => {
        for (const signup of existingRsvp.potluckSignups) {
          await tx.potluckSlot.update({
            where: { id: signup.slotId },
            data: { currentSignups: { decrement: signup.servings } },
          });
        }
        await tx.potluckSignup.deleteMany({ where: { rsvpId: existingRsvp.id } });
      });
      return existingRsvp.potluckSignups.length;
    });

    await step.run({ name: 'update-rsvp-to-declined' }, () =>
      prisma.rSVP.upsert({
        where: { eventId_userId: { eventId: input.eventId, userId: input.userId } },
        update: {
          status: RSVPStatus.DECLINED,
          headcount: 0,
          dietaryNotes: null,
          respondedAt: new Date(),
          waitlistPosition: null,
        },
        create: {
          eventId: input.eventId,
          userId: input.userId,
          householdId: input.householdId,
          status: RSVPStatus.DECLINED,
          headcount: 0,
          respondedAt: new Date(),
        },
      }),
    );

    await step.run({ name: 'write-release-audit-log' }, () =>
      prisma.adminAuditLog.create({
        data: {
          userId: input.userId,
          eventId: input.eventId,
          action: 'POTLUCK_SLOT_RELEASE',
          oldValue: { status: existingRsvp?.status, headcount: existingRsvp?.headcount },
          newValue: {
            status: RSVPStatus.DECLINED,
            headcount: 0,
            slotsReleased: relesedSlotCount,
          },
        },
      }),
    );

    let promotedUsers = 0;
    if (wasConfirmed && freedHeadcount > 0) {
      promotedUsers = await step.run({ name: 'promote-waitlisted-users' }, () =>
        promoteWaitlistedUsers(input.eventId, freedHeadcount),
      );
    } else if (existingRsvp?.waitlistPosition) {
      await step.run({ name: 'shift-waitlist-positions' }, () =>
        prisma.rSVP.updateMany({
          where: {
            eventId: input.eventId,
            status: RSVPStatus.WAITLISTED,
            waitlistPosition: { gt: existingRsvp.waitlistPosition! },
          },
          data: { waitlistPosition: { decrement: 1 } },
        }),
      );
    }

    return { releasedSlots: relesedSlotCount, promotedUsers };
  },
);

// ─── Deliver Communications ──────────────────────────────────────────

interface DeliverCommunicationsOutput {
  delivered: number;
  failed: number;
}

async function deliverOne(log: { id: string; channel: string }): Promise<boolean> {
  try {
    await prisma.communicationLog.update({
      where: { id: log.id },
      data: { status: CommunicationStatus.SENT, deliveredAt: new Date() },
    });
    return true;
  } catch {
    await prisma.communicationLog.update({
      where: { id: log.id },
      data: { status: CommunicationStatus.FAILED },
    });
    return false;
  }
}

export const deliverCommunications = defineWorkflow<void, DeliverCommunicationsOutput>(
  { name: 'deliver-communications' },
  async ({ step }) => {
    const queued = await step.run({ name: 'fetch-queued' }, () =>
      prisma.communicationLog.findMany({
        where: { status: CommunicationStatus.QUEUED },
        take: 20,
        select: { id: true, channel: true },
      }),
    );

    if (queued.length === 0) return { delivered: 0, failed: 0 };

    const results = await Promise.all(
      queued.map((log) => step.run({ name: `deliver-${log.id}` }, () => deliverOne(log))),
    );

    const delivered = results.filter(Boolean).length;
    return { delivered, failed: queued.length - delivered };
  },
);
