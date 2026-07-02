const apiKey = process.env.SENDGRID_API_KEY;
const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@family-picnic.example.com';

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export async function sendEmail(
  message: EmailMessage,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!apiKey) {
    return { success: false, error: 'SendGrid not configured' };
  }

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: message.to }] }],
        from: { email: fromEmail },
        subject: message.subject,
        content: [
          { type: 'text/plain', value: message.text || message.html },
          { type: 'text/html', value: message.html },
        ],
      }),
    });

    if (response.ok) {
      const messageId = response.headers.get('x-message-id') || undefined;
      return { success: true, messageId };
    } else {
      const errorText = await response.text();
      return { success: false, error: errorText || `HTTP ${response.status}` };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function sendBulkEmail(messages: EmailMessage[]): Promise<{
  success: boolean;
  results: Array<{ to: string; messageId?: string; error?: string }>;
}> {
  if (!apiKey) {
    return {
      success: false,
      results: messages.map((m) => ({ to: m.to, error: 'SendGrid not configured' })),
    };
  }

  const results: Array<{ to: string; messageId?: string; error?: string }> = [];

  for (const message of messages) {
    const result = await sendEmail(message);
    results.push({ to: message.to, messageId: result.messageId, error: result.error });
  }

  return { success: true, results };
}

export function generateUnsubscribeLink(userId: string, channel: 'EMAIL' | 'SMS'): string {
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  return `${baseUrl}/api/unsubscribe?userId=${userId}&channel=${channel}`;
}

export function isConfigured(): boolean {
  return Boolean(apiKey);
}
