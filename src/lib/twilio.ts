import Twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

const client = accountSid && authToken ? Twilio(accountSid, authToken) : null;

export type SMSMessage = {
  to: string;
  body: string;
};

export async function sendSMS(
  message: SMSMessage,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!client || !phoneNumber) {
    return { success: false, error: 'Twilio not configured' };
  }

  try {
    const result = await client.messages.create({
      body: message.body,
      from: phoneNumber,
      to: message.to,
    });
    return { success: true, messageId: result.sid };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function sendBulkSMS(messages: SMSMessage[]): Promise<{
  success: boolean;
  results: Array<{ to: string; messageId?: string; error?: string }>;
}> {
  const results = await Promise.all(
    messages.map(async (msg) => {
      const result = await sendSMS(msg);
      return { to: msg.to, messageId: result.messageId, error: result.error };
    }),
  );
  return { success: true, results };
}

export function isConfigured(): boolean {
  return Boolean(client && phoneNumber);
}
