import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextResponseJson, nextResponseRedirect } from 'tests/helpers/route';

vi.mock('~/lib/s3', () => ({
  generatePresignedDownloadUrl: vi.fn(),
  isS3Configured: vi.fn(),
  PDF_DOWNLOAD_URL_EXPIRY_SECONDS: 300,
}));

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return {
    ...actual,
    NextResponse: {
      ...actual.NextResponse,
      json: nextResponseJson(),
      redirect: nextResponseRedirect(),
    },
  };
});

const prismaMock = vi.hoisted(() => ({
  eventAttachment: {
    findUnique: vi.fn(),
  },
}));
vi.mock('~/lib/prisma', () => ({ prisma: prismaMock }));

import { generatePresignedDownloadUrl, isS3Configured } from '~/lib/s3';
import { GET } from '~/app/api/public/event-attachments/[id]/download/route';
import { resetInMemoryRateLimits } from '~/lib/rate-limit';

const mockedPresign = vi.mocked(generatePresignedDownloadUrl);
const mockedS3 = vi.mocked(isS3Configured);

const itemParams = { params: Promise.resolve({ id: 'a-1' }) };

beforeEach(() => {
  vi.clearAllMocks();
  mockedPresign.mockReset();
  mockedS3.mockReset();
  resetInMemoryRateLimits();
});

describe('GET /api/public/event-attachments/[id]/download', () => {
  it('returns 429 when the caller has exceeded the per-IP rate limit', async () => {
    mockedS3.mockReturnValue(true);
    // First 10 calls fit within the window; the 11th trips the limit.
    for (let i = 0; i < 10; i += 1) {
      const res = await GET(new Request('http://x'), itemParams);
      // We don't care about the response shape, only the status.
      expect(res.status).not.toBe(429);
    }
    const blocked = await GET(new Request('http://x'), itemParams);
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('Retry-After')).toBeTruthy();
  });

  it('returns 404 when the attachment is missing', async () => {
    prismaMock.eventAttachment.findUnique.mockResolvedValue(null);
    const res = await GET(new Request('http://x'), itemParams);
    expect(res.status).toBe(404);
  });

  it('returns 404 when the parent event is not PUBLISHED', async () => {
    prismaMock.eventAttachment.findUnique.mockResolvedValue({
      id: 'a-1',
      key: 'events/e-1/attachments/u-1/x.pdf',
      filename: 'x.pdf',
      contentType: 'application/pdf',
      sizeBytes: 100,
      virusScanStatus: 'SKIPPED',
      event: { status: 'DRAFT' },
    });
    const res = await GET(new Request('http://x'), itemParams);
    expect(res.status).toBe(404);
  });

  it('returns 410 when the attachment is flagged INFECTED', async () => {
    prismaMock.eventAttachment.findUnique.mockResolvedValue({
      id: 'a-1',
      key: 'events/e-1/attachments/u-1/x.pdf',
      filename: 'x.pdf',
      contentType: 'application/pdf',
      sizeBytes: 100,
      virusScanStatus: 'INFECTED',
      event: { status: 'PUBLISHED' },
    });
    const res = await GET(new Request('http://x'), itemParams);
    expect(res.status).toBe(410);
  });

  it('returns 503 when S3 is not configured', async () => {
    prismaMock.eventAttachment.findUnique.mockResolvedValue({
      id: 'a-1',
      key: 'events/e-1/attachments/u-1/x.pdf',
      filename: 'x.pdf',
      contentType: 'application/pdf',
      sizeBytes: 100,
      virusScanStatus: 'SKIPPED',
      event: { status: 'PUBLISHED' },
    });
    mockedS3.mockReturnValue(false);
    const res = await GET(new Request('http://x'), itemParams);
    expect(res.status).toBe(503);
  });

  it('302 redirects to a presigned URL when all gates pass', async () => {
    prismaMock.eventAttachment.findUnique.mockResolvedValue({
      id: 'a-1',
      key: 'events/e-1/attachments/u-1/x.pdf',
      filename: 'x.pdf',
      contentType: 'application/pdf',
      sizeBytes: 100,
      virusScanStatus: 'SKIPPED',
      event: { status: 'PUBLISHED' },
    });
    mockedS3.mockReturnValue(true);
    mockedPresign.mockResolvedValue('https://s3.example/x.pdf?signed=1');
    const res = await GET(new Request('http://x'), itemParams);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://s3.example/x.pdf?signed=1');
    expect(mockedPresign).toHaveBeenCalledWith('events/e-1/attachments/u-1/x.pdf', {
      filename: 'x.pdf',
      expiresInSeconds: 300,
    });
  });
});
