/**
 * FPP-60: shared image-upload boundary. The presign route and the
 * client upload widget both enforce the same content-type list and
 * size cap. Keeping the two copies in lockstep through a single
 * import prevents drift when a future MIME is added on one side and
 * missed on the other.
 */
export const ALLOWED_IMAGE_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;

export type AllowedImageContentType = (typeof ALLOWED_IMAGE_CONTENT_TYPES)[number];

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** Same as `MAX_IMAGE_BYTES` but expressed in megabytes for the client UI. */
export const MAX_IMAGE_MB = MAX_IMAGE_BYTES / (1024 * 1024);
