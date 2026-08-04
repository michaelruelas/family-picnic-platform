import { prisma } from '~/lib/prisma';
import { writeAuditLog } from '~/lib/audit';
import {
  sendSMS,
  getFromPhoneNumber,
  isValidE164,
  isConfigured as twilioConfigured,
} from '~/lib/twilio';
import { CommunicationChannel, CommunicationStatus } from '~/lib/generated/enums';

export type DispatchOutcome =
  | {
      kind: 'SENT';
      recipientId: string;
      messageId?: string;
      communicationLogId: string | null;
    }
  | { kind: 'PROVIDER_NOT_CONFIGURED' }
  | { kind: 'RECIPIENT_NOT_FOUND' }
  | {
      kind: 'NO_CONSENT';
      recipientId: string;
      communicationLogId: string | null;
    }
  | {
      kind: 'NO_PHONE';
      recipientId: string;
      communicationLogId: string | null;
    }
  | {
      kind: 'TWILIO_ERROR';
      recipientId: string;
      error: string;
      errorCode?: string | number;
      communicationLogId: string | null;
    };

export type DispatchInput = {
  adminUserId: string;
  recipientUserId: string;
  body: string;
  eventId?: string;
  auditAction: string;
};

export async function dispatchAdminSms(input: DispatchInput): Promise<DispatchOutcome> {
  if (!twilioConfigured()) return { kind: 'PROVIDER_NOT_CONFIGURED' };

  const fromPhone = getFromPhoneNumber();
  if (!fromPhone || !isValidE164(fromPhone)) return { kind: 'PROVIDER_NOT_CONFIGURED' };

  const recipient = await prisma.user.findUnique({
    where: { id: input.recipientUserId },
    select: {
      id: true,
      phoneNumber: true,
      smsConsent: true,
    },
  });
  if (!recipient) return { kind: 'RECIPIENT_NOT_FOUND' };

  const auditBase = {
    userId: input.adminUserId,
    eventId: input.eventId,
    oldValue: { recipientUserId: recipient.id, channel: 'SMS' as const },
  };

  if (!recipient.smsConsent) {
    const communicationLogId = input.eventId
      ? (
          await prisma.communicationLog.create({
            data: {
              eventId: input.eventId,
              sentByUserId: input.adminUserId,
              recipientUserId: recipient.id,
              channel: CommunicationChannel.SMS,
              status: CommunicationStatus.FAILED,
              errorCode: 'NO_CONSENT',
              errorMessage: 'Recipient has not granted SMS consent',
              fromPhoneNumber: fromPhone,
            },
          })
        ).id
      : null;
    await writeAuditLog({
      ...auditBase,
      action: input.auditAction,
      newValue: { status: 'REJECTED', error: 'NO_CONSENT' },
    });
    return { kind: 'NO_CONSENT', recipientId: recipient.id, communicationLogId };
  }

  if (!recipient.phoneNumber || !isValidE164(recipient.phoneNumber)) {
    const communicationLogId = input.eventId
      ? (
          await prisma.communicationLog.create({
            data: {
              eventId: input.eventId,
              sentByUserId: input.adminUserId,
              recipientUserId: recipient.id,
              channel: CommunicationChannel.SMS,
              status: CommunicationStatus.FAILED,
              errorCode: 'NO_PHONE',
              errorMessage: 'Recipient has no valid E.164 phone number on file',
              fromPhoneNumber: fromPhone,
            },
          })
        ).id
      : null;
    await writeAuditLog({
      ...auditBase,
      action: input.auditAction,
      newValue: { status: 'REJECTED', error: 'NO_PHONE' },
    });
    return { kind: 'NO_PHONE', recipientId: recipient.id, communicationLogId };
  }

  const result = await sendSMS({ to: recipient.phoneNumber, body: input.body });
  const status = result.success ? CommunicationStatus.SENT : CommunicationStatus.FAILED;

  const logRow = input.eventId
    ? await prisma.communicationLog.create({
        data: {
          eventId: input.eventId,
          sentByUserId: input.adminUserId,
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
      })
    : null;

  await writeAuditLog({
    ...auditBase,
    action: input.auditAction,
    newValue: {
      status: result.success ? 'SENT' : 'FAILED',
      ...(result.messageId ? { messageId: result.messageId } : {}),
      ...(result.error ? { error: result.error } : {}),
      ...(result.errorCode ? { errorCode: String(result.errorCode) } : {}),
    },
  });

  if (!result.success) {
    return {
      kind: 'TWILIO_ERROR',
      recipientId: recipient.id,
      error: result.error ?? 'Unknown error',
      errorCode: result.errorCode,
      communicationLogId: logRow?.id ?? null,
    };
  }

  return {
    kind: 'SENT',
    recipientId: recipient.id,
    messageId: result.messageId,
    communicationLogId: logRow?.id ?? null,
  };
}
