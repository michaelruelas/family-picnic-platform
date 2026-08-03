import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminApi } from '~/lib/admin-auth';
import { prisma } from '~/lib/prisma';
import { writeAuditLog } from '~/lib/audit';
import { generateRequestId, createRequestLogger } from '~/lib/logger';
import { createTraceContext, runWithTraceContext } from '~/lib/tracing';
import {
  sendSMS,
  getFromPhoneNumber,
  isValidE164,
  isConfigured as twilioConfigured,
} from '~/lib/twilio';
import { CommunicationChannel, CommunicationStatus } from '~/lib/generated/enums';

const smsSendSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  body: z.string().trim().min(1, 'body is required').max(320, 'body exceeds 320 character limit'),
  eventId: z.string().min(1).optional(),
});

export async function POST(request: NextRequest) {
  const requestId = generateRequestId();
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const log = createRequestLogger({
    requestId,
    userId: session.user.id,
    route: '/api/admin/sms/send',
  });

  return runWithTraceContext(
    createTraceContext(requestId, session.user.id, '/api/admin/sms/send'),
    async () => {
      try {
        const json = await request.json().catch(() => null);
        const parsed = smsSendSchema.safeParse(json);
        if (!parsed.success) {
          return NextResponse.json(
            { error: 'Invalid request', issues: parsed.error.flatten() },
            { status: 400 },
          );
        }
        const { userId, body, eventId } = parsed.data;

        if (!twilioConfigured()) {
          return NextResponse.json({ error: 'SMS provider not configured' }, { status: 503 });
        }

        const fromPhone = getFromPhoneNumber();
        if (!fromPhone || !isValidE164(fromPhone)) {
          log.error({ fromPhone }, 'TWILIO_PHONE_NUMBER is missing or invalid');
          return NextResponse.json({ error: 'SMS provider not configured' }, { status: 503 });
        }

        const recipient = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            phoneNumber: true,
            smsConsent: true,
          },
        });
        if (!recipient) {
          return NextResponse.json({ error: 'Recipient not found' }, { status: 404 });
        }

        const adminContext = {
          userId: session.user.id,
          eventId,
          oldValue: { recipientUserId: recipient.id, channel: 'SMS' as const },
        };

        if (!recipient.smsConsent) {
          if (eventId) {
            await prisma.communicationLog.create({
              data: {
                eventId,
                sentByUserId: session.user.id,
                recipientUserId: recipient.id,
                channel: CommunicationChannel.SMS,
                status: CommunicationStatus.FAILED,
                errorCode: 'NO_CONSENT',
                errorMessage: 'Recipient has not granted SMS consent',
                fromPhoneNumber: fromPhone,
              },
            });
          }
          await writeAuditLog({
            ...adminContext,
            action: 'sms.send',
            newValue: { status: 'REJECTED', error: 'NO_CONSENT' },
          });
          return NextResponse.json(
            { error: 'Recipient has not consented to SMS messages' },
            { status: 403 },
          );
        }

        if (!recipient.phoneNumber || !isValidE164(recipient.phoneNumber)) {
          if (eventId) {
            await prisma.communicationLog.create({
              data: {
                eventId,
                sentByUserId: session.user.id,
                recipientUserId: recipient.id,
                channel: CommunicationChannel.SMS,
                status: CommunicationStatus.FAILED,
                errorCode: 'NO_PHONE',
                errorMessage: 'Recipient has no valid E.164 phone number on file',
                fromPhoneNumber: fromPhone,
              },
            });
          }
          await writeAuditLog({
            ...adminContext,
            action: 'sms.send',
            newValue: { status: 'REJECTED', error: 'NO_PHONE' },
          });
          return NextResponse.json(
            { error: 'Recipient has no valid phone number on file' },
            { status: 422 },
          );
        }

        const result = await sendSMS({
          to: recipient.phoneNumber,
          body,
        });

        const status = result.success ? CommunicationStatus.SENT : CommunicationStatus.FAILED;

        if (eventId) {
          await prisma.communicationLog.create({
            data: {
              eventId,
              sentByUserId: session.user.id,
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
        }

        await writeAuditLog({
          ...adminContext,
          action: 'sms.send',
          newValue: {
            status: result.success ? 'SENT' : 'FAILED',
            ...(result.messageId ? { messageId: result.messageId } : {}),
            ...(result.error ? { error: result.error } : {}),
            ...(result.errorCode ? { errorCode: String(result.errorCode) } : {}),
          },
        });

        if (!result.success) {
          log.warn(
            {
              recipientUserId: recipient.id,
              errorCode: result.errorCode,
              error: result.error,
            },
            'Twilio SMS send failed',
          );
          return NextResponse.json(
            {
              success: false,
              error: 'SMS provider rejected the message',
              errorCode: result.errorCode,
            },
            { status: 502 },
          );
        }

        return NextResponse.json({
          success: true,
          messageId: result.messageId,
        });
      } catch (error) {
        log.error({ err: error }, 'Error sending admin SMS');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }
    },
  );
}
