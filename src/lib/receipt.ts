import { sendEmail } from './sendgrid';
import { formatAmount } from './stripe';

export type ReceiptInput = {
  to: string;
  userName: string;
  eventName: string;
  eventDate: Date;
  amountCents: number;
  currency: string;
  chargeId: string;
  registrationId: string;
  receiptUrl?: string | null;
  eventUrl?: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildHtml(input: ReceiptInput): string {
  const amount = formatAmount(input.amountCents, input.currency);
  const eventDate = input.eventDate.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  const viewLink = input.eventUrl
    ? `<p style="margin:24px 0 0 0"><a href="${escapeHtml(input.eventUrl)}" style="background:#c2410c;color:white;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">View event</a></p>`
    : '';
  const receiptLink = input.receiptUrl
    ? `<p style="margin:16px 0 0 0"><a href="${escapeHtml(input.receiptUrl)}" style="color:#c2410c">View Stripe receipt</a></p>`
    : '';

  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#fafaf9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1c1917">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fafaf9;padding:32px 16px">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;background:white;border-radius:16px;padding:32px">
            <tr>
              <td>
                <h1 style="margin:0 0 4px 0;font-size:24px">Thanks, ${escapeHtml(input.userName)}</h1>
                <p style="margin:0 0 24px 0;color:#78716c">Your registration for ${escapeHtml(input.eventName)} is confirmed.</p>

                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-top:1px solid #e7e5e4;border-bottom:1px solid #e7e5e4;padding:16px 0">
                  <tr>
                    <td style="padding:8px 0;color:#78716c">Event</td>
                    <td style="padding:8px 0;text-align:right;font-weight:600">${escapeHtml(input.eventName)}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;color:#78716c">When</td>
                    <td style="padding:8px 0;text-align:right">${escapeHtml(eventDate)}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;color:#78716c">Amount paid</td>
                    <td style="padding:8px 0;text-align:right;font-weight:600">${escapeHtml(amount)}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;color:#78716c">Charge ID</td>
                    <td style="padding:8px 0;text-align:right;font-family:monospace;font-size:13px">${escapeHtml(input.chargeId)}</td>
                  </tr>
                </table>

                ${viewLink}
                ${receiptLink}

                <p style="margin:32px 0 0 0;color:#a8a29e;font-size:12px">
                  Keep this email for your records. If you need to update your registration, visit the event page.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildText(input: ReceiptInput): string {
  const amount = formatAmount(input.amountCents, input.currency);
  const eventDate = input.eventDate.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  const lines = [
    `Hi ${input.userName},`,
    '',
    `Your registration for ${input.eventName} is confirmed.`,
    '',
    `Event:    ${input.eventName}`,
    `When:     ${eventDate}`,
    `Amount:   ${amount}`,
    `Charge:   ${input.chargeId}`,
  ];
  if (input.eventUrl) lines.push('', `View event: ${input.eventUrl}`);
  if (input.receiptUrl) lines.push(`Stripe receipt: ${input.receiptUrl}`);
  return lines.join('\n');
}

export type SendReceiptResult =
  { success: true; messageId?: string } | { success: false; error: string };

/**
 * Sends a registration receipt to the user. Used by the Stripe webhook on
 * payment_intent.succeeded and by the admin "resend receipt" action. Safe
 * to call when SendGrid is not configured; the returned error is
 * non-fatal so the webhook can still acknowledge the event.
 */
export async function sendRegistrationReceipt(input: ReceiptInput): Promise<SendReceiptResult> {
  const subject = `Receipt: ${input.eventName}`;
  const result = await sendEmail({
    to: input.to,
    subject,
    html: buildHtml(input),
    text: buildText(input),
  });
  if (result.success) {
    return { success: true, ...(result.messageId ? { messageId: result.messageId } : {}) };
  }
  return { success: false, error: result.error ?? 'SendGrid error' };
}
