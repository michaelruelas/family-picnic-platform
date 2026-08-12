import { NextResponse } from 'next/server';
import { prisma } from '~/lib/prisma';
import {
  PDF_DOWNLOAD_URL_EXPIRY_SECONDS,
  generatePresignedDownloadUrl,
  isS3Configured,
} from '~/lib/s3';
import { checkInMemoryIpRateLimit, PDF_DOWNLOADS_PER_MINUTE } from '~/lib/rate-limit';
import { extractClientIp, parseTrustedProxyIps } from '~/lib/client-ip';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * FPP-43 / FPP-1: public, rate-limited PDF download endpoint.
 *
 * - Looks up the attachment by id. Returns 404 when missing or
 *   when the parent event is not PUBLISHED.
 * - Issues a 302 redirect to a short-lived (5 minute) presigned GET
 *   URL. The S3 URL is never returned to the caller.
 * - Rate-limited per IP via `checkInMemoryIpRateLimit`. When the
 *   caller has exceeded `PDF_DOWNLOADS_PER_MINUTE` in the last
 *   minute the endpoint returns 429 with a `Retry-After` header.
 *
 * The endpoint is unauthenticated on purpose: the event page is
 * public, so the PDFs on it must be too. The rate limit and the
 * short-lived URL are the only gates.
 */
export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;

  const ipResult = checkInMemoryIpRateLimit(
    extractClientIp(request.headers, parseTrustedProxyIps(process.env.TRUSTED_PROXY_IPS)).ip,
    PDF_DOWNLOADS_PER_MINUTE,
  );
  if (!ipResult.allowed) {
    const retryAfterSeconds = Math.max(1, Math.ceil((ipResult.retryAfterMs ?? 0) / 1000));
    return NextResponse.json(
      { error: 'Too many download attempts. Please slow down.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfterSeconds),
        },
      },
    );
  }

  const attachment = await prisma.eventAttachment.findUnique({
    where: { id },
    select: {
      id: true,
      key: true,
      filename: true,
      contentType: true,
      sizeBytes: true,
      virusScanStatus: true,
      event: { select: { status: true } },
    },
  });

  if (!attachment || attachment.event.status !== 'PUBLISHED') {
    // 404 (not 403) so unauthenticated visitors do not learn whether
    // a given attachment id exists on a draft event.
    return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
  }

  // First ship: SKIPPED is treated as "safe to serve". A future
  // worker can flip SKIPPED rows to INFECTED to retroactively
  // block a malicious upload.
  if (attachment.virusScanStatus === 'INFECTED') {
    return NextResponse.json({ error: 'Attachment is unavailable' }, { status: 410 });
  }

  if (!isS3Configured()) {
    return NextResponse.json({ error: 'S3-compatible storage is not configured' }, { status: 503 });
  }

  try {
    const url = await generatePresignedDownloadUrl(attachment.key, PDF_DOWNLOAD_URL_EXPIRY_SECONDS);
    return NextResponse.redirect(url, {
      status: 302,
      headers: {
        // Hint to CDNs that the redirect target is private and
        // should not be cached.
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('Failed to mint download URL for event attachment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
