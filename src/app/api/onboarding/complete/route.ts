import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth';
import { prisma } from '~/lib/prisma';
import { CommunicationPreference } from '~/lib/generated/enums';
import { e164Schema, requirePhoneIfWantsSms } from '~/lib/schemas/sms';
import { generateRequestId, createRequestLogger } from '~/lib/logger';
import { createTraceContext, runWithTraceContext } from '~/lib/tracing';
import { extractClientIp, parseTrustedProxyIps } from '~/lib/client-ip';
import { z } from 'zod';

const completeSchema = z
  .object({
    communicationPreference: z
      .enum(['EMAIL', 'SMS', 'BOTH', 'NONE'] as const satisfies readonly CommunicationPreference[])
      .optional(),
    phoneNumber: e164Schema.optional().nullable(),
    smsConsent: z.boolean().optional(),
  })
  .superRefine(requirePhoneIfWantsSms);

function getClientIp(request: Request): string | null {
  const trusted = parseTrustedProxyIps(process.env.TRUSTED_PROXY_IPS);
  return extractClientIp(request.headers, trusted).ip;
}

export async function POST(request: Request) {
  const requestId = generateRequestId();
  const log = createRequestLogger({
    requestId,
    route: '/api/onboarding/complete',
  });

  return runWithTraceContext(createTraceContext(requestId), async () => {
    try {
      const session = await getServerSession(authOptions);
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      log.info({ userId: session.user.id }, 'Completing onboarding');

      const body = await request.json().catch(() => ({}));
      const parsed = completeSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Invalid onboarding payload', issues: parsed.error.flatten() },
          { status: 400 },
        );
      }
      const { communicationPreference, phoneNumber, smsConsent } = parsed.data;

      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          onboardingCompletedAt: new Date(),
          communicationPreference: communicationPreference ?? 'EMAIL',
          phoneNumber: phoneNumber ?? null,
          smsConsent: smsConsent ?? false,
          smsConsentAt: smsConsent ? new Date() : null,
          smsConsentIp: smsConsent ? getClientIp(request) : null,
        },
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      log.error({ err: error }, 'Onboarding complete error');
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
