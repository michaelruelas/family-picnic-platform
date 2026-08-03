import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminApi } from '~/lib/admin-auth';
import { generateRequestId, createRequestLogger } from '~/lib/logger';
import { createTraceContext, runWithTraceContext } from '~/lib/tracing';
import { dispatchAdminSms } from '~/lib/sms-dispatch';

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

        const outcome = await dispatchAdminSms({
          adminUserId: session.user.id,
          recipientUserId: userId,
          body,
          eventId,
          auditAction: 'sms.send',
        });

        switch (outcome.kind) {
          case 'SENT':
            return NextResponse.json({
              success: true,
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
