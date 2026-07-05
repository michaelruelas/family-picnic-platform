import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  mockFetch.mockReset();
});

describe('isConfigured', () => {
  it('returns false when SENDGRID_API_KEY is not set', async () => {
    vi.stubEnv('SENDGRID_API_KEY', '');
    const { isConfigured } = await import('../sendgrid');
    expect(isConfigured()).toBe(false);
  });

  it('returns true when SENDGRID_API_KEY is set', async () => {
    vi.stubEnv('SENDGRID_API_KEY', 'SG.test123');
    const { isConfigured } = await import('../sendgrid');
    expect(isConfigured()).toBe(true);
  });
});

describe('sendEmail', () => {
  it('returns error when not configured', async () => {
    vi.stubEnv('SENDGRID_API_KEY', '');
    const { sendEmail } = await import('../sendgrid');
    const result = await sendEmail({
      to: 'test@example.com',
      subject: 'Test',
      html: '<p>Hi</p>',
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('SendGrid not configured');
  });

  it('returns success with messageId when fetch succeeds', async () => {
    vi.stubEnv('SENDGRID_API_KEY', 'SG.test123');
    mockFetch.mockResolvedValue({
      ok: true,
      headers: { get: vi.fn().mockReturnValue('msg-abc-123') },
      text: vi.fn(),
    });
    const { sendEmail } = await import('../sendgrid');
    const result = await sendEmail({
      to: 'test@example.com',
      subject: 'Hello',
      html: '<p>Body</p>',
    });
    expect(result.success).toBe(true);
    expect(result.messageId).toBe('msg-abc-123');
  });

  it('sends correct request body to SendGrid API', async () => {
    vi.stubEnv('SENDGRID_API_KEY', 'SG.test123');
    vi.stubEnv('SENDGRID_FROM_EMAIL', 'noreply@picnic.example.com');
    mockFetch.mockResolvedValue({
      ok: true,
      headers: { get: vi.fn().mockReturnValue('msg-1') },
      text: vi.fn(),
    });
    const { sendEmail } = await import('../sendgrid');
    await sendEmail({
      to: 'recipient@example.com',
      subject: 'Invitation',
      html: '<p>You are invited</p>',
      text: 'You are invited',
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const callArgs = mockFetch.mock.calls[0]!;
    expect(callArgs[0]).toBe('https://api.sendgrid.com/v3/mail/send');
    expect(callArgs[1]?.method).toBe('POST');
    expect(callArgs[1]?.headers).toMatchObject({
      Authorization: 'Bearer SG.test123',
      'Content-Type': 'application/json',
    });
    const body = JSON.parse(callArgs[1]?.body as string);
    expect(body.personalizations[0].to[0].email).toBe('recipient@example.com');
    expect(body.from.email).toBe('noreply@picnic.example.com');
    expect(body.subject).toBe('Invitation');
  });

  it('returns error when fetch responds with non-ok status', async () => {
    vi.stubEnv('SENDGRID_API_KEY', 'SG.test123');
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      headers: { get: vi.fn() },
      text: vi.fn().mockResolvedValue('Bad request'),
    });
    const { sendEmail } = await import('../sendgrid');
    const result = await sendEmail({
      to: 'test@example.com',
      subject: 'Hello',
      html: '<p>Body</p>',
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Bad request');
  });

  it('returns HTTP status text when error response body is empty', async () => {
    vi.stubEnv('SENDGRID_API_KEY', 'SG.test123');
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      headers: { get: vi.fn() },
      text: vi.fn().mockResolvedValue(''),
    });
    const { sendEmail } = await import('../sendgrid');
    const result = await sendEmail({
      to: 'test@example.com',
      subject: 'Hello',
      html: '<p>Body</p>',
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('HTTP 401');
  });

  it('returns error when fetch throws', async () => {
    vi.stubEnv('SENDGRID_API_KEY', 'SG.test123');
    mockFetch.mockRejectedValue(new Error('Network failure'));
    const { sendEmail } = await import('../sendgrid');
    const result = await sendEmail({
      to: 'test@example.com',
      subject: 'Hello',
      html: '<p>Body</p>',
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Network failure');
  });

  it('returns generic error when fetch throws non-Error', async () => {
    vi.stubEnv('SENDGRID_API_KEY', 'SG.test123');
    mockFetch.mockRejectedValue('string error');
    const { sendEmail } = await import('../sendgrid');
    const result = await sendEmail({
      to: 'test@example.com',
      subject: 'Hello',
      html: '<p>Body</p>',
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unknown error');
  });
});

describe('sendBulkEmail', () => {
  it('returns error results for all when not configured', async () => {
    vi.stubEnv('SENDGRID_API_KEY', '');
    const { sendBulkEmail } = await import('../sendgrid');
    const result = await sendBulkEmail([
      { to: 'a@example.com', subject: 'A', html: '<p>A</p>' },
      { to: 'b@example.com', subject: 'B', html: '<p>B</p>' },
    ]);
    expect(result.success).toBe(false);
    expect(result.results).toHaveLength(2);
    expect(result.results[0]!.error).toBe('SendGrid not configured');
    expect(result.results[1]!.error).toBe('SendGrid not configured');
  });

  it('sends to all recipients when configured', async () => {
    vi.stubEnv('SENDGRID_API_KEY', 'SG.test123');
    mockFetch.mockResolvedValue({
      ok: true,
      headers: { get: vi.fn().mockReturnValue('msg-1') },
      text: vi.fn(),
    });
    const { sendBulkEmail } = await import('../sendgrid');
    const result = await sendBulkEmail([
      { to: 'a@example.com', subject: 'A', html: '<p>A</p>' },
      { to: 'b@example.com', subject: 'B', html: '<p>B</p>' },
      { to: 'c@example.com', subject: 'C', html: '<p>C</p>' },
    ]);
    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(3);
    expect(mockFetch).toHaveBeenCalledTimes(3);
    result.results.forEach((r) => {
      expect(r.messageId).toBeDefined();
    });
  });

  it('includes error per recipient when individual send fails', async () => {
    vi.stubEnv('SENDGRID_API_KEY', 'SG.test123');
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: vi.fn().mockReturnValue('msg-1') },
        text: vi.fn(),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: { get: vi.fn() },
        text: vi.fn().mockResolvedValue('Server error'),
      });
    const { sendBulkEmail } = await import('../sendgrid');
    const result = await sendBulkEmail([
      { to: 'a@example.com', subject: 'A', html: '<p>A</p>' },
      { to: 'b@example.com', subject: 'B', html: '<p>B</p>' },
    ]);
    expect(result.success).toBe(true);
    expect(result.results[0]!.messageId).toBe('msg-1');
    expect(result.results[0]!.error).toBeUndefined();
    expect(result.results[1]!.error).toBe('Server error');
    expect(result.results[1]!.messageId).toBeUndefined();
  });
});

describe('generateUnsubscribeLink', () => {
  it('returns correct URL format', async () => {
    vi.stubEnv('NEXTAUTH_URL', 'https://app.example.com');
    const { generateUnsubscribeLink } = await import('../sendgrid');
    const link = generateUnsubscribeLink('user-123', 'EMAIL');
    expect(link).toBe('https://app.example.com/api/unsubscribe?userId=user-123&channel=EMAIL');
  });

  it('uses NEXTAUTH_URL env var', async () => {
    vi.stubEnv('NEXTAUTH_URL', 'https://family-picnic.example.com');
    const { generateUnsubscribeLink } = await import('../sendgrid');
    const link = generateUnsubscribeLink('u1', 'SMS');
    expect(link).toContain('https://family-picnic.example.com');
  });

  it('falls back to localhost when NEXTAUTH_URL is not set', async () => {
    vi.stubEnv('NEXTAUTH_URL', '');
    const { generateUnsubscribeLink } = await import('../sendgrid');
    const link = generateUnsubscribeLink('u1', 'EMAIL');
    expect(link).toContain('http://localhost:3000');
  });
});
