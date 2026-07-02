# Implement Photo Upload flow with S3 + PhotoPrism

## Status

Done — implemented S3 presigned URL generation, client-side EXIF stripping, PhotoPrism sync utilities, UploadButton component, and confirmUpload procedure.

## Description

SPEC §4.4 and §7 outline: authenticated user uploads → EXIF stripped → S3 →
PhotoPrism ingests → thumbnail generated → reaction-able in gallery. None of
this exists. The `Photo` table is populated only via direct DB writes.

Implement:

- `photo.getUploadUrl` (S3-compatible presigned PUT URL).
- Client-side EXIF stripper before upload (`lib/exif-stripper.ts`).
- `photo.confirmUpload` that writes a `Photo` row and triggers PhotoPrism
  sync (push URL or call PhotoPrism API).
- `/events/[id]/photos` upload widget with chunked uploads + retry.
- Thumbnail generation (server-side cron or PhotoPrism auto).

## Acceptance criteria

- Upload is presigned — no credentials leave the client.
- GPS metadata guaranteed removed before S3 PUT.
- PhotoPrism photo ID stored in `Photo.photoPrismId`.
- Failed uploads retry on reconnect (SPEC §8.6).

## Files

- `src/app/api/photos/upload-url/route.ts` (create — temporary until tRPC)
- `src/lib/s3.ts` (create)
- `src/lib/photo-prism.ts` (create)
- `src/lib/exif-stripper.ts` (create)
- `src/server/routers/photo.ts` (create)
- `src/components/photos/UploadButton.tsx` (create)
- `src/components/photos/PhotoGrid.tsx` (create)
