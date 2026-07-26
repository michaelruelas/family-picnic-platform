import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('~/lib/s3', () => ({
  generatePresignedUploadUrl: vi.fn(),
  isS3Configured: vi.fn(),
}));

vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        status: init?.status ?? 200,
        headers: {
          'content-type': 'application/json',
          ...(init?.headers as Record<string, string>),
        },
      }),
  },
}));

import { getServerSession } from 'next-auth';
import { generatePresignedUploadUrl, isS3Configured } from '~/lib/s3';
import { POST } from '~/app/api/photo-upload-url/route';

const mockedSession = vi.mocked(getServerSession);
const mockedPresign = vi.mocked(generatePresignedUploadUrl);
const mockedS3 = vi.mocked(isS3Configured);

function makeReq(body: unknown): Request {
  return new Request('http://localhost/api/photo-upload-url', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedSession.mockReset();
  mockedPresign.mockReset();
  mockedS3.mockReset();
});

describe('POST /api/photo-upload-url', () => {
  it('returns 401 when no session', async () => {
    mockedSession.mockResolvedValue(null);
    const res = await POST(
      makeReq({ eventId: 'e1', filename: 'a.jpg', contentType: 'image/jpeg' }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 503 when S3 is not configured', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    mockedS3.mockReturnValue(false);
    const res = await POST(
      makeReq({ eventId: 'e1', filename: 'a.jpg', contentType: 'image/jpeg' }),
    );
    expect(res.status).toBe(503);
  });

  it('returns 400 when fields are missing', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    mockedS3.mockReturnValue(true);
    const res = await POST(makeReq({ eventId: 'e1' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid content type', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    mockedS3.mockReturnValue(true);
    const res = await POST(
      makeReq({ eventId: 'e1', filename: 'a.exe', contentType: 'application/octet-stream' }),
    );
    expect(res.status).toBe(400);
  });

  it('generates presigned URL for valid input', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    mockedS3.mockReturnValue(true);
    mockedPresign.mockResolvedValue({
      uploadUrl: 'https://s3/presigned',
      key: 'photos/u-1/abc.jpg',
      expiresAt: new Date('2025-01-01T00:00:00Z'),
    });
    const res = await POST(
      makeReq({ eventId: 'e1', filename: 'a.jpg', contentType: 'image/jpeg' }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.uploadUrl).toBe('https://s3/presigned');
    expect(body.key).toBe('photos/u-1/abc.jpg');
    expect(body.expiresAt).toBe('2025-01-01T00:00:00.000Z');
  });

  it('returns 500 when S3 throws', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1' } } as never);
    mockedS3.mockReturnValue(true);
    mockedPresign.mockRejectedValue(new Error('S3 down'));
    const res = await POST(
      makeReq({ eventId: 'e1', filename: 'a.jpg', contentType: 'image/jpeg' }),
    );
    expect(res.status).toBe(500);
  });
});
