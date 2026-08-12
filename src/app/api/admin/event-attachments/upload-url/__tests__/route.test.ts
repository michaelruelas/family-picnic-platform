import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextResponseJson, makeJsonRequest } from 'tests/helpers/route';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));

vi.mock('~/lib/s3', () => ({
  generateAttachmentPresignedUploadUrl: vi.fn(),
  isS3Configured: vi.fn(),
}));

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return {
    ...actual,
    NextResponse: { ...actual.NextResponse, json: nextResponseJson() },
  };
});

import { getServerSession } from 'next-auth';
import { generateAttachmentPresignedUploadUrl, isS3Configured } from '~/lib/s3';
import { POST } from '~/app/api/admin/event-attachments/upload-url/route';

const mockedSession = vi.mocked(getServerSession);
const mockedPresign = vi.mocked(generateAttachmentPresignedUploadUrl);
const mockedS3 = vi.mocked(isS3Configured);

beforeEach(() => {
  vi.clearAllMocks();
  mockedSession.mockReset();
  mockedPresign.mockReset();
  mockedS3.mockReset();
});

describe('POST /api/admin/event-attachments/upload-url', () => {
  it('returns 401 when no session', async () => {
    mockedSession.mockResolvedValue(null);
    const res = await POST(
      makeJsonRequest('http://x', {
        eventId: 'e-1',
        filename: 'a.pdf',
        contentType: 'application/pdf',
        sizeBytes: 1024,
      }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 when contentType is not application/pdf', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    const res = await POST(
      makeJsonRequest('http://x', {
        eventId: 'e-1',
        filename: 'a.exe',
        contentType: 'application/octet-stream',
        sizeBytes: 1024,
      }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when sizeBytes exceeds the cap', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    const res = await POST(
      makeJsonRequest('http://x', {
        eventId: 'e-1',
        filename: 'big.pdf',
        contentType: 'application/pdf',
        sizeBytes: 50 * 1024 * 1024,
      }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 503 when S3 is not configured', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    mockedS3.mockReturnValue(false);
    const res = await POST(
      makeJsonRequest('http://x', {
        eventId: 'e-1',
        filename: 'a.pdf',
        contentType: 'application/pdf',
        sizeBytes: 1024,
      }),
    );
    expect(res.status).toBe(503);
  });

  it('mints a presigned upload URL for valid input', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    mockedS3.mockReturnValue(true);
    mockedPresign.mockResolvedValue({
      uploadUrl: 'https://s3/presigned-put',
      key: 'events/e-1/attachments/u-1/1234-a.pdf',
      expiresAt: new Date('2025-01-01T00:00:00Z'),
    });
    const res = await POST(
      makeJsonRequest('http://x', {
        eventId: 'e-1',
        filename: 'a.pdf',
        contentType: 'application/pdf',
        sizeBytes: 1024,
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.uploadUrl).toBe('https://s3/presigned-put');
    expect(body.key).toMatch(/^events\/e-1\/attachments\/u-1\//);
    expect(body.expiresAt).toBe('2025-01-01T00:00:00.000Z');
    expect(mockedPresign).toHaveBeenCalledWith({
      eventId: 'e-1',
      userId: 'u-1',
      filename: 'a.pdf',
      contentType: 'application/pdf',
      sizeBytes: 1024,
    });
  });

  it('returns 500 when the presigner throws', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    mockedS3.mockReturnValue(true);
    mockedPresign.mockRejectedValue(new Error('S3 down'));
    const res = await POST(
      makeJsonRequest('http://x', {
        eventId: 'e-1',
        filename: 'a.pdf',
        contentType: 'application/pdf',
        sizeBytes: 1024,
      }),
    );
    expect(res.status).toBe(500);
  });
});
