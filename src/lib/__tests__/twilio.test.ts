import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreate = vi.hoisted(() => vi.fn());

vi.mock('twilio', () => ({
  default: vi.fn(() => ({
    messages: { create: mockCreate },
  })),
}));

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  mockCreate.mockReset();
});

describe('isConfigured', () => {
  it('returns false when no env vars are set', async () => {
    vi.stubEnv('TWILIO_ACCOUNT_SID', '');
    vi.stubEnv('TWILIO_AUTH_TOKEN', '');
    vi.stubEnv('TWILIO_PHONE_NUMBER', '');
    const { isConfigured } = await import('../twilio');
    expect(isConfigured()).toBe(false);
  });

  it('returns false when TWILIO_ACCOUNT_SID is missing', async () => {
    vi.stubEnv('TWILIO_ACCOUNT_SID', '');
    vi.stubEnv('TWILIO_AUTH_TOKEN', 'token123');
    vi.stubEnv('TWILIO_PHONE_NUMBER', '+15551234567');
    const { isConfigured } = await import('../twilio');
    expect(isConfigured()).toBe(false);
  });

  it('returns false when TWILIO_AUTH_TOKEN is missing', async () => {
    vi.stubEnv('TWILIO_ACCOUNT_SID', 'AC123');
    vi.stubEnv('TWILIO_AUTH_TOKEN', '');
    vi.stubEnv('TWILIO_PHONE_NUMBER', '+15551234567');
    const { isConfigured } = await import('../twilio');
    expect(isConfigured()).toBe(false);
  });

  it('returns false when TWILIO_PHONE_NUMBER is missing', async () => {
    vi.stubEnv('TWILIO_ACCOUNT_SID', 'AC123');
    vi.stubEnv('TWILIO_AUTH_TOKEN', 'token123');
    vi.stubEnv('TWILIO_PHONE_NUMBER', '');
    const { isConfigured } = await import('../twilio');
    expect(isConfigured()).toBe(false);
  });

  it('returns true when all env vars are set', async () => {
    vi.stubEnv('TWILIO_ACCOUNT_SID', 'AC123');
    vi.stubEnv('TWILIO_AUTH_TOKEN', 'token123');
    vi.stubEnv('TWILIO_PHONE_NUMBER', '+15551234567');
    const { isConfigured } = await import('../twilio');
    expect(isConfigured()).toBe(true);
  });
});

describe('sendSMS', () => {
  it('returns error when not configured', async () => {
    vi.stubEnv('TWILIO_ACCOUNT_SID', '');
    vi.stubEnv('TWILIO_AUTH_TOKEN', '');
    vi.stubEnv('TWILIO_PHONE_NUMBER', '');
    const { sendSMS } = await import('../twilio');
    const result = await sendSMS({ to: '+15551234567', body: 'Hello' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Twilio not configured');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns success with messageId when configured', async () => {
    mockCreate.mockResolvedValue({ sid: 'SM9876' });
    vi.stubEnv('TWILIO_ACCOUNT_SID', 'AC123');
    vi.stubEnv('TWILIO_AUTH_TOKEN', 'token123');
    vi.stubEnv('TWILIO_PHONE_NUMBER', '+15559876543');
    const { sendSMS } = await import('../twilio');
    const result = await sendSMS({ to: '+15551234567', body: 'Hello from Family Picnic!' });
    expect(result.success).toBe(true);
    expect(result.messageId).toBe('SM9876');
    expect(mockCreate).toHaveBeenCalledWith({
      body: 'Hello from Family Picnic!',
      from: '+15559876543',
      to: '+15551234567',
    });
  });

  it('returns error when Twilio API call fails', async () => {
    mockCreate.mockRejectedValue(new Error('Twilio API error'));
    vi.stubEnv('TWILIO_ACCOUNT_SID', 'AC123');
    vi.stubEnv('TWILIO_AUTH_TOKEN', 'token123');
    vi.stubEnv('TWILIO_PHONE_NUMBER', '+15559876543');
    const { sendSMS } = await import('../twilio');
    const result = await sendSMS({ to: '+15551234567', body: 'Hello' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Twilio API error');
  });

  it('returns generic error when Twilio throws non-Error', async () => {
    mockCreate.mockRejectedValue('string error');
    vi.stubEnv('TWILIO_ACCOUNT_SID', 'AC123');
    vi.stubEnv('TWILIO_AUTH_TOKEN', 'token123');
    vi.stubEnv('TWILIO_PHONE_NUMBER', '+15559876543');
    const { sendSMS } = await import('../twilio');
    const result = await sendSMS({ to: '+15551234567', body: 'Hello' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unknown error');
  });
});

describe('sendBulkSMS', () => {
  it('sends to all recipients when configured', async () => {
    mockCreate.mockResolvedValue({ sid: 'SM-bulk' });
    vi.stubEnv('TWILIO_ACCOUNT_SID', 'AC123');
    vi.stubEnv('TWILIO_AUTH_TOKEN', 'token123');
    vi.stubEnv('TWILIO_PHONE_NUMBER', '+15559876543');
    const { sendBulkSMS } = await import('../twilio');
    const result = await sendBulkSMS([
      { to: '+15551111111', body: 'Hi A' },
      { to: '+15552222222', body: 'Hi B' },
    ]);
    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(2);
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(result.results[0]!.messageId).toBe('SM-bulk');
    expect(result.results[1]!.messageId).toBe('SM-bulk');
  });

  it('includes errors per recipient when individual sends fail', async () => {
    mockCreate
      .mockResolvedValueOnce({ sid: 'SM-ok' })
      .mockRejectedValueOnce(new Error('Invalid number'));
    vi.stubEnv('TWILIO_ACCOUNT_SID', 'AC123');
    vi.stubEnv('TWILIO_AUTH_TOKEN', 'token123');
    vi.stubEnv('TWILIO_PHONE_NUMBER', '+15559876543');
    const { sendBulkSMS } = await import('../twilio');
    const result = await sendBulkSMS([
      { to: '+15551111111', body: 'Hi A' },
      { to: '+15552222222', body: 'Hi B' },
    ]);
    expect(result.success).toBe(true);
    expect(result.results[0]!.messageId).toBe('SM-ok');
    expect(result.results[0]!.error).toBeUndefined();
    expect(result.results[1]!.error).toBe('Invalid number');
    expect(result.results[1]!.messageId).toBeUndefined();
  });
});
