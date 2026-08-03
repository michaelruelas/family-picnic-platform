import Twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

const client = accountSid && authToken ? Twilio(accountSid, authToken) : null;

export type SMSMessage = {
  to: string;
  body: string;
};

export type SMSResult = {
  success: boolean;
  messageId?: string;
  error?: string;
  errorCode?: number | string;
};

const E164_REGEX = /^\+[1-9]\d{1,14}$/;

export function isValidE164(value: string | null | undefined): value is string {
  return typeof value === 'string' && E164_REGEX.test(value);
}

export function normalizeE164(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/[^0-9]/g, '');
  if (!digits) return null;
  const candidate = `+${digits}`;
  return isValidE164(candidate) ? candidate : null;
}

export async function sendSMS(message: SMSMessage): Promise<SMSResult> {
  if (!client || !phoneNumber) {
    return { success: false, error: 'Twilio not configured' };
  }

  if (!isValidE164(message.to)) {
    return { success: false, error: 'Recipient phone number is not valid E.164', errorCode: 21211 };
  }

  if (!isValidE164(phoneNumber)) {
    return { success: false, error: 'TWILIO_PHONE_NUMBER is not valid E.164', errorCode: 21211 };
  }

  try {
    const result = await client.messages.create({
      body: message.body,
      from: phoneNumber,
      to: message.to,
    });
    return { success: true, messageId: result.sid };
  } catch (error) {
    const code = (error as { code?: number }).code;
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorCode: code,
    };
  }
}

export async function sendBulkSMS(messages: SMSMessage[]): Promise<{
  success: boolean;
  results: Array<{ to: string; messageId?: string; error?: string; errorCode?: number | string }>;
}> {
  const results = await Promise.all(
    messages.map(async (msg) => {
      const result = await sendSMS(msg);
      return {
        to: msg.to,
        messageId: result.messageId,
        error: result.error,
        errorCode: result.errorCode,
      };
    }),
  );
  return { success: true, results };
}

export function isConfigured(): boolean {
  return Boolean(client && phoneNumber);
}

export function getFromPhoneNumber(): string | null {
  if (!phoneNumber) return null;
  return isValidE164(phoneNumber) ? phoneNumber : null;
}
