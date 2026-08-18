import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  // The router currently only touches auditLog via writeDomainAuditLog,
  // so we expose it through a separate vi.mock below. Kept here for
  // future-proofing if feedback grows a DB row.
  feedbackMessage: { create: vi.fn() },
}));

const sendGridMock = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  isConfigured: vi.fn(() => true),
}));

const auditMock = vi.hoisted(() => ({
  writeDomainAuditLog: vi.fn(),
}));

vi.mock('~/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('~/lib/sendgrid', () => sendGridMock);
vi.mock('~/lib/audit', () => auditMock);

// Make the in-memory rate limiter a no-op so tests stay independent.
vi.mock('~/lib/rate-limit', async () => {
  const actual = await vi.importActual<typeof import('~/lib/rate-limit')>('~/lib/rate-limit');
  return {
    ...actual,
    checkFeedbackSubmitRateLimit: () => ({
      allowed: true,
      remaining: 99,
      resetAt: new Date(),
    }),
  };
});

const { feedbackRouter } = await import('~/server/routers/feedback.router');
const { createCallerFactory } = await import('~/lib/trpc');

const createCaller = createCallerFactory(feedbackRouter);

const baseInput = {
  category: 'BUG' as const,
  message: 'Something is broken when I click submit on the RSVP form.',
  email: '',
  name: '',
  pageUrl: '/events/abc',
};

const sessionUser = {
  id: 'u-1',
  email: 'maria@example.com',
  name: 'Maria',
  role: 'ADULT' as const,
  householdId: 'h-1',
};

const signedInCaller = () =>
  createCaller({ session: { user: sessionUser, expires: '2099-01-01' } });
const anonymousCaller = () => createCaller({ session: null });

const fakeHeaders = (entries: Record<string, string>) => {
  const map = new Map(Object.entries(entries));
  return { get: (name: string) => map.get(name.toLowerCase()) ?? null } as Headers;
};

beforeEach(() => {
  vi.clearAllMocks();
  sendGridMock.isConfigured.mockReturnValue(true);
  sendGridMock.sendEmail.mockResolvedValue({ success: true, messageId: 'msg-1' });
});

describe('feedback.submit', () => {
  it('sends an email to FEEDBACK_TO_EMAIL with the rendered body', async () => {
    const caller = signedInCaller();
    const result = await caller.submit(baseInput);
    expect(result).toEqual({ success: true });

    expect(sendGridMock.sendEmail).toHaveBeenCalledTimes(1);
    const message = sendGridMock.sendEmail.mock.calls[0]?.[0];
    expect(message).toBeDefined();
    expect(message?.to).toBe('info@foliapicnic.com');
    expect(message?.subject).toContain('Something is broken');
    expect(message?.subject).toContain('Maria');
    expect(message?.html).toContain('Something is broken');
    expect(message?.html).toContain('maria@example.com');
    expect(message?.html).toContain('/events/abc');
  });

  it('uses the signed-in user identity when the caller is authenticated', async () => {
    const caller = signedInCaller();
    await caller.submit(baseInput);

    expect(auditMock.writeDomainAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'u-1',
        action: 'feedback.submit.sent',
        subjectType: 'FeedbackMessage',
      }),
    );
  });

  it('requires an email when the caller is anonymous', async () => {
    const caller = anonymousCaller();
    await expect(caller.submit({ ...baseInput, email: '' })).rejects.toThrow(/share an email/i);
    expect(sendGridMock.sendEmail).not.toHaveBeenCalled();
  });

  it('falls back to the provided name when no session name is available', async () => {
    const caller = anonymousCaller();
    await caller.submit({
      ...baseInput,
      email: 'guest@example.com',
      name: '  Casey  ',
    });

    const message = sendGridMock.sendEmail.mock.calls[0]?.[0];
    expect(message?.subject).toContain('Casey');
    expect(message?.html).toContain('Casey');
  });

  it('refuses when SendGrid is not configured', async () => {
    sendGridMock.isConfigured.mockReturnValue(false);
    const caller = signedInCaller();

    await expect(caller.submit(baseInput)).rejects.toThrow(/not configured/i);
    expect(auditMock.writeDomainAuditLog).not.toHaveBeenCalled();
  });

  it('audits and surfaces an error when SendGrid returns a failure', async () => {
    sendGridMock.sendEmail.mockResolvedValueOnce({
      success: false,
      error: 'provider exploded',
    });
    const caller = signedInCaller();

    await expect(caller.submit(baseInput)).rejects.toThrow(/could not send/i);

    expect(auditMock.writeDomainAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'feedback.submit.failed' }),
    );
  });

  it('captures the user agent and resolved client IP from forwarded headers', async () => {
    const caller = createCaller({
      session: null,
      headers: fakeHeaders({
        'user-agent': 'Mozilla/5.0 Test',
        'x-forwarded-for': '10.0.0.1, 203.0.113.42',
      }),
    });
    // Force TRUSTED_PROXY_IPS to be set for this call (the helper
    // resolves it from process.env at runtime; tests share that).
    process.env.TRUSTED_PROXY_IPS = '10.0.0.1';
    try {
      await caller.submit({ ...baseInput, email: 'guest@example.com' });
    } finally {
      delete process.env.TRUSTED_PROXY_IPS;
    }

    const auditCall = auditMock.writeDomainAuditLog.mock.calls[0]?.[0];
    expect(auditCall?.payload).toMatchObject({
      userAgent: 'Mozilla/5.0 Test',
      ip: '203.0.113.42',
    });
  });
});
