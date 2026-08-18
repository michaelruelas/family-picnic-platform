import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  communicationLog: { update: vi.fn() },
}));

vi.mock('~/lib/prisma', () => ({ prisma: mockPrisma }));

const mockSendEmail = vi.hoisted(() => vi.fn());
vi.mock('~/lib/twilio-email', () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

const mockSendSMS = vi.hoisted(() => vi.fn());
const mockTwilioConfigured = vi.hoisted(() => vi.fn());
const mockIsValidE164 = vi.hoisted(() => vi.fn());
vi.mock('~/lib/twilio', () => ({
  sendSMS: (...args: unknown[]) => mockSendSMS(...args),
  isConfigured: () => mockTwilioConfigured(),
  isValidE164: (val: unknown) => mockIsValidE164(val),
}));

const mockWriteAuditLog = vi.hoisted(() => vi.fn());
vi.mock('~/lib/audit', () => ({
  writeAuditLog: (...args: unknown[]) => mockWriteAuditLog(...args),
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
  CommunicationPreference: { EMAIL: 'EMAIL', SMS: 'SMS', BOTH: 'BOTH', NONE: 'NONE' },
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
  mockSendSMS.mockReset();
  mockTwilioConfigured.mockReset();
  mockIsValidE164.mockReset();
  mockWriteAuditLog.mockReset();
  mockLoggerWarn.mockReset();
  mockLoggerError.mockReset();
  mockLoggerInfo.mockReset();
  vi.stubEnv('TWILIO_ENABLED', '');
  mockTwilioConfigured.mockReturnValue(true);
  mockIsValidE164.mockReturnValue(true);
});

const emailLog = {
  id: 'log-1',
  channel: 'EMAIL' as const,
  body: 'https://example.com/events/invitation/abc',
  kind: 'INVITATION' as const,
  recipientUserId: 'user-1',
  eventId: 'event-1',
  sentByUserId: 'admin-1',
};

const smsLog = {
  id: 'log-sms',
  channel: 'SMS' as const,
  body: 'Hi there',
  kind: 'INVITATION' as const,
  recipientUserId: 'user-1',
  eventId: 'event-1',
  sentByUserId: 'admin-1',
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

  describe('EMAIL Twilio Email error', () => {
    it('marks the log FAILED with the error message and does not throw', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        email: 'maria@example.com',
        communicationPreference: 'EMAIL',
      });
      mockSendEmail.mockResolvedValue({ success: false, error: 'Twilio Email rejected' });
      const { deliverOne } = await import('../ow-workflows');

      const result = await deliverOne(emailLog);

      expect(result).toEqual({ status: 'FAILED' });
      expect(mockPrisma.communicationLog.update).toHaveBeenCalledWith({
        where: { id: 'log-1' },
        data: {
          status: 'FAILED',
          errorCode: 'TWILIO_EMAIL_ERROR',
          errorMessage: 'Twilio Email rejected',
        },
      });
    });

    it('falls back to a generic message when Twilio Email returns no error', async () => {
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
          errorCode: 'TWILIO_EMAIL_ERROR',
          errorMessage: 'Twilio Email send failed',
        },
      });
    });
  });

  describe('EMAIL skip rules', () => {
    it('SKIPS when communicationPreference === NONE and does not call Twilio Email', async () => {
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

    it('SKIPS when the recipient email is missing and does not call Twilio Email', async () => {
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

  describe('SMS branch (TWILIO_ENABLED=false)', () => {
    it('FAILS with sms_disabled_for_launch and never imports Twilio', async () => {
      vi.stubEnv('TWILIO_ENABLED', '');
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
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
      expect(mockSendSMS).not.toHaveBeenCalled();
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

  describe('SMS branch (TWILIO_ENABLED=true)', () => {
    beforeEach(() => {
      vi.stubEnv('TWILIO_ENABLED', 'true');
      mockTwilioConfigured.mockReturnValue(true);
      mockIsValidE164.mockReturnValue(true);
    });

    it('marks SENT and calls sendSMS when recipient has consented and has a valid phone', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        phoneNumber: '+15551234567',
        smsConsent: true,
      });
      mockSendSMS.mockResolvedValue({ success: true, messageId: 'SMabc123' });
      const { deliverOne } = await import('../ow-workflows');

      const result = await deliverOne(smsLog);

      expect(result).toEqual({ status: 'SENT' });
      expect(mockSendSMS).toHaveBeenCalledWith({
        to: '+15551234567',
        body: 'Hi there',
      });
      expect(mockPrisma.communicationLog.update).toHaveBeenCalledWith({
        where: { id: 'log-sms' },
        data: {
          status: 'SENT',
          messageId: 'SMabc123',
          toPhoneNumber: '+15551234567',
          deliveredAt: expect.any(Date),
          errorCode: null,
          errorMessage: null,
        },
      });
      expect(mockWriteAuditLog).toHaveBeenCalledWith({
        userId: 'admin-1',
        eventId: 'event-1',
        action: 'communication.workerSmsDeliver',
        oldValue: { logId: 'log-sms', recipientUserId: 'user-1' },
        newValue: { status: 'SENT', messageId: 'SMabc123' },
      });
    });

    it('SKIPS with NO_CONSENT when smsConsent is false and writes audit log', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        phoneNumber: '+15551234567',
        smsConsent: false,
      });
      const { deliverOne } = await import('../ow-workflows');

      const result = await deliverOne(smsLog);

      expect(result).toEqual({ status: 'SKIPPED' });
      expect(mockSendSMS).not.toHaveBeenCalled();
      expect(mockPrisma.communicationLog.update).toHaveBeenCalledWith({
        where: { id: 'log-sms' },
        data: {
          status: 'SKIPPED',
          errorCode: 'NO_CONSENT',
          errorMessage: 'Recipient has not granted SMS consent',
        },
      });
      expect(mockWriteAuditLog).toHaveBeenCalledWith({
        userId: 'admin-1',
        eventId: 'event-1',
        action: 'communication.workerSmsDeliver',
        oldValue: { logId: 'log-sms', recipientUserId: 'user-1' },
        newValue: { status: 'SKIPPED', error: 'NO_CONSENT' },
      });
    });

    it('SKIPS with NO_PHONE when phone is missing and writes audit log', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        phoneNumber: null,
        smsConsent: true,
      });
      const { deliverOne } = await import('../ow-workflows');

      const result = await deliverOne(smsLog);

      expect(result).toEqual({ status: 'SKIPPED' });
      expect(mockSendSMS).not.toHaveBeenCalled();
      expect(mockPrisma.communicationLog.update).toHaveBeenCalledWith({
        where: { id: 'log-sms' },
        data: {
          status: 'SKIPPED',
          errorCode: 'NO_PHONE',
          errorMessage: 'Recipient has no valid E.164 phone number on file',
        },
      });
      expect(mockWriteAuditLog).toHaveBeenCalledWith({
        userId: 'admin-1',
        eventId: 'event-1',
        action: 'communication.workerSmsDeliver',
        oldValue: { logId: 'log-sms', recipientUserId: 'user-1' },
        newValue: { status: 'SKIPPED', error: 'NO_PHONE' },
      });
    });

    it('FAILS with TWILIO_ERROR when sendSMS returns failure and writes audit log', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        phoneNumber: '+15551234567',
        smsConsent: true,
      });
      mockSendSMS.mockResolvedValue({
        success: false,
        error: 'Twilio rejected',
        errorCode: 21211,
      });
      const { deliverOne } = await import('../ow-workflows');

      const result = await deliverOne(smsLog);

      expect(result).toEqual({ status: 'FAILED' });
      expect(mockPrisma.communicationLog.update).toHaveBeenCalledWith({
        where: { id: 'log-sms' },
        data: {
          status: 'FAILED',
          toPhoneNumber: '+15551234567',
          errorCode: '21211',
          errorMessage: 'Twilio rejected',
        },
      });
      expect(mockWriteAuditLog).toHaveBeenCalledWith({
        userId: 'admin-1',
        eventId: 'event-1',
        action: 'communication.workerSmsDeliver',
        oldValue: { logId: 'log-sms', recipientUserId: 'user-1' },
        newValue: { status: 'FAILED', error: 'Twilio rejected', errorCode: '21211' },
      });
    });

    it('FAILS with TWILIO_NOT_CONFIGURED when enabled but credentials missing', async () => {
      mockTwilioConfigured.mockReturnValue(false);
      const { deliverOne } = await import('../ow-workflows');

      const result = await deliverOne(smsLog);

      expect(result).toEqual({ status: 'FAILED' });
      expect(mockSendSMS).not.toHaveBeenCalled();
      expect(mockPrisma.communicationLog.update).toHaveBeenCalledWith({
        where: { id: 'log-sms' },
        data: {
          status: 'FAILED',
          errorCode: 'TWILIO_NOT_CONFIGURED',
          errorMessage: 'TWILIO_ENABLED is true but Twilio credentials are missing',
        },
      });
      expect(mockWriteAuditLog).toHaveBeenCalledWith({
        userId: 'admin-1',
        eventId: 'event-1',
        action: 'communication.workerSmsDeliver',
        oldValue: { logId: 'log-sms', recipientUserId: 'user-1' },
        newValue: { status: 'FAILED', error: 'TWILIO_NOT_CONFIGURED' },
      });
    });

    it('SKIPS with NO_RECIPIENT when recipientUserId is null', async () => {
      const { deliverOne } = await import('../ow-workflows');

      const result = await deliverOne({ ...smsLog, recipientUserId: null });

      expect(result).toEqual({ status: 'SKIPPED' });
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
      expect(mockSendSMS).not.toHaveBeenCalled();
      expect(mockPrisma.communicationLog.update).toHaveBeenCalledWith({
        where: { id: 'log-sms' },
        data: {
          status: 'SKIPPED',
          errorCode: 'NO_RECIPIENT',
          errorMessage: 'CommunicationLog has no recipientUserId',
        },
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
