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

export interface PresignedUploadUrl {
  uploadUrl: string;
  key: string;
  expiresAt: Date;
}

export function generateS3Key(eventId: string, userId: string, filename: string): string {
  const timestamp = Date.now();
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `events/${eventId}/uploads/${userId}/${timestamp}-${sanitizedFilename}`;
}

export async function generatePresignedUploadUrl(
  eventId: string,
  userId: string,
  filename: string,
  contentType: string,
): Promise<PresignedUploadUrl> {
  const key = generateS3Key(eventId, userId, filename);

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

export function isS3Configured(): boolean {
  return !!(
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.S3_BUCKET_NAME
  );
}
