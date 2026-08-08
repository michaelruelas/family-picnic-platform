import { describe, it, expect, vi, beforeEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

// FPP-101: happy path through the deliverCommunications workflow.
// We mock the prisma layer and SendGrid, then run the workflow's
// inner function with a no-op step runner so the test exercises the
// same queue-read + deliver + status-update sequence the worker
// runs in production.

const mockPrisma = vi.hoisted(() => ({
  communicationLog: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
}));

vi.mock('~/lib/prisma', () => ({ prisma: mockPrisma }));

const mockSendEmail = vi.hoisted(() => vi.fn());
vi.mock('~/lib/sendgrid', () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

const mockLoggerWarn = vi.hoisted(() => vi.fn());
const mockLoggerInfo = vi.hoisted(() => vi.fn());
const mockLoggerError = vi.hoisted(() => vi.fn());
vi.mock('~/lib/logger', () => ({
  logger: {
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
    info: (...args: unknown[]) => mockLoggerInfo(...args),
    error: (...args: unknown[]) => mockLoggerError(...args),
  },
}));

vi.mock('~/lib/generated/enums', () => ({
  CommunicationStatus: {
    QUEUED: 'QUEUED',
    SENT: 'SENT',
    DELIVERED: 'DELIVERED',
    FAILED: 'FAILED',
    SKIPPED: 'SKIPPED',
    UNSUBSCRIBED: 'UNSUBSCRIBED',
  },
  CommunicationChannel: { EMAIL: 'EMAIL', SMS: 'SMS' },
  CommunicationLogKind: {
    BROADCAST: 'BROADCAST',
    INVITATION: 'INVITATION',
    DECLINE_NOTE: 'DECLINE_NOTE',
  },
  ScheduledBroadcastStatus: {
    PENDING: 'PENDING',
    PROCESSING: 'PROCESSING',
    SENT: 'SENT',
    FAILED: 'FAILED',
  },
  RSVPStatus: {
    INVITED: 'INVITED',
    PENDING: 'PENDING',
    CONFIRMED: 'CONFIRMED',
    DECLINED: 'DECLINED',
    WAITLISTED: 'WAITLISTED',
  },
  EventStatus: {
    DRAFT: 'DRAFT',
    PUBLISHED: 'PUBLISHED',
    CLOSED: 'CLOSED',
    CANCELLED: 'CANCELLED',
  },
  InvitationStatus: {
    PENDING: 'PENDING',
    SENT: 'SENT',
    DELIVERED: 'DELIVERED',
    USED: 'USED',
    EXPIRED: 'EXPIRED',
  },
}));

beforeEach(() => {
  mockPrisma.communicationLog.findMany.mockReset();
  mockPrisma.communicationLog.update.mockReset();
  mockPrisma.user.findUnique.mockReset();
  mockSendEmail.mockReset();
  mockLoggerWarn.mockReset();
  mockLoggerInfo.mockReset();
  mockLoggerError.mockReset();
});

// No-op step runner. The openworkflow worker would persist each
// step's output and retry on failure; the integration tests only
// care about the orchestration and the prisma/sendgrid calls, so
// the inner function runs synchronously.
const mockStep = {
  run: vi.fn(async (_opts: { name: string }, fn: () => unknown) => fn()),
};

describe('FPP-101: deliverCommunications end-to-end', () => {
  it('queues an invitation log, runs deliverCommunications, and SendGrid receives the URL', async () => {
    const invitationUrl = 'https://example.com/events/invitation/abc-token';
    mockPrisma.communicationLog.findMany.mockResolvedValue([
      {
        id: 'log-inv-1',
        channel: 'EMAIL',
        body: invitationUrl,
        kind: 'INVITATION',
        recipientUserId: 'user-1',
        eventId: 'event-1',
      },
    ]);
    mockPrisma.user.findUnique.mockResolvedValue({
      email: 'maria@example.com',
      communicationPreference: 'EMAIL',
    });
    mockPrisma.communicationLog.update.mockResolvedValue({ id: 'log-inv-1' });
    mockSendEmail.mockResolvedValue({ success: true, messageId: 'msg-xyz' });

    const { deliverCommunications } = await import('../../src/lib/ow-workflows');
    // The workflow definition exposes the inner function via `.fn`.
    // The worker invokes it with the step context; in tests we pass
    // a stubbed step that runs the inner function inline.
    const innerFn = (
      deliverCommunications as unknown as { fn: (ctx: { step: unknown }) => Promise<unknown> }
    ).fn;
    const result = await innerFn({ step: mockStep });

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const sentMessage = mockSendEmail.mock.calls[0]![0] as {
      to: string;
      subject: string;
      html: string;
      text: string;
    };
    expect(sentMessage.to).toBe('maria@example.com');
    expect(sentMessage.html).toBe(invitationUrl);
    expect(sentMessage.text).toBe(invitationUrl);
    expect(sentMessage.subject).toContain('Family Picnic');

    expect(mockPrisma.communicationLog.update).toHaveBeenCalledWith({
      where: { id: 'log-inv-1' },
      data: expect.objectContaining({
        status: 'SENT',
        messageId: 'msg-xyz',
        deliveredAt: expect.any(Date),
      }),
    });

    expect(result).toEqual({ delivered: 1, failed: 0, skipped: 0 });
  });

  it('routes an SMS row to FAILED with sms_disabled_for_launch and never touches SendGrid', async () => {
    mockPrisma.communicationLog.findMany.mockResolvedValue([
      {
        id: 'log-sms-1',
        channel: 'SMS',
        body: 'Hi there',
        kind: 'INVITATION',
        recipientUserId: 'user-1',
        eventId: 'event-1',
      },
    ]);
    mockPrisma.communicationLog.update.mockResolvedValue({ id: 'log-sms-1' });

    const { deliverCommunications } = await import('../../src/lib/ow-workflows');
    const innerFn = (
      deliverCommunications as unknown as { fn: (ctx: { step: unknown }) => Promise<unknown> }
    ).fn;
    const result = await innerFn({ step: mockStep });

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.communicationLog.update).toHaveBeenCalledWith({
      where: { id: 'log-sms-1' },
      data: {
        status: 'FAILED',
        errorCode: 'SMS_DISABLED_FOR_LAUNCH',
        errorMessage: 'sms_disabled_for_launch',
      },
    });
    expect(result).toEqual({ delivered: 0, failed: 1, skipped: 0 });
  });

  it('skips an email row when the recipient opted out and updates the row to SKIPPED', async () => {
    mockPrisma.communicationLog.findMany.mockResolvedValue([
      {
        id: 'log-skip-1',
        channel: 'EMAIL',
        body: 'https://example.com/events/invitation/abc',
        kind: 'INVITATION',
        recipientUserId: 'user-1',
        eventId: 'event-1',
      },
    ]);
    mockPrisma.user.findUnique.mockResolvedValue({
      email: 'maria@example.com',
      communicationPreference: 'NONE',
    });

    const { deliverCommunications } = await import('../../src/lib/ow-workflows');
    const innerFn = (
      deliverCommunications as unknown as { fn: (ctx: { step: unknown }) => Promise<unknown> }
    ).fn;
    const result = await innerFn({ step: mockStep });

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockPrisma.communicationLog.update).toHaveBeenCalledWith({
      where: { id: 'log-skip-1' },
      data: {
        status: 'SKIPPED',
        errorCode: 'OPTED_OUT',
        errorMessage: 'Recipient opted out of communications',
      },
    });
    expect(result).toEqual({ delivered: 0, failed: 0, skipped: 1 });
  });

  it('returns zeros when no rows are queued', async () => {
    mockPrisma.communicationLog.findMany.mockResolvedValue([]);

    const { deliverCommunications } = await import('../../src/lib/ow-workflows');
    const innerFn = (
      deliverCommunications as unknown as { fn: (ctx: { step: unknown }) => Promise<unknown> }
    ).fn;
    const result = await innerFn({ step: mockStep });

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockPrisma.communicationLog.update).not.toHaveBeenCalled();
    expect(result).toEqual({ delivered: 0, failed: 0, skipped: 0 });
  });
});

describe('FPP-101: schema + migration + script wiring', () => {
  const schemaPath = path.join(process.cwd(), 'prisma/schema.prisma');
  const migrationPath = path.join(
    process.cwd(),
    'prisma/migrations/20260808090000_fpp101_deliverone_retry_count/migration.sql',
  );
  const owWorkflowsPath = path.join(process.cwd(), 'src/lib/ow-workflows.ts');
  const retryScriptPath = path.join(process.cwd(), 'scripts/retry-failed-comms.ts');
  const packageJsonPath = path.join(process.cwd(), 'package.json');

  it('CommunicationStatus enum gains SKIPPED', async () => {
    const schema = await fs.readFile(schemaPath, 'utf-8');
    const block = schema.match(/enum CommunicationStatus \{([^}]+)\}/);
    expect(block).not.toBeNull();
    expect(block![1]!).toContain('SKIPPED');
  });

  it('CommunicationLog model gains retryCount Int @default(0)', async () => {
    const schema = await fs.readFile(schemaPath, 'utf-8');
    const block = schema.match(/model CommunicationLog \{([\s\S]*?)^\}/m);
    expect(block).not.toBeNull();
    expect(block![1]!).toMatch(/retryCount\s+Int\s+@default\(0\)/);
  });

  it('migration adds SKIPPED to the enum and retryCount to the table', async () => {
    const sql = await fs.readFile(migrationPath, 'utf-8');
    expect(sql).toMatch(/ALTER TYPE "CommunicationStatus" ADD VALUE 'SKIPPED'/i);
    expect(sql).toMatch(
      /ALTER TABLE "CommunicationLog"\s+ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0/i,
    );
  });

  it('ow-workflows.ts wires deliverOne to email by channel and routes SMS to FAILED', async () => {
    const src = await fs.readFile(owWorkflowsPath, 'utf-8');
    expect(src).toMatch(/export async function deliverOne/);
    expect(src).toMatch(/sendEmail/);
    expect(src).toMatch(/SMS_DISABLED_FOR_LAUNCH/);
    expect(src).toMatch(/sms_disabled_for_launch/);
    expect(src).toMatch(/CommunicationStatus\.SKIPPED/);
    expect(src).toMatch(/CommunicationStatus\.SENT/);
    expect(src).toMatch(/CommunicationStatus\.FAILED/);
    // The fetch-queued projection must include the fields the worker
    // needs to dispatch (body, kind, recipientUserId, channel).
    const fetchBlock = src.split(/step\.run\(\s*\{\s*name:\s*'fetch-queued'\s*\}/)[1] ?? '';
    expect(fetchBlock).toMatch(/body:\s*true/);
    expect(fetchBlock).toMatch(/kind:\s*true/);
    expect(fetchBlock).toMatch(/recipientUserId:\s*true/);
    expect(fetchBlock).toMatch(/channel:\s*true/);
  });

  it('retry-failed-comms script exists and re-queues FAILED rows', async () => {
    const script = await fs.readFile(retryScriptPath, 'utf-8');
    expect(script).toMatch(/status:\s*CommunicationStatus\.FAILED/);
    expect(script).toMatch(/status:\s*CommunicationStatus\.QUEUED/);
    expect(script).toMatch(/retryCount:\s*\{\s*increment:\s*1\s*\}/);
    expect(script).toMatch(/--apply/);
  });

  it('package.json exposes the comms:retry-failed npm script', async () => {
    const pkg = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts['comms:retry-failed']).toBe('bun run scripts/retry-failed-comms.ts');
  });
});

describe('FPP-101: retry-failed-comms parseArgs', () => {
  it('returns apply=false with no maxRetries when called with no flags', async () => {
    const { parseArgs } = await import('../../scripts/retry-failed-comms');
    expect(parseArgs([])).toEqual({ apply: false });
  });

  it('returns apply=true when --apply is present', async () => {
    const { parseArgs } = await import('../../scripts/retry-failed-comms');
    expect(parseArgs(['--apply'])).toEqual({ apply: true });
  });

  it('parses a non-negative integer --max into maxRetries', async () => {
    const { parseArgs } = await import('../../scripts/retry-failed-comms');
    expect(parseArgs(['--apply', '--max', '3'])).toEqual({ apply: true, maxRetries: 3 });
  });

  it('rejects a negative --max instead of silently filtering on a match-nothing predicate', async () => {
    const { parseArgs } = await import('../../scripts/retry-failed-comms');
    expect(() => parseArgs(['--max', '-5'])).toThrow(/-{2}max must be a non-negative integer/);
  });

  it('rejects a non-integer --max', async () => {
    const { parseArgs } = await import('../../scripts/retry-failed-comms');
    expect(() => parseArgs(['--max', '2.5'])).toThrow(/-{2}max must be a non-negative integer/);
  });

  it('rejects a non-numeric --max', async () => {
    const { parseArgs } = await import('../../scripts/retry-failed-comms');
    expect(() => parseArgs(['--max', 'abc'])).toThrow(/-{2}max must be a non-negative integer/);
  });

  it('rejects a missing --max value', async () => {
    const { parseArgs } = await import('../../scripts/retry-failed-comms');
    expect(() => parseArgs(['--max'])).toThrow(/-{2}max must be a non-negative integer/);
  });
});
