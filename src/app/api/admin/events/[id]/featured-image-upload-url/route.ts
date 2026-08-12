import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { requireEventAdminApi } from '~/lib/admin-auth';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: process.env.AWS_ACCESS_KEY_ID
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      }
    : undefined,
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'family-picnic-photos';
const PRESIGNED_URL_EXPIRY = 3600;

const VALID_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const MAX_BYTES = 10 * 1024 * 1024;

function generateFeaturedImageKey(eventId: string, userId: string, filename: string): string {
  // FPP-60: include a uuid so two uploads in the same millisecond
  // from the same user/event never collide on the S3 key.
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `events/${eventId}/featured/${userId}/${randomUUID()}-${sanitizedFilename}`;
}

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  const { id: eventId } = await params;

  const auth = await requireEventAdminApi(eventId);
  if (!auth.ok) return auth.response;

  const session = auth.session;

  if (
    !process.env.AWS_ACCESS_KEY_ID ||
    !process.env.AWS_SECRET_ACCESS_KEY ||
    !process.env.S3_BUCKET_NAME
  ) {
    return NextResponse.json(
      { error: 'S3 is not configured. Please set AWS credentials.' },
      { status: 503 },
    );
  }

  try {
    const body = await request.json();
    const { filename, contentType, size } = body;

    if (!filename || !contentType) {
      return NextResponse.json({ error: 'filename and contentType are required' }, { status: 400 });
    }

    if (!VALID_CONTENT_TYPES.includes(contentType)) {
      return NextResponse.json(
        { error: 'Invalid content type. Supported: JPEG, PNG, WebP, HEIC, HEIF' },
        { status: 400 },
      );
    }

    if (typeof size === 'number' && size > MAX_BYTES) {
      return NextResponse.json({ error: 'File too large. Maximum 10MB.' }, { status: 400 });
    }

    const key = generateFeaturedImageKey(eventId, session.user.id, filename);

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType,
      // FPP-60: pin ContentLength on the presigned URL so a client
      // cannot PUT a multi-GB file through a URL sized for a 10MB
      // hero. Only set when the client provided a positive size;
      // absence of `size` keeps the URL permissive (the cap is
      // enforced server-side via the validation above).
      ...(typeof size === 'number' && size > 0 ? { ContentLength: size } : {}),
    });

    const uploadUrl = await getSignedUrl(s3Client, command, {
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
    console.error('Generate featured image upload URL error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
