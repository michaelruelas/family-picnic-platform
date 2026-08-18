import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  mockFetch.mockReset();
});

function expectedBasicAuth(sid: string, token: string): string {
  return `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`;
}

describe('isConfigured', () => {
  it('returns false when TWILIO_ACCOUNT_SID is not set', async () => {
    vi.stubEnv('TWILIO_ACCOUNT_SID', '');
    vi.stubEnv('TWILIO_AUTH_TOKEN', 'token123');
    const { isConfigured } = await import('../twilio-email');
    expect(isConfigured()).toBe(false);
  });

  it('returns false when TWILIO_AUTH_TOKEN is not set', async () => {
    vi.stubEnv('TWILIO_ACCOUNT_SID', 'ACtest');
    vi.stubEnv('TWILIO_AUTH_TOKEN', '');
    const { isConfigured } = await import('../twilio-email');
    expect(isConfigured()).toBe(false);
  });

  it('returns true when both TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are set', async () => {
    vi.stubEnv('TWILIO_ACCOUNT_SID', 'ACtest');
    vi.stubEnv('TWILIO_AUTH_TOKEN', 'token123');
    const { isConfigured } = await import('../twilio-email');
    expect(isConfigured()).toBe(true);
  });
});

describe('sendEmail', () => {
  it('returns error when not configured', async () => {
    vi.stubEnv('TWILIO_ACCOUNT_SID', '');
    vi.stubEnv('TWILIO_AUTH_TOKEN', '');
    const { sendEmail } = await import('../twilio-email');
    const result = await sendEmail({
      to: 'test@example.com',
      subject: 'Test',
      html: '<p>Hi</p>',
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Twilio Email not configured');
  });

  it('returns success with operationId stored as messageId on 202 response', async () => {
    vi.stubEnv('TWILIO_ACCOUNT_SID', 'ACtest');
    vi.stubEnv('TWILIO_AUTH_TOKEN', 'token123');
    mockFetch.mockResolvedValue({
      status: 202,
      json: vi
        .fn()
        .mockResolvedValue({ operationId: 'comms_operation_01h9krwprkeee8fzqspvwy6nq8' }),
      text: vi.fn(),
    });
    const { sendEmail } = await import('../twilio-email');
    const result = await sendEmail({
      to: 'test@example.com',
      subject: 'Hello',
      html: '<p>Body</p>',
    });
    expect(result.success).toBe(true);
    expect(result.messageId).toBe('comms_operation_01h9krwprkeee8fzqspvwy6nq8');
  });

  it('sends correct request body to Twilio Comms API with basic auth', async () => {
    vi.stubEnv('TWILIO_ACCOUNT_SID', 'ACtest');
    vi.stubEnv('TWILIO_AUTH_TOKEN', 'token123');
    vi.stubEnv('TWILIO_FROM_EMAIL', 'noreply@picnic.example.com');
    mockFetch.mockResolvedValue({
      status: 202,
      json: vi.fn().mockResolvedValue({ operationId: 'op-1' }),
      text: vi.fn(),
    });
    const { sendEmail } = await import('../twilio-email');
    await sendEmail({
      to: 'recipient@example.com',
      subject: 'Invitation',
      html: '<p>You are invited</p>',
      text: 'You are invited',
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const callArgs = mockFetch.mock.calls[0]!;
    expect(callArgs[0]).toBe('https://comms.twilio.com/v1/Emails');
    expect(callArgs[1]?.method).toBe('POST');
    expect(callArgs[1]?.headers).toMatchObject({
      Authorization: expectedBasicAuth('ACtest', 'token123'),
      'Content-Type': 'application/json',
    });
    const body = JSON.parse(callArgs[1]?.body as string);
    expect(body.from.address).toBe('noreply@picnic.example.com');
    expect(body.to).toEqual([{ address: 'recipient@example.com' }]);
    expect(body.content.subject).toBe('Invitation');
    expect(body.content.html).toBe('<p>You are invited</p>');
    expect(body.content.text).toBe('You are invited');
  });

  it('falls back to html for text when text is not provided', async () => {
    vi.stubEnv('TWILIO_ACCOUNT_SID', 'ACtest');
    vi.stubEnv('TWILIO_AUTH_TOKEN', 'token123');
    mockFetch.mockResolvedValue({
      status: 202,
      json: vi.fn().mockResolvedValue({ operationId: 'op-1' }),
      text: vi.fn(),
    });
    const { sendEmail } = await import('../twilio-email');
    await sendEmail({
      to: 'recipient@example.com',
      subject: 'Hi',
      html: '<p>Body</p>',
    });
    const body = JSON.parse(mockFetch.mock.calls[0]![1]?.body as string);
    expect(body.content.text).toBe('<p>Body</p>');
  });

  it('uses default from email when TWILIO_FROM_EMAIL is not set', async () => {
    vi.stubEnv('TWILIO_ACCOUNT_SID', 'ACtest');
    vi.stubEnv('TWILIO_AUTH_TOKEN', 'token123');
    vi.stubEnv('TWILIO_FROM_EMAIL', '');
    mockFetch.mockResolvedValue({
      status: 202,
      json: vi.fn().mockResolvedValue({ operationId: 'op-1' }),
      text: vi.fn(),
    });
    const { sendEmail } = await import('../twilio-email');
    await sendEmail({
      to: 'recipient@example.com',
      subject: 'Hi',
      html: '<p>Body</p>',
    });
    const body = JSON.parse(mockFetch.mock.calls[0]![1]?.body as string);
    expect(body.from.address).toBe('noreply@family-picnic.example.com');
  });

  it('returns error when fetch responds with non-202 status', async () => {
    vi.stubEnv('TWILIO_ACCOUNT_SID', 'ACtest');
    vi.stubEnv('TWILIO_AUTH_TOKEN', 'token123');
    mockFetch.mockResolvedValue({
      status: 400,
      json: vi.fn().mockResolvedValue({}),
      text: vi.fn().mockResolvedValue('Bad request'),
    });
    const { sendEmail } = await import('../twilio-email');
    const result = await sendEmail({
      to: 'test@example.com',
      subject: 'Hello',
      html: '<p>Body</p>',
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Bad request');
  });

  it('returns HTTP status text when error response body is empty', async () => {
    vi.stubEnv('TWILIO_ACCOUNT_SID', 'ACtest');
    vi.stubEnv('TWILIO_AUTH_TOKEN', 'token123');
    mockFetch.mockResolvedValue({
      status: 401,
      json: vi.fn().mockResolvedValue({}),
      text: vi.fn().mockResolvedValue(''),
    });
    const { sendEmail } = await import('../twilio-email');
    const result = await sendEmail({
      to: 'test@example.com',
      subject: 'Hello',
      html: '<p>Body</p>',
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('HTTP 401');
  });

  it('returns error when fetch throws', async () => {
    vi.stubEnv('TWILIO_ACCOUNT_SID', 'ACtest');
    vi.stubEnv('TWILIO_AUTH_TOKEN', 'token123');
    mockFetch.mockRejectedValue(new Error('Network failure'));
    const { sendEmail } = await import('../twilio-email');
    const result = await sendEmail({
      to: 'test@example.com',
      subject: 'Hello',
      html: '<p>Body</p>',
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Network failure');
  });

  it('returns generic error when fetch throws non-Error', async () => {
    vi.stubEnv('TWILIO_ACCOUNT_SID', 'ACtest');
    vi.stubEnv('TWILIO_AUTH_TOKEN', 'token123');
    mockFetch.mockRejectedValue('string error');
    const { sendEmail } = await import('../twilio-email');
    const result = await sendEmail({
      to: 'test@example.com',
      subject: 'Hello',
      html: '<p>Body</p>',
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unknown error');
  });

  it('treats 200 responses the same as 202 (idempotent success)', async () => {
    vi.stubEnv('TWILIO_ACCOUNT_SID', 'ACtest');
    vi.stubEnv('TWILIO_AUTH_TOKEN', 'token123');
    mockFetch.mockResolvedValue({
      status: 200,
      json: vi.fn().mockResolvedValue({ operationId: 'op-2' }),
      text: vi.fn(),
    });
    const { sendEmail } = await import('../twilio-email');
    const result = await sendEmail({
      to: 'test@example.com',
      subject: 'Hello',
      html: '<p>Body</p>',
    });
    expect(result.success).toBe(true);
    expect(result.messageId).toBe('op-2');
  });
});

describe('sendBulkEmail', () => {
  it('returns error results for all when not configured', async () => {
    vi.stubEnv('TWILIO_ACCOUNT_SID', '');
    vi.stubEnv('TWILIO_AUTH_TOKEN', '');
    const { sendBulkEmail } = await import('../twilio-email');
    const result = await sendBulkEmail([
      { to: 'a@example.com', subject: 'A', html: '<p>A</p>' },
      { to: 'b@example.com', subject: 'B', html: '<p>B</p>' },
    ]);
    expect(result.success).toBe(false);
    expect(result.results).toHaveLength(2);
    expect(result.results[0]!.error).toBe('Twilio Email not configured');
    expect(result.results[1]!.error).toBe('Twilio Email not configured');
  });

  it('sends to all recipients when configured', async () => {
    vi.stubEnv('TWILIO_ACCOUNT_SID', 'ACtest');
    vi.stubEnv('TWILIO_AUTH_TOKEN', 'token123');
    mockFetch.mockResolvedValue({
      status: 202,
      json: vi.fn().mockResolvedValue({ operationId: 'op-1' }),
      text: vi.fn(),
    });
    const { sendBulkEmail } = await import('../twilio-email');
    const result = await sendBulkEmail([
      { to: 'a@example.com', subject: 'A', html: '<p>A</p>' },
      { to: 'b@example.com', subject: 'B', html: '<p>B</p>' },
      { to: 'c@example.com', subject: 'C', html: '<p>C</p>' },
    ]);
    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(3);
    expect(mockFetch).toHaveBeenCalledTimes(3);
    result.results.forEach((r) => {
      expect(r.messageId).toBe('op-1');
    });
  });

  it('includes error per recipient when individual send fails', async () => {
    vi.stubEnv('TWILIO_ACCOUNT_SID', 'ACtest');
    vi.stubEnv('TWILIO_AUTH_TOKEN', 'token123');
    mockFetch
      .mockResolvedValueOnce({
        status: 202,
        json: vi.fn().mockResolvedValue({ operationId: 'op-1' }),
        text: vi.fn(),
      })
      .mockResolvedValueOnce({
        status: 500,
        json: vi.fn().mockResolvedValue({}),
        text: vi.fn().mockResolvedValue('Server error'),
      });
    const { sendBulkEmail } = await import('../twilio-email');
    const result = await sendBulkEmail([
      { to: 'a@example.com', subject: 'A', html: '<p>A</p>' },
      { to: 'b@example.com', subject: 'B', html: '<p>B</p>' },
    ]);
    expect(result.success).toBe(true);
    expect(result.results[0]!.messageId).toBe('op-1');
    expect(result.results[0]!.error).toBeUndefined();
    expect(result.results[1]!.error).toBe('Server error');
    expect(result.results[1]!.messageId).toBeUndefined();
  });
});

describe('generateUnsubscribeLink', () => {
  it('returns correct URL format', async () => {
    vi.stubEnv('NEXTAUTH_URL', 'https://app.example.com');
    const { generateUnsubscribeLink } = await import('../twilio-email');
    const link = generateUnsubscribeLink('user-123', 'EMAIL');
    expect(link).toBe('https://app.example.com/api/unsubscribe?userId=user-123&channel=EMAIL');
  });

  it('uses NEXTAUTH_URL env var', async () => {
    vi.stubEnv('NEXTAUTH_URL', 'https://family-picnic.example.com');
    const { generateUnsubscribeLink } = await import('../twilio-email');
    const link = generateUnsubscribeLink('u1', 'SMS');
    expect(link).toContain('https://family-picnic.example.com');
  });

  it('falls back to localhost when NEXTAUTH_URL is not set', async () => {
    vi.stubEnv('NEXTAUTH_URL', '');
    const { generateUnsubscribeLink } = await import('../twilio-email');
    const link = generateUnsubscribeLink('u1', 'EMAIL');
    expect(link).toContain('http://localhost:3000');
  });
});
