import { NextResponse } from 'next/server';
import { requireEventAdminApi } from '~/lib/admin-auth';
import { prisma } from '~/lib/prisma';
import { eventAttachmentRenameSchema } from '~/lib/schemas/event-attachment';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * FPP-43 / FPP-2: rename an attachment's display filename. Resolves
 * the row first so the auth check knows which event to gate on (a
 * HOST can only rename rows on events they administer).
 *
 * Renaming does NOT touch the S3 key — the file in the bucket keeps
 * its timestamped name forever. The display `filename` is what the
 * public page shows and what the browser suggests as
 * `Content-Disposition` on the presigned download URL.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const schemaCheck = eventAttachmentRenameSchema.safeParse(body);
    if (!schemaCheck.success) {
      const firstError = schemaCheck.error.issues[0];
      return NextResponse.json({ error: firstError?.message ?? 'Invalid input' }, { status: 400 });
    }

    const existing = await prisma.eventAttachment.findUnique({
      where: { id },
      select: { id: true, eventId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    const auth = await requireEventAdminApi(existing.eventId);
    if (!auth.ok) return auth.response;

    const updated = await prisma.eventAttachment.update({
      where: { id },
      data: { filename: schemaCheck.data.filename },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Failed to rename event attachment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * FPP-43 / FPP-2: delete an attachment. Removes the DB row first
 * (the source of truth); the S3 object cleanup is best-effort and
 * failures are logged so a future sweep job can retry.
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const existing = await prisma.eventAttachment.findUnique({
      where: { id },
      select: { id: true, eventId: true, key: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    const auth = await requireEventAdminApi(existing.eventId);
    if (!auth.ok) return auth.response;

    await prisma.eventAttachment.delete({ where: { id } });

    // Best-effort object cleanup; swallow errors so a transient S3
    // outage cannot block the admin from removing the row.
    try {
      const { deleteS3Object } = await import('~/lib/s3');
      await deleteS3Object(existing.key);
    } catch (cleanupError) {
      console.error('Failed to delete attachment object from storage:', cleanupError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete event attachment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
