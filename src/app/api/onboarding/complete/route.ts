import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth';
import { prisma } from '~/lib/prisma';
import { CommunicationPreference } from '~/lib/generated/enums';
import { e164Schema } from '~/lib/schemas/sms';
import { generateRequestId, createRequestLogger } from '~/lib/logger';
import { createTraceContext, runWithTraceContext } from '~/lib/tracing';
import { z } from 'zod';

const completeSchema = z
  .object({
    communicationPreference: z
      .enum(['EMAIL', 'SMS', 'BOTH', 'NONE'] as const satisfies readonly CommunicationPreference[])
      .optional(),
    phoneNumber: e164Schema.optional().nullable(),
    smsConsent: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    const wantsSms =
      value.communicationPreference === 'SMS' ||
      value.communicationPreference === 'BOTH' ||
      value.smsConsent === true;
    if (wantsSms && !value.phoneNumber) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['phoneNumber'],
        message: 'A phone number is required to enable SMS notifications',
      });
    }
  });

function extractClientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const real = request.headers.get('x-real-ip');
  if (real) return real.trim();
  return null;
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
          smsConsentIp: smsConsent ? extractClientIp(request) : null,
        },
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      log.error({ err: error }, 'Onboarding complete error');
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
