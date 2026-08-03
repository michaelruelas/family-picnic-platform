import { NextRequest, NextResponse } from 'next/server';
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
import { adminSendSmsInputSchema } from '~/lib/schemas/sms';
import { CommunicationChannel, CommunicationStatus } from '~/lib/generated/enums';

export async function POST(request: NextRequest) {
  const requestId = generateRequestId();
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const log = createRequestLogger({
    requestId,
    userId: session.user.id,
    route: '/api/admin/communications/send-sms',
  });

  return runWithTraceContext(
    createTraceContext(requestId, session.user.id, '/api/admin/communications/send-sms'),
    async () => {
      try {
        const json = await request.json().catch(() => null);
        const parsed = adminSendSmsInputSchema.safeParse(json);
        if (!parsed.success) {
          return NextResponse.json(
            { error: 'Invalid request', issues: parsed.error.flatten() },
            { status: 400 },
          );
        }
        const input = parsed.data;

        if (!twilioConfigured()) {
          return NextResponse.json({ error: 'SMS provider not configured' }, { status: 503 });
        }

        const fromPhone = getFromPhoneNumber();
        if (!fromPhone || !isValidE164(fromPhone)) {
          log.error({ fromPhone }, 'TWILIO_PHONE_NUMBER is missing or invalid');
          return NextResponse.json({ error: 'SMS provider not configured' }, { status: 503 });
        }

        const event = await prisma.event.findUnique({
          where: { id: input.eventId },
          select: { id: true },
        });
        if (!event) {
          return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }

        const recipient = await prisma.user.findUnique({
          where: { id: input.recipientUserId },
          select: {
            id: true,
            name: true,
            email: true,
            phoneNumber: true,
            smsConsent: true,
          },
        });
        if (!recipient) {
          return NextResponse.json({ error: 'Recipient not found' }, { status: 404 });
        }

        if (!recipient.smsConsent) {
          await prisma.communicationLog.create({
            data: {
              eventId: input.eventId,
              sentByUserId: session.user.id,
              recipientUserId: recipient.id,
              channel: CommunicationChannel.SMS,
              status: CommunicationStatus.FAILED,
              errorCode: 'NO_CONSENT',
              errorMessage: 'Recipient has not granted SMS consent',
              fromPhoneNumber: fromPhone,
            },
          });
          await writeAuditLog({
            userId: session.user.id,
            eventId: input.eventId,
            action: 'admin.sendSms',
            newValue: {
              recipientUserId: recipient.id,
              outcome: 'NO_CONSENT',
            },
          });
          return NextResponse.json(
            { error: 'Recipient has not consented to SMS messages' },
            { status: 403 },
          );
        }

        if (!recipient.phoneNumber || !isValidE164(recipient.phoneNumber)) {
          await prisma.communicationLog.create({
            data: {
              eventId: input.eventId,
              sentByUserId: session.user.id,
              recipientUserId: recipient.id,
              channel: CommunicationChannel.SMS,
              status: CommunicationStatus.FAILED,
              errorCode: 'NO_PHONE',
              errorMessage: 'Recipient has no valid E.164 phone number on file',
              fromPhoneNumber: fromPhone,
            },
          });
          await writeAuditLog({
            userId: session.user.id,
            eventId: input.eventId,
            action: 'admin.sendSms',
            newValue: {
              recipientUserId: recipient.id,
              outcome: 'NO_PHONE',
            },
          });
          return NextResponse.json(
            { error: 'Recipient has no valid phone number on file' },
            { status: 422 },
          );
        }

        const result = await sendSMS({
          to: recipient.phoneNumber,
          body: input.message,
        });

        const status = result.success ? CommunicationStatus.SENT : CommunicationStatus.FAILED;

        const logRow = await prisma.communicationLog.create({
          data: {
            eventId: input.eventId,
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

        await writeAuditLog({
          userId: session.user.id,
          eventId: input.eventId,
          action: 'admin.sendSms',
          newValue: {
            recipientUserId: recipient.id,
            messageId: result.messageId ?? null,
            outcome: result.success ? 'SENT' : 'FAILED',
            errorCode: result.errorCode ?? null,
            communicationLogId: logRow.id,
          },
        });

        if (!result.success) {
          log.warn(
            {
              eventId: input.eventId,
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
              communicationLogId: logRow.id,
            },
            { status: 502 },
          );
        }

        return NextResponse.json({
          success: true,
          communicationLogId: logRow.id,
          messageId: result.messageId,
        });
      } catch (error) {
        log.error({ err: error }, 'Error sending admin SMS');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }
    },
  );
}
