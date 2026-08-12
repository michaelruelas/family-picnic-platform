import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextResponseJson, resetPrismaMock, makeJsonRequest } from 'tests/helpers/route';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));

const prismaMock = vi.hoisted(() => ({
  event: { findUnique: vi.fn() },
  // FPP-104: per-event gate checks EventAdmin membership.
  eventAdmin: { findUnique: vi.fn(() => Promise.resolve(null)) },
}));
vi.mock('~/lib/prisma', () => ({ prisma: prismaMock }));

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return {
    ...actual,
    NextResponse: { ...actual.NextResponse, json: nextResponseJson() },
  };
});

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(),
  PutObjectCommand: vi.fn(),
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn(async () => 'https://bucket.s3.amazonaws.com/featured?signature=xyz'),
}));

import { getServerSession } from 'next-auth';
import { POST } from '~/app/api/admin/events/[id]/featured-image-upload-url/route';

const mockedSession = vi.mocked(getServerSession);
const eventParams = { params: Promise.resolve({ id: 'e-1' }) };

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  resetPrismaMock(prismaMock);
  process.env = {
    ...ORIGINAL_ENV,
    AWS_ACCESS_KEY_ID: 'AKIA-test',
    AWS_SECRET_ACCESS_KEY: 'secret-test',
    S3_BUCKET_NAME: 'test-bucket',
  };
});

describe('POST /api/admin/events/[id]/featured-image-upload-url', () => {
  it('returns 401 when no session', async () => {
    mockedSession.mockResolvedValue(null);
    const res = await POST(
      makeJsonRequest('http://x', { filename: 'a.jpg', contentType: 'image/jpeg' }),
      eventParams,
    );
    expect(res.status).toBe(401);
  });

  it('returns 403 when session is for a user with no admin or EventAdmin row', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'GUEST' } } as never);
    const res = await POST(
      makeJsonRequest('http://x', { filename: 'a.jpg', contentType: 'image/jpeg' }),
      eventParams,
    );
    expect(res.status).toBe(403);
  });

  it('returns 503 when S3 is not configured', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    process.env = { ...ORIGINAL_ENV };
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.S3_BUCKET_NAME;
    const res = await POST(
      makeJsonRequest('http://x', { filename: 'a.jpg', contentType: 'image/jpeg' }),
      eventParams,
    );
    expect(res.status).toBe(503);
  });

  it('returns 400 when filename or contentType missing', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    const res = await POST(makeJsonRequest('http://x', { filename: 'a.jpg' }), eventParams);
    expect(res.status).toBe(400);
  });

  it('returns 400 when contentType is invalid', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    const res = await POST(
      makeJsonRequest('http://x', { filename: 'a.gif', contentType: 'image/gif' }),
      eventParams,
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when file exceeds max size', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    const res = await POST(
      makeJsonRequest('http://x', {
        filename: 'a.jpg',
        contentType: 'image/jpeg',
        size: 20 * 1024 * 1024,
      }),
      eventParams,
    );
    expect(res.status).toBe(400);
  });

  it('returns presigned URL and public URL on success', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    const res = await POST(
      makeJsonRequest('http://x', {
        filename: 'hero.jpg',
        contentType: 'image/jpeg',
        size: 1024,
      }),
      eventParams,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      uploadUrl: string;
      key: string;
      publicUrl: string;
      expiresAt: string;
    };
    expect(body.uploadUrl).toMatch(
      /^https:\/\/bucket\.s3\.amazonaws\.com\/featured\?signature=xyz$/,
    );
    // FPP-60: keys are uuid-based now (no Date.now()), so the path
    // is `events/{id}/featured/{user}/{uuid}-{file}`.
    expect(body.key).toMatch(/^events\/e-1\/featured\/u-1\/[0-9a-f-]+-hero\.jpg$/);
    expect(body.publicUrl).toBe('https://bucket.s3.amazonaws.com/featured');
    expect(typeof body.expiresAt).toBe('string');
  });

  it('FPP-104: allows a HOST with an EventAdmin row for the event', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'host-1', role: 'HOST' } } as never);
    prismaMock.eventAdmin.findUnique.mockResolvedValue({ id: 'ea-1' } as never);
    const res = await POST(
      makeJsonRequest('http://x', {
        filename: 'hero.jpg',
        contentType: 'image/jpeg',
        size: 1024,
      }),
      eventParams,
    );
    expect(res.status).toBe(200);
  });

  it('FPP-104: returns 403 when a HOST has no EventAdmin row for the event', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'host-1', role: 'HOST' } } as never);
    prismaMock.eventAdmin.findUnique.mockResolvedValue(null);
    const res = await POST(
      makeJsonRequest('http://x', { filename: 'a.jpg', contentType: 'image/jpeg' }),
      eventParams,
    );
    expect(res.status).toBe(403);
  });

  it('FPP-60: pins ContentLength on the presigned URL when size is provided', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    await POST(
      makeJsonRequest('http://x', {
        filename: 'hero.jpg',
        contentType: 'image/jpeg',
        size: 1024,
      }),
      eventParams,
    );
    const lastCall = vi.mocked(PutObjectCommand).mock.calls.at(-1)?.[0] as {
      ContentLength?: number;
    };
    expect(lastCall.ContentLength).toBe(1024);
  });

  it('FPP-60: omits ContentLength when the client did not send size', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    await POST(
      makeJsonRequest('http://x', {
        filename: 'hero.jpg',
        contentType: 'image/jpeg',
      }),
      eventParams,
    );
    const lastCall = vi.mocked(PutObjectCommand).mock.calls.at(-1)?.[0] as {
      ContentLength?: number;
    };
    expect(lastCall.ContentLength).toBeUndefined();
  });

  it('returns 500 on error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    vi.mocked(getSignedUrl).mockRejectedValueOnce(new Error('boom'));
    const res = await POST(
      makeJsonRequest('http://x', { filename: 'hero.jpg', contentType: 'image/jpeg' }),
      eventParams,
    );
    expect(res.status).toBe(500);
  });
});
