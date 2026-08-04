import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  communicationLog: { create: vi.fn() },
}));

vi.mock('~/lib/prisma', () => ({ prisma: mockPrisma }));

const mockWriteAuditLog = vi.fn();
vi.mock('~/lib/audit', () => ({
  writeAuditLog: (...args: unknown[]) => mockWriteAuditLog(...args),
}));

const mockSendSMS = vi.fn();
const mockGetFromPhoneNumber: Mock<(value?: string | null) => string | null> = vi.fn<
  () => string | null
>(() => '+15551234567');
const mockIsValidE164 = vi.fn(
  (value: unknown) => typeof value === 'string' && /^\+[1-9]\d{1,14}$/.test(value),
);
const mockIsConfigured = vi.fn(() => true);

vi.mock('~/lib/twilio', () => ({
  sendSMS: (...args: unknown[]) => mockSendSMS(...args),
  getFromPhoneNumber: () => mockGetFromPhoneNumber(),
  isValidE164: (value: unknown) => mockIsValidE164(value),
  isConfigured: () => mockIsConfigured(),
}));

beforeEach(() => {
  mockPrisma.user.findUnique.mockReset();
  mockPrisma.communicationLog.create.mockReset();
  mockWriteAuditLog.mockReset();
  mockSendSMS.mockReset();
  mockGetFromPhoneNumber.mockReset();
  mockIsValidE164.mockReset();
  mockIsConfigured.mockReset();

  mockGetFromPhoneNumber.mockReturnValue('+15551234567');
  mockIsValidE164.mockImplementation(
    (value: unknown) => typeof value === 'string' && /^\+[1-9]\d{1,14}$/.test(value),
  );
  mockIsConfigured.mockReturnValue(true);
});

describe('dispatchAdminSms', () => {
  it('returns PROVIDER_NOT_CONFIGURED when isConfigured is false', async () => {
    mockIsConfigured.mockReturnValue(false);
    const { dispatchAdminSms } = await import('../sms-dispatch');
    const result = await dispatchAdminSms({
      adminUserId: 'a-1',
      recipientUserId: 'r-1',
      body: 'Hi',
      eventId: 'e-1',
      auditAction: 'admin.sendSms',
    });
    expect(result).toEqual({ kind: 'PROVIDER_NOT_CONFIGURED' });
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('returns PROVIDER_NOT_CONFIGURED when from-phone is missing or invalid', async () => {
    mockGetFromPhoneNumber.mockReturnValue(null);
    const { dispatchAdminSms } = await import('../sms-dispatch');
    const result = await dispatchAdminSms({
      adminUserId: 'a-1',
      recipientUserId: 'r-1',
      body: 'Hi',
      auditAction: 'sms.send',
    });
    expect(result).toEqual({ kind: 'PROVIDER_NOT_CONFIGURED' });
  });

  it('returns RECIPIENT_NOT_FOUND when the recipient does not exist', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const { dispatchAdminSms } = await import('../sms-dispatch');
    const result = await dispatchAdminSms({
      adminUserId: 'a-1',
      recipientUserId: 'missing',
      body: 'Hi',
      eventId: 'e-1',
      auditAction: 'admin.sendSms',
    });
    expect(result).toEqual({ kind: 'RECIPIENT_NOT_FOUND' });
  });

  it('writes NO_CONSENT log and audit when smsConsent is false', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'r-1',
      phoneNumber: '+15551234567',
      smsConsent: false,
    });
    mockPrisma.communicationLog.create.mockResolvedValue({ id: 'log-no-consent' });
    const { dispatchAdminSms } = await import('../sms-dispatch');
    const result = await dispatchAdminSms({
      adminUserId: 'a-1',
      recipientUserId: 'r-1',
      body: 'Hi',
      eventId: 'e-1',
      auditAction: 'admin.sendSms',
    });
    expect(result).toEqual({
      kind: 'NO_CONSENT',
      recipientId: 'r-1',
      communicationLogId: 'log-no-consent',
    });
    expect(mockPrisma.communicationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ errorCode: 'NO_CONSENT', status: 'FAILED' }),
      }),
    );
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        newValue: { status: 'REJECTED', error: 'NO_CONSENT' },
      }),
    );
  });

  it('skips CommunicationLog when eventId is omitted on NO_CONSENT', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'r-1',
      phoneNumber: '+15551234567',
      smsConsent: false,
    });
    const { dispatchAdminSms } = await import('../sms-dispatch');
    const result = await dispatchAdminSms({
      adminUserId: 'a-1',
      recipientUserId: 'r-1',
      body: 'Hi',
      auditAction: 'sms.send',
    });
    expect(result).toEqual({ kind: 'NO_CONSENT', recipientId: 'r-1', communicationLogId: null });
    expect(mockPrisma.communicationLog.create).not.toHaveBeenCalled();
    expect(mockWriteAuditLog).toHaveBeenCalled();
  });

  it('writes NO_PHONE log and audit when phone is missing or invalid', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'r-1',
      phoneNumber: '5551234567',
      smsConsent: true,
    });
    mockPrisma.communicationLog.create.mockResolvedValue({ id: 'log-no-phone' });
    const { dispatchAdminSms } = await import('../sms-dispatch');
    const result = await dispatchAdminSms({
      adminUserId: 'a-1',
      recipientUserId: 'r-1',
      body: 'Hi',
      eventId: 'e-1',
      auditAction: 'admin.sendSms',
    });
    expect(result).toEqual({
      kind: 'NO_PHONE',
      recipientId: 'r-1',
      communicationLogId: 'log-no-phone',
    });
    expect(mockPrisma.communicationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ errorCode: 'NO_PHONE', status: 'FAILED' }),
      }),
    );
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        newValue: { status: 'REJECTED', error: 'NO_PHONE' },
      }),
    );
  });

  it('sends, writes log+audit, and returns SENT on success', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'r-1',
      phoneNumber: '+15551234567',
      smsConsent: true,
    });
    mockSendSMS.mockResolvedValue({ success: true, messageId: 'SMxyz' });
    mockPrisma.communicationLog.create.mockResolvedValue({ id: 'log-1' });
    const { dispatchAdminSms } = await import('../sms-dispatch');
    const result = await dispatchAdminSms({
      adminUserId: 'a-1',
      recipientUserId: 'r-1',
      body: 'Hi there',
      eventId: 'e-1',
      auditAction: 'admin.sendSms',
    });
    expect(result).toEqual({
      kind: 'SENT',
      recipientId: 'r-1',
      messageId: 'SMxyz',
      communicationLogId: 'log-1',
    });
    expect(mockSendSMS).toHaveBeenCalledWith({ to: '+15551234567', body: 'Hi there' });
    expect(mockPrisma.communicationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'SENT',
          messageId: 'SMxyz',
          toPhoneNumber: '+15551234567',
          fromPhoneNumber: '+15551234567',
          deliveredAt: expect.any(Date),
        }),
      }),
    );
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        newValue: expect.objectContaining({ status: 'SENT', messageId: 'SMxyz' }),
      }),
    );
  });

  it('writes FAILED log and TWILIO_ERROR outcome on provider failure', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'r-1',
      phoneNumber: '+15551234567',
      smsConsent: true,
    });
    mockSendSMS.mockResolvedValue({
      success: false,
      error: 'Twilio rejected',
      errorCode: 21610,
    });
    mockPrisma.communicationLog.create.mockResolvedValue({ id: 'log-fail' });
    const { dispatchAdminSms } = await import('../sms-dispatch');
    const result = await dispatchAdminSms({
      adminUserId: 'a-1',
      recipientUserId: 'r-1',
      body: 'Hi',
      eventId: 'e-1',
      auditAction: 'admin.sendSms',
    });
    expect(result).toEqual({
      kind: 'TWILIO_ERROR',
      recipientId: 'r-1',
      error: 'Twilio rejected',
      errorCode: 21610,
      communicationLogId: 'log-fail',
    });
    expect(mockPrisma.communicationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED', errorCode: '21610' }),
      }),
    );
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'a-1',
        eventId: 'e-1',
        action: 'admin.sendSms',
        newValue: expect.objectContaining({
          status: 'FAILED',
          error: 'Twilio rejected',
          errorCode: '21610',
        }),
      }),
    );
  });

  it('passes eventId through to the audit log', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'r-1',
      phoneNumber: '+15551234567',
      smsConsent: true,
    });
    mockSendSMS.mockResolvedValue({ success: true, messageId: 'SMxyz' });
    mockPrisma.communicationLog.create.mockResolvedValue({ id: 'log-1' });
    const { dispatchAdminSms } = await import('../sms-dispatch');
    await dispatchAdminSms({
      adminUserId: 'a-1',
      recipientUserId: 'r-1',
      body: 'Hi',
      eventId: 'e-1',
      auditAction: 'admin.sendSms',
    });
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'a-1', eventId: 'e-1', action: 'admin.sendSms' }),
    );
  });
});
