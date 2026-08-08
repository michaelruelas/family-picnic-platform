import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  communicationLog: { update: vi.fn() },
}));

vi.mock('~/lib/prisma', () => ({ prisma: mockPrisma }));

const mockSendEmail = vi.hoisted(() => vi.fn());
vi.mock('~/lib/sendgrid', () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

const mockLoggerWarn = vi.hoisted(() => vi.fn());
const mockLoggerError = vi.hoisted(() => vi.fn());
const mockLoggerInfo = vi.hoisted(() => vi.fn());
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
  mockPrisma.user.findUnique.mockReset();
  mockPrisma.communicationLog.update.mockReset();
  mockSendEmail.mockReset();
  mockLoggerWarn.mockReset();
  mockLoggerError.mockReset();
  mockLoggerInfo.mockReset();
});

const emailLog = {
  id: 'log-1',
  channel: 'EMAIL' as const,
  body: 'https://example.com/events/invitation/abc',
  kind: 'INVITATION' as const,
  recipientUserId: 'user-1',
  eventId: 'event-1',
};

const smsLog = {
  id: 'log-sms',
  channel: 'SMS' as const,
  body: 'Hi there',
  kind: 'INVITATION' as const,
  recipientUserId: 'user-1',
  eventId: 'event-1',
};

describe('deliverOne (FPP-101)', () => {
  describe('EMAIL happy path', () => {
    it('marks the log SENT and calls sendEmail with the recipient + body', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        email: 'maria@example.com',
        communicationPreference: 'EMAIL',
      });
      mockSendEmail.mockResolvedValue({ success: true, messageId: 'msg-abc' });
      const { deliverOne } = await import('../ow-workflows');

      const result = await deliverOne(emailLog);

      expect(result).toEqual({ status: 'SENT' });
      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      expect(mockSendEmail).toHaveBeenCalledWith({
        to: 'maria@example.com',
        subject: 'You are invited to the Family Picnic',
        html: emailLog.body,
        text: emailLog.body,
      });
      expect(mockPrisma.communicationLog.update).toHaveBeenCalledWith({
        where: { id: 'log-1' },
        data: {
          status: 'SENT',
          messageId: 'msg-abc',
          deliveredAt: expect.any(Date),
          errorCode: null,
          errorMessage: null,
        },
      });
    });

    it('accepts the BOTH preference as a non-blocking email channel', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        email: 'maria@example.com',
        communicationPreference: 'BOTH',
      });
      mockSendEmail.mockResolvedValue({ success: true, messageId: 'msg-1' });
      const { deliverOne } = await import('../ow-workflows');

      const result = await deliverOne(emailLog);

      expect(result).toEqual({ status: 'SENT' });
      expect(mockSendEmail).toHaveBeenCalledTimes(1);
    });
  });

  describe('EMAIL SendGrid error', () => {
    it('marks the log FAILED with the error message and does not throw', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        email: 'maria@example.com',
        communicationPreference: 'EMAIL',
      });
      mockSendEmail.mockResolvedValue({ success: false, error: 'SendGrid rejected' });
      const { deliverOne } = await import('../ow-workflows');

      const result = await deliverOne(emailLog);

      expect(result).toEqual({ status: 'FAILED' });
      expect(mockPrisma.communicationLog.update).toHaveBeenCalledWith({
        where: { id: 'log-1' },
        data: {
          status: 'FAILED',
          errorCode: 'SENDGRID_ERROR',
          errorMessage: 'SendGrid rejected',
        },
      });
    });

    it('falls back to a generic message when SendGrid returns no error', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        email: 'maria@example.com',
        communicationPreference: 'EMAIL',
      });
      mockSendEmail.mockResolvedValue({ success: false });
      const { deliverOne } = await import('../ow-workflows');

      const result = await deliverOne(emailLog);

      expect(result).toEqual({ status: 'FAILED' });
      expect(mockPrisma.communicationLog.update).toHaveBeenCalledWith({
        where: { id: 'log-1' },
        data: {
          status: 'FAILED',
          errorCode: 'SENDGRID_ERROR',
          errorMessage: 'SendGrid send failed',
        },
      });
    });
  });

  describe('EMAIL skip rules', () => {
    it('SKIPS when communicationPreference === NONE and does not call SendGrid', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        email: 'maria@example.com',
        communicationPreference: 'NONE',
      });
      const { deliverOne } = await import('../ow-workflows');

      const result = await deliverOne(emailLog);

      expect(result).toEqual({ status: 'SKIPPED' });
      expect(mockSendEmail).not.toHaveBeenCalled();
      expect(mockPrisma.communicationLog.update).toHaveBeenCalledWith({
        where: { id: 'log-1' },
        data: {
          status: 'SKIPPED',
          errorCode: 'OPTED_OUT',
          errorMessage: 'Recipient opted out of communications',
        },
      });
    });

    it('SKIPS when the recipient email is missing and does not call SendGrid', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        email: null,
        communicationPreference: 'EMAIL',
      });
      const { deliverOne } = await import('../ow-workflows');

      const result = await deliverOne(emailLog);

      expect(result).toEqual({ status: 'SKIPPED' });
      expect(mockSendEmail).not.toHaveBeenCalled();
      expect(mockPrisma.communicationLog.update).toHaveBeenCalledWith({
        where: { id: 'log-1' },
        data: {
          status: 'SKIPPED',
          errorCode: 'NO_EMAIL',
          errorMessage: 'Recipient has no email on file',
        },
      });
    });

    it('SKIPS when the recipient row does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const { deliverOne } = await import('../ow-workflows');

      const result = await deliverOne(emailLog);

      expect(result).toEqual({ status: 'SKIPPED' });
      expect(mockSendEmail).not.toHaveBeenCalled();
      expect(mockPrisma.communicationLog.update).toHaveBeenCalledWith({
        where: { id: 'log-1' },
        data: {
          status: 'SKIPPED',
          errorCode: 'NO_EMAIL',
          errorMessage: 'Recipient has no email on file',
        },
      });
    });

    it('SKIPS when the log has no recipientUserId at all', async () => {
      const { deliverOne } = await import('../ow-workflows');

      const result = await deliverOne({
        ...emailLog,
        recipientUserId: null,
      });

      expect(result).toEqual({ status: 'SKIPPED' });
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
      expect(mockSendEmail).not.toHaveBeenCalled();
      expect(mockPrisma.communicationLog.update).toHaveBeenCalledWith({
        where: { id: 'log-1' },
        data: {
          status: 'SKIPPED',
          errorCode: 'NO_RECIPIENT',
          errorMessage: 'CommunicationLog has no recipientUserId',
        },
      });
    });
  });

  describe('SMS inert branch', () => {
    it('FAILS with sms_disabled_for_launch and never imports Twilio', async () => {
      const { deliverOne } = await import('../ow-workflows');

      const result = await deliverOne(smsLog);

      expect(result).toEqual({ status: 'FAILED' });
      expect(mockPrisma.communicationLog.update).toHaveBeenCalledWith({
        where: { id: 'log-sms' },
        data: {
          status: 'FAILED',
          errorCode: 'SMS_DISABLED_FOR_LAUNCH',
          errorMessage: 'sms_disabled_for_launch',
        },
      });
      // The SMS branch must never reach the recipient lookup.
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
      // The SMS branch must never call SendGrid.
      expect(mockSendEmail).not.toHaveBeenCalled();
      // A warning lands in the logger so the admin can see the
      // inert branch fired.
      expect(mockLoggerWarn).toHaveBeenCalledTimes(1);
      const [context, message] = mockLoggerWarn.mock.calls[0]!;
      expect(message).toContain('sms_disabled_for_launch');
      expect(context).toMatchObject({
        logId: 'log-sms',
        recipientUserId: 'user-1',
        eventId: 'event-1',
      });
    });
  });

  describe('subject lines', () => {
    it('uses a decline-note subject for DECLINE_NOTE rows', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        email: 'owner@example.com',
        communicationPreference: 'EMAIL',
      });
      mockSendEmail.mockResolvedValue({ success: true });
      const { deliverOne } = await import('../ow-workflows');

      await deliverOne({
        ...emailLog,
        kind: 'DECLINE_NOTE',
        body: 'Sorry we cannot make it',
      });

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ subject: 'Decline note forwarded' }),
      );
    });

    it('falls back to a broadcast subject for BROADCAST rows', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        email: 'maria@example.com',
        communicationPreference: 'EMAIL',
      });
      mockSendEmail.mockResolvedValue({ success: true });
      const { deliverOne } = await import('../ow-workflows');

      await deliverOne({
        ...emailLog,
        kind: 'BROADCAST',
        body: 'Park opens at 9am',
      });

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ subject: 'Family Picnic update' }),
      );
    });

    it('passes an empty body to sendEmail when body is null', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        email: 'maria@example.com',
        communicationPreference: 'EMAIL',
      });
      mockSendEmail.mockResolvedValue({ success: true });
      const { deliverOne } = await import('../ow-workflows');

      await deliverOne({
        ...emailLog,
        body: null,
      });

      expect(mockSendEmail).toHaveBeenCalledWith({
        to: 'maria@example.com',
        subject: 'You are invited to the Family Picnic',
        html: '',
        text: '',
      });
    });
  });
});
