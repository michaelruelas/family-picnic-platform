import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  // FPP-3: optional custom endpoint for S3-compatible providers (R2,
  // Supabase Storage, MinIO). When unset the SDK targets AWS S3 directly.
  endpoint: process.env.S3_ENDPOINT || undefined,
  // R2 and most S3-compat providers require path-style addressing.
  // AWS S3 defaults to virtual-hosted style; the SDK auto-detects for
  // AWS but we set it explicitly when a custom endpoint is supplied.
  forcePathStyle: !!process.env.S3_ENDPOINT,
  // FPP-69: AWS SDK v3 ships "flexible checksums" by default and tacks
  // x-amz-checksum-crc32 + x-amz-sdk-checksum-algorithm=CRC32 onto every
  // PUT. SeaweedFS (and most S3-compat providers pre-2024) reject
  // unknown checksum headers with 4xx. WHEN_REQUIRED matches the
  // legacy pre-feature behavior and only adds checksums when the
  // operation explicitly requires them.
  requestChecksumCalculation: 'WHEN_REQUIRED',
  credentials: process.env.AWS_ACCESS_KEY_ID
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      }
    : undefined,
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'family-picnic-photos';
const PRESIGNED_URL_EXPIRY = 3600;
// FPP-43 / FPP-1: short-lived download URLs. Public download endpoint
// issues a redirect to a URL that is only valid for this many seconds.
export const PDF_DOWNLOAD_URL_EXPIRY_SECONDS = 300;

export interface PresignedUploadUrl {
  uploadUrl: string;
  key: string;
  expiresAt: Date;
}

export type PhotoVariant = 'full' | 'thumbnail';

export function generateS3Key(
  eventId: string,
  userId: string,
  filename: string,
  variant: PhotoVariant = 'full',
): string {
  const timestamp = Date.now();
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  const base = `events/${eventId}/uploads/${userId}/${timestamp}-${sanitizedFilename}`;
  // Thumbnail gets a sibling object under the same prefix so a bucket
  // listing for an uploader still surfaces both variants together.
  return variant === 'thumbnail' ? `${base}.thumb.jpg` : base;
}

export function generateAttachmentS3Key(eventId: string, userId: string, filename: string): string {
  const timestamp = Date.now();
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `events/${eventId}/attachments/${userId}/${timestamp}-${sanitizedFilename}`;
}

export async function generatePresignedUploadUrl(
  eventId: string,
  userId: string,
  filename: string,
  contentType: string,
  variant: PhotoVariant = 'full',
): Promise<PresignedUploadUrl> {
  const key = generateS3Key(eventId, userId, filename, variant);

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, {
    expiresIn: PRESIGNED_URL_EXPIRY,
  });

  const expiresAt = new Date(Date.now() + PRESIGNED_URL_EXPIRY * 1000);

  return {
    uploadUrl,
    key,
    expiresAt,
  };
}

/**
 * FPP-43: presigned PUT for a PDF attachment. The key is generated
 * by `generateAttachmentS3Key` so PDFs land in their own prefix.
 * `sizeBytes` is set as the `Content-Length` so the receiver can
 * stream-validate against the admin's claimed size before persisting
 * the DB row.
 */
export async function generateAttachmentPresignedUploadUrl(args: {
  eventId: string;
  userId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
}): Promise<PresignedUploadUrl> {
  const { eventId, userId, filename, contentType, sizeBytes } = args;
  const key = generateAttachmentS3Key(eventId, userId, filename);

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
    ContentLength: sizeBytes,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, {
    expiresIn: PRESIGNED_URL_EXPIRY,
  });

  const expiresAt = new Date(Date.now() + PRESIGNED_URL_EXPIRY * 1000);

  return { uploadUrl, key, expiresAt };
}

/**
 * FPP-43 / FPP-1: short-lived presigned GET URL for a stored object.
 * Used by the public download endpoint to redirect guests straight at
 * the bucket. The URL is valid for `PDF_DOWNLOAD_URL_EXPIRY_SECONDS`
 * (5 minutes) — enough to follow the redirect and start the
 * download, but short enough that a leaked URL can't be reused.
 */
export async function generatePresignedDownloadUrl(
  key: string,
  options: { expiresInSeconds?: number; filename?: string } = {},
): Promise<string> {
  const { expiresInSeconds = PDF_DOWNLOAD_URL_EXPIRY_SECONDS, filename } = options;
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    // FPP-43 / FPP-1: the browser follows the 302 redirect to S3 and
    // ignores the anchor's `download` attribute once the response is
    // cross-origin. Setting ResponseContentDisposition here makes S3
    // emit a `Content-Disposition: attachment; filename=...` header
    // so the downloaded file keeps the name the host set.
    ...(filename ? { ResponseContentDisposition: `attachment; filename="${filename}"` } : {}),
  });
  return getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
}

/**
 * FPP-43 / FPP-2: delete an attachment's underlying object when the
 * admin removes the row. Failure is logged but does not throw — the
 * DB row is the source of truth, and a stale object can be cleaned
 * up by a future sweep job.
 */
export async function deleteS3Object(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });
  await s3Client.send(command);
}

export function isS3Configured(): boolean {
  return !!(
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.S3_BUCKET_NAME
  );
}
