import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@aws-sdk/client-s3', () => {
  const mockSend = vi.fn();
  return {
    S3Client: class {
      send = mockSend;
    },
    PutObjectCommand: vi.fn(),
    GetObjectCommand: vi.fn(),
    DeleteObjectCommand: vi.fn(),
  };
});

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn(() => Promise.resolve('https://presigned-url.example.com/upload')),
}));

describe('generateS3Key', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a key starting with events/{eventId}/uploads/{userId}/', async () => {
    const { generateS3Key } = await import('../s3');
    const key = generateS3Key('event-123', 'user-456', 'photo.jpg');
    expect(key).toMatch(/^events\/event-123\/uploads\/user-456\//);
  });

  it('includes a timestamp and the sanitized filename', async () => {
    const { generateS3Key } = await import('../s3');
    const key = generateS3Key('event-123', 'user-456', 'photo.jpg');
    expect(key).toBe('events/event-123/uploads/user-456/1749988800000-photo.jpg');
  });

  it('sanitizes special characters in the filename', async () => {
    const { generateS3Key } = await import('../s3');
    const key = generateS3Key('e1', 'u1', 'my cool photo (1).jpg');
    expect(key).toContain('my_cool_photo__1_.jpg');
  });

  it('sanitizes spaces in the filename', async () => {
    const { generateS3Key } = await import('../s3');
    const key = generateS3Key('e1', 'u1', 'hello world.png');
    expect(key).toContain('hello_world.png');
  });

  it('preserves dots in the filename', async () => {
    const { generateS3Key } = await import('../s3');
    const key = generateS3Key('e1', 'u1', 'file.tar.gz');
    expect(key).toContain('file.tar.gz');
  });
});

describe('generatePresignedUploadUrl', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns an object with uploadUrl, key, and expiresAt', async () => {
    const { generatePresignedUploadUrl } = await import('../s3');
    const result = await generatePresignedUploadUrl('event-1', 'user-1', 'photo.jpg', 'image/jpeg');
    expect(result).toHaveProperty('uploadUrl');
    expect(result).toHaveProperty('key');
    expect(result).toHaveProperty('expiresAt');
    expect(typeof result.uploadUrl).toBe('string');
    expect(typeof result.key).toBe('string');
    expect(result.expiresAt).toBeInstanceOf(Date);
  });

  it('key matches the generateS3Key format', async () => {
    const { generatePresignedUploadUrl } = await import('../s3');
    const result = await generatePresignedUploadUrl('e1', 'u1', 'test.png', 'image/png');
    expect(result.key).toMatch(/^events\/e1\/uploads\/u1\//);
  });

  it('expiresAt is in the future', async () => {
    const { generatePresignedUploadUrl } = await import('../s3');
    const result = await generatePresignedUploadUrl('e1', 'u1', 'test.png', 'image/png');
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});

describe('isS3Configured', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns true when AWS env vars are set', async () => {
    vi.stubEnv('AWS_ACCESS_KEY_ID', 'AKIA123');
    vi.stubEnv('AWS_SECRET_ACCESS_KEY', 'secret123');
    vi.stubEnv('S3_BUCKET_NAME', 'my-bucket');
    const { isS3Configured } = await import('../s3');
    expect(isS3Configured()).toBe(true);
  });

  it('returns false when AWS_ACCESS_KEY_ID is missing', async () => {
    vi.stubEnv('AWS_ACCESS_KEY_ID', '');
    vi.stubEnv('AWS_SECRET_ACCESS_KEY', 'secret123');
    vi.stubEnv('S3_BUCKET_NAME', 'my-bucket');
    const { isS3Configured } = await import('../s3');
    expect(isS3Configured()).toBe(false);
  });

  it('returns false when AWS_SECRET_ACCESS_KEY is missing', async () => {
    vi.stubEnv('AWS_ACCESS_KEY_ID', 'AKIA123');
    vi.stubEnv('AWS_SECRET_ACCESS_KEY', '');
    vi.stubEnv('S3_BUCKET_NAME', 'my-bucket');
    const { isS3Configured } = await import('../s3');
    expect(isS3Configured()).toBe(false);
  });

  it('returns false when S3_BUCKET_NAME is missing', async () => {
    vi.stubEnv('AWS_ACCESS_KEY_ID', 'AKIA123');
    vi.stubEnv('AWS_SECRET_ACCESS_KEY', 'secret123');
    vi.stubEnv('S3_BUCKET_NAME', '');
    const { isS3Configured } = await import('../s3');
    expect(isS3Configured()).toBe(false);
  });

  it('returns false when no env vars are set', async () => {
    vi.stubEnv('AWS_ACCESS_KEY_ID', '');
    vi.stubEnv('AWS_SECRET_ACCESS_KEY', '');
    vi.stubEnv('S3_BUCKET_NAME', '');
    const { isS3Configured } = await import('../s3');
    expect(isS3Configured()).toBe(false);
  });
});

// FPP-43: PDF attachment helpers reuse the same S3 client, with a
// dedicated `attachments/` prefix and short-lived download URLs so a
// leaked link can't be reused for long.
describe('generateAttachmentS3Key', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('places attachments under events/{eventId}/attachments/{userId}/', async () => {
    const { generateAttachmentS3Key } = await import('../s3');
    const key = generateAttachmentS3Key('event-123', 'user-456', 'directions.pdf');
    expect(key).toMatch(/^events\/event-123\/attachments\/user-456\//);
  });

  it('does not collide with the photo prefix', async () => {
    const { generateAttachmentS3Key, generateS3Key } = await import('../s3');
    const photo = generateS3Key('e1', 'u1', 'a.pdf');
    const attachment = generateAttachmentS3Key('e1', 'u1', 'a.pdf');
    expect(photo).toContain('/uploads/');
    expect(attachment).toContain('/attachments/');
  });
});

describe('generateAttachmentPresignedUploadUrl', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns uploadUrl/key/expiresAt and uses the attachments prefix', async () => {
    const { generateAttachmentPresignedUploadUrl } = await import('../s3');
    const result = await generateAttachmentPresignedUploadUrl({
      eventId: 'e-1',
      userId: 'u-1',
      filename: 'waiver.pdf',
      contentType: 'application/pdf',
      sizeBytes: 1234,
    });
    expect(result.uploadUrl).toMatch(/^https:/);
    expect(result.key).toMatch(/^events\/e-1\/attachments\/u-1\//);
    expect(result.expiresAt).toBeInstanceOf(Date);
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});

describe('generatePresignedDownloadUrl', () => {
  it('returns the URL produced by the presigner', async () => {
    const { generatePresignedDownloadUrl } = await import('../s3');
    const url = await generatePresignedDownloadUrl('events/e-1/attachments/u-1/x.pdf');
    expect(url).toBe('https://presigned-url.example.com/upload');
  });

  it('passes the host filename to S3 via ResponseContentDisposition', async () => {
    const { generatePresignedDownloadUrl } = await import('../s3');
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    await generatePresignedDownloadUrl('events/e-1/attachments/u-1/x.pdf', {
      filename: 'waiver.pdf',
    });
    expect(GetObjectCommand).toHaveBeenCalledWith({
      Bucket: 'family-picnic-photos',
      Key: 'events/e-1/attachments/u-1/x.pdf',
      ResponseContentDisposition: 'attachment; filename="waiver.pdf"',
    });
  });

  it('omits ResponseContentDisposition when no filename is supplied', async () => {
    const { generatePresignedDownloadUrl } = await import('../s3');
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    await generatePresignedDownloadUrl('events/e-1/attachments/u-1/x.pdf');
    expect(GetObjectCommand).toHaveBeenCalledWith({
      Bucket: 'family-picnic-photos',
      Key: 'events/e-1/attachments/u-1/x.pdf',
    });
  });
});

describe('deleteS3Object', () => {
  it('sends a DeleteObjectCommand for the given key', async () => {
    const { deleteS3Object } = await import('../s3');
    const { S3Client } = await import('@aws-sdk/client-s3');
    const send = vi.mocked(new S3Client({}).send);
    send.mockResolvedValue({} as never);
    await deleteS3Object('events/e-1/attachments/u-1/x.pdf');
    expect(send).toHaveBeenCalled();
  });
});
