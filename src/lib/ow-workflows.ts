import { defineWorkflow } from 'openworkflow';
import { prisma } from '~/lib/prisma';
import {
  CommunicationStatus,
  ScheduledBroadcastStatus,
  RSVPStatus,
  EventStatus,
  InvitationStatus,
  CommunicationLogKind,
  CommunicationPreference,
} from '~/lib/generated/enums';
import { sendEmail } from '~/lib/twilio-email';
import { sendSMS, isValidE164, isConfigured as twilioConfigured } from '~/lib/twilio';
import { writeAuditLog } from '~/lib/audit';
import { logger } from '~/lib/logger';

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
  channel: 'EMAIL' | 'SMS',
  recipientIds?: string[],
): Promise<string[]> {
  const consentFilter =
    channel === 'SMS'
      ? {
          communicationPreference: {
            in: [CommunicationPreference.SMS, CommunicationPreference.BOTH],
          },
          smsConsent: true,
        }
      : {
          communicationPreference: {
            in: [CommunicationPreference.EMAIL, CommunicationPreference.BOTH],
          },
        };

  switch (recipientType) {
    case 'ALL': {
      const users = await prisma.user.findMany({
        where: { householdId: { not: null }, ...consentFilter },
        select: { id: true },
      });
      return users.map((u) => u.id);
    }
    case 'NOT_RESPONDED': {
      const users = await prisma.user.findMany({
        where: {
          householdId: { not: null },
          ...consentFilter,
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
        where: { householdId: { in: householdIds }, ...consentFilter },
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
    resolveRecipients(input.eventId, input.recipientType, input.channel, input.recipientIds),
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
          respondedAt: new Date(),
          waitlistPosition: isWaitlisted ? waitlistPosition : null,
        },
        create: {
          eventId: input.eventId,
          userId: input.userId,
          householdId: input.householdId,
          status: isWaitlisted ? RSVPStatus.WAITLISTED : RSVPStatus.CONFIRMED,
          headcount: input.headcount,
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
            data: { currentSignups: { decrement: 1 } },
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
  skipped: number;
}

interface DeliverLogRow {
  id: string;
  channel: 'EMAIL' | 'SMS';
  body: string | null;
  kind: CommunicationLogKind;
  recipientUserId: string | null;
  eventId: string;
  sentByUserId: string;
}

interface DeliverOutcome {
  status: 'SENT' | 'FAILED' | 'SKIPPED';
}

export type { DeliverLogRow, DeliverOutcome };

/**
 * FPP-86: SMS dispatch is gated behind TWILIO_ENABLED=true. When unset
 * or false, queued SMS rows are marked FAILED with reason
 * `sms_disabled_for_launch` (the FPP-101 inert behavior). When true,
 * the branch honors user.smsConsent, validates the recipient phone
 * number, and dispatches via the existing src/lib/twilio.ts wrapper.
 *
 * FPP-86 writes per-recipient AdminAuditLog entries for SMS sends
 * (both success and failure). SMS is a regulated channel (TCPA), so
 * each admin-initiated send must be individually traceable. The
 * ad-hoc admin SMS path (`dispatchAdminSms` in src/lib/sms-dispatch.ts)
 * also writes per-recipient audit entries for the same reason. Email
 * broadcasts do not write per-recipient audit entries; the
 * `auditedAdminProcedure` on `sendBroadcast` captures the admin action
 * at creation time, and the CommunicationLog itself is the per-recipient
 * record.
 */
function subjectForKind(kind: CommunicationLogKind): string {
  switch (kind) {
    case CommunicationLogKind.INVITATION:
      return 'You are invited to the Family Picnic';
    case CommunicationLogKind.DECLINE_NOTE:
      return 'Decline note forwarded';
    case CommunicationLogKind.BROADCAST:
    default:
      return 'Family Picnic update';
  }
}

async function deliverSms(log: DeliverLogRow): Promise<DeliverOutcome> {
  if (process.env.TWILIO_ENABLED !== 'true') {
    logger.warn(
      { logId: log.id, recipientUserId: log.recipientUserId, eventId: log.eventId },
      'SMS delivery inert: sms_disabled_for_launch',
    );
    await prisma.communicationLog.update({
      where: { id: log.id },
      data: {
        status: CommunicationStatus.FAILED,
        errorCode: 'SMS_DISABLED_FOR_LAUNCH',
        errorMessage: 'sms_disabled_for_launch',
      },
    });
    return { status: 'FAILED' };
  }

  if (!twilioConfigured()) {
    logger.error(
      { logId: log.id, eventId: log.eventId },
      'TWILIO_ENABLED=true but Twilio credentials are missing',
    );
    await prisma.communicationLog.update({
      where: { id: log.id },
      data: {
        status: CommunicationStatus.FAILED,
        errorCode: 'TWILIO_NOT_CONFIGURED',
        errorMessage: 'TWILIO_ENABLED is true but Twilio credentials are missing',
      },
    });
    await writeAuditLog({
      userId: log.sentByUserId,
      eventId: log.eventId,
      action: 'communication.workerSmsDeliver',
      oldValue: { logId: log.id, recipientUserId: log.recipientUserId },
      newValue: { status: 'FAILED', error: 'TWILIO_NOT_CONFIGURED' },
    });
    return { status: 'FAILED' };
  }

  if (!log.recipientUserId) {
    await prisma.communicationLog.update({
      where: { id: log.id },
      data: {
        status: CommunicationStatus.SKIPPED,
        errorCode: 'NO_RECIPIENT',
        errorMessage: 'CommunicationLog has no recipientUserId',
      },
    });
    return { status: 'SKIPPED' };
  }

  const recipient = await prisma.user.findUnique({
    where: { id: log.recipientUserId },
    select: { phoneNumber: true, smsConsent: true },
  });

  if (!recipient) {
    await prisma.communicationLog.update({
      where: { id: log.id },
      data: {
        status: CommunicationStatus.SKIPPED,
        errorCode: 'NO_RECIPIENT',
        errorMessage: 'Recipient user not found',
      },
    });
    return { status: 'SKIPPED' };
  }

  if (!recipient.smsConsent) {
    await prisma.communicationLog.update({
      where: { id: log.id },
      data: {
        status: CommunicationStatus.SKIPPED,
        errorCode: 'NO_CONSENT',
        errorMessage: 'Recipient has not granted SMS consent',
      },
    });
    await writeAuditLog({
      userId: log.sentByUserId,
      eventId: log.eventId,
      action: 'communication.workerSmsDeliver',
      oldValue: { logId: log.id, recipientUserId: log.recipientUserId },
      newValue: { status: 'SKIPPED', error: 'NO_CONSENT' },
    });
    return { status: 'SKIPPED' };
  }

  if (!recipient.phoneNumber || !isValidE164(recipient.phoneNumber)) {
    await prisma.communicationLog.update({
      where: { id: log.id },
      data: {
        status: CommunicationStatus.SKIPPED,
        errorCode: 'NO_PHONE',
        errorMessage: 'Recipient has no valid E.164 phone number on file',
      },
    });
    await writeAuditLog({
      userId: log.sentByUserId,
      eventId: log.eventId,
      action: 'communication.workerSmsDeliver',
      oldValue: { logId: log.id, recipientUserId: log.recipientUserId },
      newValue: { status: 'SKIPPED', error: 'NO_PHONE' },
    });
    return { status: 'SKIPPED' };
  }

  const result = await sendSMS({ to: recipient.phoneNumber, body: log.body ?? '' });

  if (result.success) {
    await prisma.communicationLog.update({
      where: { id: log.id },
      data: {
        status: CommunicationStatus.SENT,
        messageId: result.messageId,
        toPhoneNumber: recipient.phoneNumber,
        deliveredAt: new Date(),
        errorCode: null,
        errorMessage: null,
      },
    });
    await writeAuditLog({
      userId: log.sentByUserId,
      eventId: log.eventId,
      action: 'communication.workerSmsDeliver',
      oldValue: { logId: log.id, recipientUserId: log.recipientUserId },
      newValue: {
        status: 'SENT',
        ...(result.messageId ? { messageId: result.messageId } : {}),
      },
    });
    return { status: 'SENT' };
  }

  await prisma.communicationLog.update({
    where: { id: log.id },
    data: {
      status: CommunicationStatus.FAILED,
      toPhoneNumber: recipient.phoneNumber,
      errorCode: result.errorCode?.toString() ?? 'TWILIO_ERROR',
      errorMessage: result.error ?? 'Twilio send failed',
    },
  });
  await writeAuditLog({
    userId: log.sentByUserId,
    eventId: log.eventId,
    action: 'communication.workerSmsDeliver',
    oldValue: { logId: log.id, recipientUserId: log.recipientUserId },
    newValue: {
      status: 'FAILED',
      ...(result.error ? { error: result.error } : {}),
      ...(result.errorCode ? { errorCode: String(result.errorCode) } : {}),
    },
  });
  return { status: 'FAILED' };
}

export async function deliverOne(log: DeliverLogRow): Promise<DeliverOutcome> {
  if (log.channel === 'SMS') {
    return deliverSms(log);
  }

  // EMAIL path
  if (!log.recipientUserId) {
    await prisma.communicationLog.update({
      where: { id: log.id },
      data: {
        status: CommunicationStatus.SKIPPED,
        errorCode: 'NO_RECIPIENT',
        errorMessage: 'CommunicationLog has no recipientUserId',
      },
    });
    return { status: 'SKIPPED' };
  }

  const recipient = await prisma.user.findUnique({
    where: { id: log.recipientUserId },
    select: { email: true, communicationPreference: true },
  });

  if (!recipient?.email) {
    await prisma.communicationLog.update({
      where: { id: log.id },
      data: {
        status: CommunicationStatus.SKIPPED,
        errorCode: 'NO_EMAIL',
        errorMessage: 'Recipient has no email on file',
      },
    });
    return { status: 'SKIPPED' };
  }

  if (recipient.communicationPreference === 'NONE') {
    await prisma.communicationLog.update({
      where: { id: log.id },
      data: {
        status: CommunicationStatus.SKIPPED,
        errorCode: 'OPTED_OUT',
        errorMessage: 'Recipient opted out of communications',
      },
    });
    return { status: 'SKIPPED' };
  }

  const result = await sendEmail({
    to: recipient.email,
    subject: subjectForKind(log.kind),
    html: log.body ?? '',
    text: log.body ?? '',
  });

  if (result.success) {
    await prisma.communicationLog.update({
      where: { id: log.id },
      data: {
        status: CommunicationStatus.SENT,
        messageId: result.messageId,
        deliveredAt: new Date(),
        errorCode: null,
        errorMessage: null,
      },
    });
    return { status: 'SENT' };
  }

  await prisma.communicationLog.update({
    where: { id: log.id },
    data: {
      status: CommunicationStatus.FAILED,
      errorCode: 'TWILIO_EMAIL_ERROR',
      errorMessage: result.error ?? 'Twilio Email send failed',
    },
  });
  return { status: 'FAILED' };
}

export const deliverCommunications = defineWorkflow<void, DeliverCommunicationsOutput>(
  { name: 'deliver-communications' },
  async ({ step }) => {
    const queued = await step.run({ name: 'fetch-queued' }, () =>
      prisma.communicationLog.findMany({
        where: { status: CommunicationStatus.QUEUED },
        take: 20,
        select: {
          id: true,
          channel: true,
          body: true,
          kind: true,
          recipientUserId: true,
          eventId: true,
          sentByUserId: true,
        },
      }),
    );

    if (queued.length === 0) return { delivered: 0, failed: 0, skipped: 0 };

    const results = await Promise.all(
      queued.map((log) => step.run({ name: `deliver-${log.id}` }, () => deliverOne(log))),
    );

    const delivered = results.filter((r) => r.status === 'SENT').length;
    const failed = results.filter((r) => r.status === 'FAILED').length;
    const skipped = results.filter((r) => r.status === 'SKIPPED').length;
    return { delivered, failed, skipped };
  },
);
