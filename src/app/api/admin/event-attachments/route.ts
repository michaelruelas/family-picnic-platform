import { NextResponse } from 'next/server';
import { requireEventAdminApi } from '~/lib/admin-auth';
import { prisma } from '~/lib/prisma';
import { AttachmentScanStatus } from '~/lib/generated/enums';
import { eventAttachmentCreateSchema } from '~/lib/schemas/event-attachment';

/**
 * FPP-43 / FPP-2: admin endpoint that turns a successful S3 PUT
 * into a permanent `EventAttachment` row. The admin posts the
 * `key` that came back from `/upload-url` so we can confirm the
 * server-issued key is the one being persisted (and not a guest's
 * arbitrary path).
 *
 * Virus-scan is a stub: the row is created directly with
 * `virusScanStatus: SKIPPED` and the scan request is logged. For the
 * first ship there is no scan worker, so a `PENDING → CLEAN/INFECTED`
 * transition would be permanently idle and would block downloads.
 * The future CLAMAV worker flips `SKIPPED` rows to `CLEAN` /
 * `INFECTED` retroactively (download endpoint refuses `INFECTED`).
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const probe = eventAttachmentCreateSchema.safeParse(body);
  if (!probe.success) {
    const firstError = probe.error.issues[0];
    return NextResponse.json({ error: firstError?.message ?? 'Invalid input' }, { status: 400 });
  }

  const auth = await requireEventAdminApi(probe.data.eventId);
  if (!auth.ok) return auth.response;

  const input = probe.data;

  // FPP-43: confirm the supplied `key` lives in the right namespace
  // for this event and uploader. Catches a forged key pointing at
  // someone else's prefix (e.g. another admin's uploads).
  //
  // We deliberately do NOT re-derive the canonical key from the
  // filename here: `generateAttachmentS3Key` embeds `Date.now()`,
  // and the upload-url call may be milliseconds before this one, so
  // the re-derived timestamp would never match the server-issued
  // key. The prefix guard above is sufficient: the key could only
  // have been obtained through the authenticated `/upload-url`
  // endpoint, which itself checked per-event admin access.
  const expectedPrefix = `events/${input.eventId}/attachments/${auth.session.user.id}/`;
  if (!input.key.startsWith(expectedPrefix)) {
    return NextResponse.json(
      { error: 'Attachment key does not match an expected server-issued path' },
      { status: 400 },
    );
  }

  try {
    const created = await prisma.eventAttachment.create({
      data: {
        eventId: input.eventId,
        uploadedByUserId: auth.session.user.id,
        key: input.key,
        filename: input.filename,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
        // Stub: log the scan request and immediately mark SKIPPED so
        // the first ship is not blocked behind an unfinished worker.
        virusScanStatus: AttachmentScanStatus.SKIPPED,
      },
    });
    console.info('[event-attachments] virus scan skipped (stub)', {
      attachmentId: created.id,
      eventId: input.eventId,
      sizeBytes: input.sizeBytes,
    });
    return NextResponse.json(created);
  } catch (error) {
    console.error('Failed to persist event attachment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
