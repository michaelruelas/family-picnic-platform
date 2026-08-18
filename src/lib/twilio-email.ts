const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromEmail = process.env.TWILIO_FROM_EMAIL || 'noreply@family-picnic.example.com';

const TWILIO_EMAIL_URL = 'https://comms.twilio.com/v1/Emails';

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

function basicAuthHeader(): string {
  return `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`;
}

export async function sendEmail(
  message: EmailMessage,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!accountSid || !authToken) {
    return { success: false, error: 'Twilio Email not configured' };
  }

  try {
    const response = await fetch(TWILIO_EMAIL_URL, {
      method: 'POST',
      headers: {
        Authorization: basicAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: { address: fromEmail },
        to: [{ address: message.to }],
        content: {
          subject: message.subject,
          html: message.html,
          text: message.text ?? message.html,
        },
      }),
    });

    if (response.status >= 200 && response.status < 300) {
      const body = (await response.json().catch(() => ({}))) as {
        operationId?: string;
      };
      return { success: true, messageId: body.operationId };
    }

    const errorText = await response.text();
    return {
      success: false,
      error: errorText || `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function sendBulkEmail(messages: EmailMessage[]): Promise<{
  success: boolean;
  results: Array<{ to: string; messageId?: string; error?: string }>;
}> {
  if (!accountSid || !authToken) {
    return {
      success: false,
      results: messages.map((m) => ({
        to: m.to,
        error: 'Twilio Email not configured',
      })),
    };
  }

  const results: Array<{ to: string; messageId?: string; error?: string }> = [];

  for (const message of messages) {
    const result = await sendEmail(message);
    results.push({
      to: message.to,
      messageId: result.messageId,
      error: result.error,
    });
  }

  return { success: true, results };
}

export function generateUnsubscribeLink(userId: string, channel: 'EMAIL' | 'SMS'): string {
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  return `${baseUrl}/api/unsubscribe?userId=${userId}&channel=${channel}`;
}

export function isConfigured(): boolean {
  return Boolean(accountSid && authToken);
}
