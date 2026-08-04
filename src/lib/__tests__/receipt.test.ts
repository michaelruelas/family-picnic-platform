import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSendEmail = vi.hoisted(() => vi.fn());

vi.mock('../sendgrid', () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  mockSendEmail.mockReset();
});

describe('sendRegistrationReceipt', () => {
  it('returns success when SendGrid succeeds', async () => {
    mockSendEmail.mockResolvedValue({ success: true, messageId: 'msg-1' });
    const { sendRegistrationReceipt } = await import('../receipt');
    const result = await sendRegistrationReceipt({
      to: 'user@example.com',
      userName: 'Maria Garcia',
      eventName: 'Family Picnic 2026',
      eventDate: new Date('2026-08-15T11:00:00Z'),
      amountCents: 2500,
      currency: 'usd',
      chargeId: 'ch_123',
      registrationId: 'reg_1',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.messageId).toBe('msg-1');
    }
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const callArgs = mockSendEmail.mock.calls[0]![0] as {
      to: string;
      subject: string;
      html: string;
      text: string;
    };
    expect(callArgs.to).toBe('user@example.com');
    expect(callArgs.subject).toContain('Family Picnic 2026');
    expect(callArgs.text).toContain('$25.00');
    expect(callArgs.text).toContain('Maria Garcia');
    expect(callArgs.html).toContain('Family Picnic 2026');
    expect(callArgs.html).toContain('$25.00');
  });

  it('escapes HTML in user-supplied fields', async () => {
    mockSendEmail.mockResolvedValue({ success: true, messageId: 'msg-2' });
    const { sendRegistrationReceipt } = await import('../receipt');
    await sendRegistrationReceipt({
      to: 'attacker@example.com',
      userName: '<script>alert(1)</script>',
      eventName: 'Picnic "X" & Y',
      eventDate: new Date('2026-08-15T11:00:00Z'),
      amountCents: 1000,
      currency: 'usd',
      chargeId: 'ch_2',
      registrationId: 'reg_2',
    });
    const callArgs = mockSendEmail.mock.calls[0]![0] as { html: string; text: string };
    expect(callArgs.html).not.toContain('<script>alert(1)</script>');
    expect(callArgs.html).toContain('&lt;script&gt;');
    expect(callArgs.html).toContain('&amp;');
    expect(callArgs.html).toContain('&quot;');
    expect(callArgs.text).toContain('<script>'); // plain text keeps it
  });

  it('includes Stripe receipt link when present', async () => {
    mockSendEmail.mockResolvedValue({ success: true, messageId: 'msg-3' });
    const { sendRegistrationReceipt } = await import('../receipt');
    await sendRegistrationReceipt({
      to: 'user@example.com',
      userName: 'Maria',
      eventName: 'Picnic',
      eventDate: new Date('2026-08-15T11:00:00Z'),
      amountCents: 2500,
      currency: 'usd',
      chargeId: 'ch_3',
      registrationId: 'reg_3',
      receiptUrl: 'https://stripe.com/receipts/abc',
      eventUrl: 'https://example.com/events/evt-1',
    });
    const callArgs = mockSendEmail.mock.calls[0]![0] as { html: string; text: string };
    expect(callArgs.html).toContain('https://stripe.com/receipts/abc');
    expect(callArgs.html).toContain('https://example.com/events/evt-1');
    expect(callArgs.text).toContain('https://stripe.com/receipts/abc');
    expect(callArgs.text).toContain('https://example.com/events/evt-1');
  });

  it('returns failure when SendGrid fails', async () => {
    mockSendEmail.mockResolvedValue({ success: false, error: 'SendGrid rejected' });
    const { sendRegistrationReceipt } = await import('../receipt');
    const result = await sendRegistrationReceipt({
      to: 'user@example.com',
      userName: 'Maria',
      eventName: 'Picnic',
      eventDate: new Date('2026-08-15T11:00:00Z'),
      amountCents: 2500,
      currency: 'usd',
      chargeId: 'ch_4',
      registrationId: 'reg_4',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('SendGrid rejected');
    }
  });

  it('returns a generic error when SendGrid returns no error message', async () => {
    mockSendEmail.mockResolvedValue({ success: false });
    const { sendRegistrationReceipt } = await import('../receipt');
    const result = await sendRegistrationReceipt({
      to: 'user@example.com',
      userName: 'Maria',
      eventName: 'Picnic',
      eventDate: new Date('2026-08-15T11:00:00Z'),
      amountCents: 2500,
      currency: 'usd',
      chargeId: 'ch_5',
      registrationId: 'reg_5',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('SendGrid error');
    }
  });
});
