import { describe, it, expect } from 'vitest';
import {
  PDF_MAX_BYTES,
  eventAttachmentCreateSchema,
  eventAttachmentRenameSchema,
  eventAttachmentUploadUrlSchema,
} from '../event-attachment';

const baseValid = {
  eventId: 'e-1',
  key: 'events/e-1/attachments/u-1/1749988800000-directions.pdf',
  filename: 'directions.pdf',
  contentType: 'application/pdf',
  sizeBytes: 1024,
};

describe('eventAttachmentCreateSchema', () => {
  it('accepts a valid payload', () => {
    const result = eventAttachmentCreateSchema.safeParse(baseValid);
    expect(result.success).toBe(true);
  });

  it('rejects a non-pdf contentType', () => {
    const result = eventAttachmentCreateSchema.safeParse({
      ...baseValid,
      contentType: 'image/png',
    });
    expect(result.success).toBe(false);
  });

  it('rejects sizeBytes above the cap', () => {
    const result = eventAttachmentCreateSchema.safeParse({
      ...baseValid,
      sizeBytes: PDF_MAX_BYTES + 1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-positive sizeBytes', () => {
    const result = eventAttachmentCreateSchema.safeParse({
      ...baseValid,
      sizeBytes: 0,
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty filename', () => {
    const result = eventAttachmentCreateSchema.safeParse({
      ...baseValid,
      filename: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('eventAttachmentUploadUrlSchema', () => {
  it('accepts a valid payload', () => {
    const result = eventAttachmentUploadUrlSchema.safeParse({
      eventId: 'e-1',
      filename: 'directions.pdf',
      contentType: 'application/pdf',
      sizeBytes: 1024,
    });
    expect(result.success).toBe(true);
  });

  it('rejects an oversized file', () => {
    const result = eventAttachmentUploadUrlSchema.safeParse({
      eventId: 'e-1',
      filename: 'directions.pdf',
      contentType: 'application/pdf',
      sizeBytes: PDF_MAX_BYTES + 1024,
    });
    expect(result.success).toBe(false);
  });
});

describe('eventAttachmentRenameSchema', () => {
  it('accepts a valid rename', () => {
    const result = eventAttachmentRenameSchema.safeParse({ filename: 'New.pdf' });
    expect(result.success).toBe(true);
  });

  it('rejects extra fields (strict)', () => {
    const result = eventAttachmentRenameSchema.safeParse({
      filename: 'New.pdf',
      sizeBytes: 1024,
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty filename', () => {
    const result = eventAttachmentRenameSchema.safeParse({ filename: '   ' });
    expect(result.success).toBe(false);
  });
});
