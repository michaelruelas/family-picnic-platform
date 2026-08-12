import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextResponseJson, resetPrismaMock, makeJsonRequest } from 'tests/helpers/route';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));

const prismaMock = vi.hoisted(() => ({
  eventAttachment: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
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

import { getServerSession } from 'next-auth';
import { POST } from '~/app/api/admin/event-attachments/route';
import { PATCH, DELETE } from '~/app/api/admin/event-attachments/[id]/route';
import { AttachmentScanStatus } from '~/lib/generated/enums';

const mockedSession = vi.mocked(getServerSession);

beforeEach(() => {
  resetPrismaMock(prismaMock);
});

const baseKey = 'events/e-1/attachments/u-1/1749988800000-directions.pdf';
const baseBody = {
  eventId: 'e-1',
  key: baseKey,
  filename: 'directions.pdf',
  contentType: 'application/pdf' as const,
  sizeBytes: 1234,
};

describe('POST /api/admin/event-attachments', () => {
  it('returns 403 when caller has no admin role or EventAdmin row', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'GUEST' } } as never);
    const res = await POST(makeJsonRequest('http://x', baseBody));
    expect(res.status).toBe(403);
  });

  it('returns 400 when contentType is not application/pdf', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    const res = await POST(
      makeJsonRequest('http://x', { ...baseBody, contentType: 'image/png' as never }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when key points at a different uploader', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    const res = await POST(
      makeJsonRequest('http://x', {
        ...baseBody,
        key: 'events/e-1/attachments/u-other/1234-x.pdf',
      }),
    );
    expect(res.status).toBe(400);
  });

  it('accepts a server-issued key whose timestamp does not match `Date.now()`', async () => {
    // FPP-43 audit: the canonical-key re-derivation that used to live
    // here re-invoked `generateAttachmentS3Key`, which embeds
    // `Date.now()`. With real clocks the re-derived timestamp never
    // matches the server-issued key from `/upload-url`, so every
    // upload would 400. The route no longer re-derives the key; the
    // only gate is the prefix. This test pins the prefix-only
    // contract by submitting a key with an arbitrary older timestamp.
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.eventAttachment.create.mockResolvedValue({ id: 'a-1' } as never);
    const res = await POST(
      makeJsonRequest('http://x', {
        ...baseBody,
        key: 'events/e-1/attachments/u-1/1234567890-directions.pdf',
      }),
    );
    expect(res.status).toBe(200);
    expect(prismaMock.eventAttachment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          key: 'events/e-1/attachments/u-1/1234567890-directions.pdf',
        }),
      }),
    );
  });

  it('persists the row with virusScanStatus SKIPPED for the stub', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.eventAttachment.create.mockResolvedValue({ id: 'a-1' } as never);
    const res = await POST(makeJsonRequest('http://x', baseBody));
    expect(res.status).toBe(200);
    expect(prismaMock.eventAttachment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventId: 'e-1',
          uploadedByUserId: 'u-1',
          key: baseKey,
          filename: 'directions.pdf',
          contentType: 'application/pdf',
          sizeBytes: 1234,
          virusScanStatus: AttachmentScanStatus.SKIPPED,
        }),
      }),
    );
  });

  it('returns 500 on Prisma error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.eventAttachment.create.mockRejectedValue(new Error('boom'));
    const res = await POST(makeJsonRequest('http://x', baseBody));
    expect(res.status).toBe(500);
  });
});

describe('PATCH /api/admin/event-attachments/[id]', () => {
  const itemParams = { params: Promise.resolve({ id: 'a-1' }) };

  it('returns 404 when attachment not found', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.eventAttachment.findUnique.mockResolvedValue(null);
    const res = await PATCH(
      makeJsonRequest('http://x', { filename: 'New.pdf' }, 'PATCH'),
      itemParams,
    );
    expect(res.status).toBe(404);
  });

  it('returns 403 when caller is not an admin of the event', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'GUEST' } } as never);
    prismaMock.eventAttachment.findUnique.mockResolvedValue({
      id: 'a-1',
      eventId: 'e-1',
    } as never);
    const res = await PATCH(
      makeJsonRequest('http://x', { filename: 'New.pdf' }, 'PATCH'),
      itemParams,
    );
    expect(res.status).toBe(403);
  });

  it('renames the attachment', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.eventAttachment.findUnique.mockResolvedValue({
      id: 'a-1',
      eventId: 'e-1',
    } as never);
    prismaMock.eventAttachment.update.mockResolvedValue({} as never);
    const res = await PATCH(
      makeJsonRequest('http://x', { filename: 'New.pdf' }, 'PATCH'),
      itemParams,
    );
    expect(res.status).toBe(200);
    expect(prismaMock.eventAttachment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'a-1' },
        data: { filename: 'New.pdf' },
      }),
    );
  });

  it('rejects an empty filename', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    const res = await PATCH(makeJsonRequest('http://x', { filename: '   ' }, 'PATCH'), itemParams);
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/admin/event-attachments/[id]', () => {
  const itemParams = { params: Promise.resolve({ id: 'a-1' }) };

  it('returns 404 when attachment not found', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.eventAttachment.findUnique.mockResolvedValue(null);
    const res = await DELETE(new Request('http://x'), itemParams);
    expect(res.status).toBe(404);
  });

  it('returns 403 when caller is not an admin of the event', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'GUEST' } } as never);
    prismaMock.eventAttachment.findUnique.mockResolvedValue({
      id: 'a-1',
      eventId: 'e-1',
    } as never);
    const res = await DELETE(new Request('http://x'), itemParams);
    expect(res.status).toBe(403);
  });

  it('removes the row and best-effort cleans the object', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.eventAttachment.findUnique.mockResolvedValue({
      id: 'a-1',
      eventId: 'e-1',
      key: baseKey,
    } as never);
    prismaMock.eventAttachment.delete.mockResolvedValue({} as never);
    const res = await DELETE(new Request('http://x'), itemParams);
    expect(res.status).toBe(200);
    expect(prismaMock.eventAttachment.delete).toHaveBeenCalledWith({ where: { id: 'a-1' } });
  });

  it('returns 500 on Prisma error', async () => {
    mockedSession.mockResolvedValue({ user: { id: 'u-1', role: 'SUPER_ADMIN' } } as never);
    prismaMock.eventAttachment.findUnique.mockRejectedValue(new Error('boom'));
    const res = await DELETE(new Request('http://x'), itemParams);
    expect(res.status).toBe(500);
  });
});
