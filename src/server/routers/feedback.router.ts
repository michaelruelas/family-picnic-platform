import { router, procedure } from '~/lib/trpc';
import { TRPCError } from '@trpc/server';
import { feedbackSubmitSchema, FEEDBACK_CATEGORY_LABELS } from '~/lib/schemas/feedback';
import { sendEmail, isConfigured as emailConfigured } from '~/lib/twilio-email';
import { writeDomainAuditLog } from '~/lib/audit';
import { extractClientIp, parseTrustedProxyIps } from '~/lib/client-ip';
import { checkFeedbackSubmitRateLimit, rateLimitError } from '~/lib/rate-limit';

const FEEDBACK_TO_EMAIL = process.env.FEEDBACK_TO_EMAIL?.trim() || 'info@foliapicnic.com';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildFeedbackEmail(input: {
  category: keyof typeof FEEDBACK_CATEGORY_LABELS;
  message: string;
  submitterName: string | null;
  submitterEmail: string | null;
  pageUrl: string | null;
  userAgent: string | null;
  userId: string | null;
  ip: string | null;
  receivedAt: Date;
}): { subject: string; html: string; text: string } {
  const categoryLabel = FEEDBACK_CATEGORY_LABELS[input.category];
  const subject = `[Folia Feedback] ${categoryLabel} from ${input.submitterName ?? 'a guest'}`;

  const rows: Array<[string, string]> = [
    ['Category', categoryLabel],
    ['Submitted', input.receivedAt.toISOString()],
    ['Name', input.submitterName ?? '(not provided)'],
    ['Email', input.submitterEmail ?? '(not provided)'],
    ['User id', input.userId ?? '(anonymous)'],
    ['Page URL', input.pageUrl ?? '(not provided)'],
    ['User agent', input.userAgent ?? '(not provided)'],
    ['IP', input.ip ?? '(not captured)'],
  ];

  const tableRowsHtml = rows
    .map(
      ([k, v]) =>
        `<tr><th align="left" style="padding:4px 12px 4px 0;color:#555;font-weight:600;vertical-align:top;">${escapeHtml(
          k,
        )}</th><td style="padding:4px 0;vertical-align:top;">${escapeHtml(v)}</td></tr>`,
    )
    .join('');

  const html = `
    <div style="font-family:Inter,Helvetica,Arial,sans-serif;max-width:640px;color:#222;">
      <h2 style="margin:0 0 12px 0;font-size:18px;">New feedback submission</h2>
      <table style="border-collapse:collapse;font-size:14px;margin-bottom:16px;">
        <tbody>${tableRowsHtml}</tbody>
      </table>
      <h3 style="margin:16px 0 8px 0;font-size:16px;">Message</h3>
      <pre style="white-space:pre-wrap;font-family:inherit;font-size:14px;background:#f6f6f6;padding:12px;border-radius:6px;border:1px solid #eee;">${escapeHtml(
        input.message,
      )}</pre>
    </div>
  `;

  const text = [
    'New feedback submission',
    '------------------------',
    ...rows.map(([k, v]) => `${k}: ${v}`),
    '',
    'Message:',
    input.message,
  ].join('\n');

  return { subject, html, text };
}

export const feedbackRouter = router({
  submit: procedure.input(feedbackSubmitSchema).mutation(async ({ ctx, input }) => {
    // Require a contact email when the caller is anonymous so we can
    // follow up. Signed-in users already have an email on file.
    const sessionUser = ctx.session?.user;
    const submittedEmail = input.email?.trim() || null;
    const submittedName = input.name?.trim() || null;
    const submitterEmail = sessionUser?.email ?? submittedEmail;
    const submitterName =
      sessionUser?.name ??
      (submittedName || (submitterEmail ? submitterEmail.split('@')[0] : null)) ??
      null;

    if (!submitterEmail) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Please share an email so we can follow up.',
      });
    }

    // Rate limit by the most trustworthy identity we have: signed-in
    // user id first, then resolved client IP, then a shared
    // anonymous bucket so unauthenticated callers still get capped.
    const trustedProxies = parseTrustedProxyIps(process.env.TRUSTED_PROXY_IPS);
    const clientIp = ctx.headers ? extractClientIp(ctx.headers, trustedProxies).ip : null;
    const actor = sessionUser?.id ?? clientIp;
    const limit = checkFeedbackSubmitRateLimit(actor);
    if (!limit.allowed) {
      rateLimitError(limit, 'feedback submissions');
    }

    if (!emailConfigured()) {
      // Refuse rather than silently swallowing the message; the user
      // should know we couldn't deliver it.
      throw new TRPCError({
        code: 'SERVICE_UNAVAILABLE',
        message: 'Email delivery is not configured. Please try again later.',
      });
    }

    const userAgent = ctx.headers?.get('user-agent') ?? null;
    const pageUrl = input.pageUrl?.trim() || null;
    const receivedAt = new Date();

    const { subject, html, text } = buildFeedbackEmail({
      category: input.category,
      message: input.message,
      submitterName,
      submitterEmail,
      pageUrl,
      userAgent,
      userId: sessionUser?.id ?? null,
      ip: clientIp,
      receivedAt,
    });

    const result = await sendEmail({
      to: FEEDBACK_TO_EMAIL,
      subject,
      html,
      text,
    });

    if (!result.success) {
      // Audit even failures so a misconfigured SendGrid key doesn't
      // silently drop messages.
      await writeDomainAuditLog({
        actorId: sessionUser?.id ?? null,
        action: 'feedback.submit.failed',
        subjectType: 'FeedbackMessage',
        subjectId: 'unknown',
        payload: {
          category: input.category,
          submitterEmail,
          error: result.error ?? 'unknown',
        },
        occurredAt: receivedAt,
      });
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'We could not send your feedback. Please try again later.',
      });
    }

    await writeDomainAuditLog({
      actorId: sessionUser?.id ?? null,
      action: 'feedback.submit.sent',
      subjectType: 'FeedbackMessage',
      subjectId: result.messageId ?? 'no-message-id',
      payload: {
        category: input.category,
        submitterEmail,
        submitterName,
        pageUrl,
        userAgent,
        ip: clientIp,
        receivedAt: receivedAt.toISOString(),
      },
      occurredAt: receivedAt,
    });

    return { success: true as const };
  }),
});
