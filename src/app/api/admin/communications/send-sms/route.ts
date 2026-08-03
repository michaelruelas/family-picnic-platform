import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '~/lib/admin-auth';
import { prisma } from '~/lib/prisma';
import { generateRequestId, createRequestLogger } from '~/lib/logger';
import { createTraceContext, runWithTraceContext } from '~/lib/tracing';
import { adminSendSmsInputSchema } from '~/lib/schemas/sms';
import { dispatchAdminSms } from '~/lib/sms-dispatch';

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

        const event = await prisma.event.findUnique({
          where: { id: input.eventId },
          select: { id: true },
        });
        if (!event) {
          return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }

        const outcome = await dispatchAdminSms({
          adminUserId: session.user.id,
          recipientUserId: input.recipientUserId,
          body: input.message,
          eventId: input.eventId,
          auditAction: 'admin.sendSms',
        });

        switch (outcome.kind) {
          case 'SENT':
            return NextResponse.json({
              success: true,
              communicationLogId: outcome.communicationLogId,
              messageId: outcome.messageId,
            });
          case 'PROVIDER_NOT_CONFIGURED':
            return NextResponse.json({ error: 'SMS provider not configured' }, { status: 503 });
          case 'RECIPIENT_NOT_FOUND':
            return NextResponse.json({ error: 'Recipient not found' }, { status: 404 });
          case 'NO_CONSENT':
            return NextResponse.json(
              { error: 'Recipient has not consented to SMS messages' },
              { status: 403 },
            );
          case 'NO_PHONE':
            return NextResponse.json(
              { error: 'Recipient has no valid phone number on file' },
              { status: 422 },
            );
          case 'TWILIO_ERROR':
            log.warn(
              {
                eventId: input.eventId,
                recipientUserId: outcome.recipientId,
                errorCode: outcome.errorCode,
                error: outcome.error,
              },
              'Twilio SMS send failed',
            );
            return NextResponse.json(
              {
                success: false,
                error: 'SMS provider rejected the message',
                errorCode: outcome.errorCode,
                communicationLogId: outcome.communicationLogId,
              },
              { status: 502 },
            );
        }
      } catch (error) {
        log.error({ err: error }, 'Error sending admin SMS');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }
    },
  );
}
