import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { requireEventAdminApi } from '~/lib/admin-auth';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ALLOWED_IMAGE_CONTENT_TYPES, MAX_IMAGE_BYTES } from '~/lib/image-upload';

const PRESIGNED_URL_EXPIRY = 3600;

type S3Config = { ok: true; bucket: string; client: S3Client } | { ok: false; missing: string[] };

/**
 * FPP-60: build an S3 client per request from current env vars so a
 * long-running worker that rotates AWS credentials picks up the new
 * keys without a process restart. Returns a typed result so the
 * route can surface a 503 with the missing env-var names.
 */
function s3Config(): S3Config {
  // EH-004: require all three env vars AND reject empty strings. The
  // previous module-level client fell back to undefined credentials
  // when any single var was missing, which would fail silently
  // inside the SDK at PUT time.
  const required = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'S3_BUCKET_NAME'] as const;
  const missing = required.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) return { ok: false, missing };

  // FPP-69 / EH-005: mirror `src/lib/s3.ts` so the SDK signs against
  // the same endpoint the browser will PUT to. Without this, the
  // SDK falls back to virtual-hosted AWS S3 URLs (bucket.s3.region.amazonaws.com)
  // even when S3_ENDPOINT points at SeaweedFS / MinIO / R2, and
  // presigned URLs hit the wrong host.
  const endpoint = process.env.S3_ENDPOINT?.trim() || undefined;

  return {
    ok: true,
    bucket: process.env.S3_BUCKET_NAME!,
    client: new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      endpoint,
      forcePathStyle: !!endpoint,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    }),
  };
}

function generateFeaturedImageKey(eventId: string, userId: string, filename: string): string {
  // FPP-60: include a uuid so two uploads in the same millisecond
  // from the same user/event never collide on the S3 key.
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `events/${eventId}/featured/${userId}/${randomUUID()}-${sanitizedFilename}`;
}

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  // FPP-60 / EH-001: wrap the entire handler so an auth DB failure
  // or any other unexpected error surfaces as a 500 instead of an
  // unhandled rejection that takes down the route worker.
  try {
    const { id: eventId } = await params;

    const auth = await requireEventAdminApi(eventId);
    if (!auth.ok) return auth.response;

    const session = auth.session;

    const config = s3Config();
    if (!config.ok) {
      // FPP-60 / EH-002: log the misconfig so on-call sees the
      // root cause instead of a silent 503.
      console.error('[featured-image-upload-url] S3 not configured', {
        missing: config.missing,
      });
      return NextResponse.json(
        { error: 'S3 is not configured. Please set AWS credentials.' },
        { status: 503 },
      );
    }

    const body = await request.json();
    const { filename, contentType, size } = body;

    if (!filename || !contentType) {
      return NextResponse.json({ error: 'filename and contentType are required' }, { status: 400 });
    }

    if (!ALLOWED_IMAGE_CONTENT_TYPES.includes(contentType)) {
      return NextResponse.json(
        {
          error: `Invalid content type. Supported: ${ALLOWED_IMAGE_CONTENT_TYPES.join(', ')}`,
        },
        { status: 400 },
      );
    }

    // FPP-60 / DP-003: `size` is required and must be a positive
    // integer. The presigned URL pins ContentLength so a malicious
    // client cannot PUT a multi-GB file through a URL sized for a
    // 10MB hero. When the client omits size we cannot enforce the
    // cap at the S3 layer, so we reject the request.
    if (typeof size !== 'number' || !Number.isFinite(size) || size <= 0) {
      return NextResponse.json({ error: 'size must be a positive number' }, { status: 400 });
    }

    if (size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: `File too large. Maximum ${MAX_IMAGE_BYTES} bytes.` },
        { status: 400 },
      );
    }

    const key = generateFeaturedImageKey(eventId, session.user.id, filename);

    const command = new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: size,
    });

    const uploadUrl = await getSignedUrl(config.client, command, {
      expiresIn: PRESIGNED_URL_EXPIRY,
    });

    const expiresAt = new Date(Date.now() + PRESIGNED_URL_EXPIRY * 1000);

    return NextResponse.json({
      uploadUrl,
      key,
      // FPP-60: derive the public URL by stripping the presigned
      // signature, mirroring how the gallery photo flow surfaces the
      // final image URL to the client. The bucket name and region
      // come from the host portion of the presigned URL.
      publicUrl: uploadUrl.split('?')[0],
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('[featured-image-upload-url] handler error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
