import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

describe('Rate Limiting Implementation', () => {
  const rateLimitPath = path.join(process.cwd(), 'src/lib/rate-limit.ts');
  const communicationRouterPath = path.join(
    process.cwd(),
    'src/server/routers/communication.router.ts',
  );
  const invitationRouterPath = path.join(process.cwd(), 'src/server/routers/invitation.router.ts');

  it('creates rate-limit.ts with rate limit checking functions', async () => {
    const content = await fs.readFile(rateLimitPath, 'utf-8');
    expect(content).toContain('checkAdminBroadcastRateLimit');
    expect(content).toContain('checkRecipientGroupRateLimit');
    expect(content).toContain('checkRecipientRateLimit');
    expect(content).toContain('checkAllRecipientRateLimits');
  });

  it('rate-limit.ts defines constants for limits', async () => {
    const content = await fs.readFile(rateLimitPath, 'utf-8');
    expect(content).toContain('BROADCASTS_PER_HOUR = 5');
    expect(content).toContain('RECIPIENT_GROUP_PER_30_MIN = 1');
    expect(content).toContain('RECIPIENTS_PER_DAY = 2');
  });

  it('rate-limit.ts defines RateLimitResult interface', async () => {
    const content = await fs.readFile(rateLimitPath, 'utf-8');
    expect(content).toContain('interface RateLimitResult');
    expect(content).toContain('allowed: boolean');
    expect(content).toContain('remaining: number');
    expect(content).toContain('resetAt: Date');
  });

  it('rate-limit.ts exports getRateLimitStatus function', async () => {
    const content = await fs.readFile(rateLimitPath, 'utf-8');
    expect(content).toContain('getRateLimitStatus');
    expect(content).toContain('broadcasts');
    expect(content).toContain('recipientGroup');
    expect(content).toContain('recipient');
  });

  it('rate-limit.ts exports rateLimitError helper', async () => {
    const content = await fs.readFile(rateLimitPath, 'utf-8');
    expect(content).toContain('rateLimitError');
    expect(content).toContain('TRPCError');
    expect(content).toContain('TOO_MANY_REQUESTS');
  });

  it('communication.router.ts uses rate limiting in sendBroadcast', async () => {
    const content = await fs.readFile(communicationRouterPath, 'utf-8');
    expect(content).toContain('checkAdminBroadcastRateLimit');
    expect(content).toContain('checkRecipientGroupRateLimit');
    expect(content).toContain('checkAllRecipientRateLimits');
    expect(content).toContain('getRateLimitStatus');
  });

  it('communication.router.ts adds getRateLimitStatus query', async () => {
    const content = await fs.readFile(communicationRouterPath, 'utf-8');
    expect(content).toContain('getRateLimitStatus: auditedAdminProcedure');
  });

  it('invitation.router.ts uses rate limiting in send', async () => {
    const content = await fs.readFile(invitationRouterPath, 'utf-8');
    expect(content).toContain('checkAdminBroadcastRateLimit');
    expect(content).toContain('checkRecipientGroupRateLimit');
    expect(content).toContain('checkAllRecipientRateLimits');
  });

  it('rate-limit.ts uses prisma to query CommunicationLog', async () => {
    const content = await fs.readFile(rateLimitPath, 'utf-8');
    expect(content).toContain('prisma.communicationLog');
    expect(content).toContain("status: { in: ['QUEUED', 'SENT', 'DELIVERED'] }");
  });

  it('rate-limit.ts handles time windows correctly', async () => {
    const content = await fs.readFile(rateLimitPath, 'utf-8');
    expect(content).toContain('BROADCAST_WINDOW_MS');
    expect(content).toContain('RECIPIENT_GROUP_WINDOW_MS');
    expect(content).toContain('RECIPIENT_WINDOW_MS');
    expect(content).toContain('60 * 60 * 1000');
    expect(content).toContain('30 * 60 * 1000');
    expect(content).toContain('24 * 60 * 60 * 1000');
  });
});
