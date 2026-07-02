import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth';
import { generatePresignedUploadUrl, isS3Configured } from '~/lib/s3';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isS3Configured()) {
    return NextResponse.json(
      { error: 'S3 is not configured. Please set AWS credentials.' },
      { status: 503 },
    );
  }

  try {
    const body = await request.json();
    const { eventId, filename, contentType } = body;

    if (!eventId || !filename || !contentType) {
      return NextResponse.json(
        { error: 'eventId, filename, and contentType are required' },
        { status: 400 },
      );
    }

    const validContentTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (!validContentTypes.includes(contentType)) {
      return NextResponse.json(
        { error: 'Invalid content type. Supported: JPEG, PNG, WebP, HEIC, HEIF' },
        { status: 400 },
      );
    }

    const { uploadUrl, key, expiresAt } = await generatePresignedUploadUrl(
      eventId,
      session.user.id,
      filename,
      contentType,
    );

    return NextResponse.json({
      uploadUrl,
      key,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('Generate upload URL error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
