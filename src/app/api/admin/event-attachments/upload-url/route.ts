import { NextResponse } from 'next/server';
import { requireEventAdminApi } from '~/lib/admin-auth';
import { generateAttachmentPresignedUploadUrl, isS3Configured } from '~/lib/s3';
import { eventAttachmentUploadUrlSchema } from '~/lib/schemas/event-attachment';

/**
 * FPP-43 / FPP-2: admin-only endpoint that returns a presigned PUT
 * URL for a single PDF attachment. Mirrors the photo upload-url
 * endpoint but targets the `events/{eventId}/attachments/...` prefix
 * and rejects non-PDF content types.
 *
 * Per-event auth (`requireEventAdminApi`) so a HOST can mint upload
 * URLs only for events they administer; super-admins bypass the row
 * check.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const probe = eventAttachmentUploadUrlSchema.safeParse(body);
  if (!probe.success) {
    const firstError = probe.error.issues[0];
    return NextResponse.json({ error: firstError?.message ?? 'Invalid input' }, { status: 400 });
  }

  const auth = await requireEventAdminApi(probe.data.eventId);
  if (!auth.ok) return auth.response;

  if (!isS3Configured()) {
    return NextResponse.json({ error: 'S3-compatible storage is not configured' }, { status: 503 });
  }

  try {
    const { eventId, filename, contentType, sizeBytes } = probe.data;
    const result = await generateAttachmentPresignedUploadUrl({
      eventId,
      userId: auth.session.user.id,
      filename,
      contentType,
      sizeBytes,
    });
    return NextResponse.json({
      uploadUrl: result.uploadUrl,
      key: result.key,
      expiresAt: result.expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('Failed to issue attachment upload URL:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
