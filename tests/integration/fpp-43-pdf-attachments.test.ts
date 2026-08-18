import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

const root = process.cwd();
const schemaPath = path.join(root, 'prisma/schema.prisma');
const s3Path = path.join(root, 'src/lib/s3.ts');
const rateLimitPath = path.join(root, 'src/lib/rate-limit.ts');
const uploadUrlRoutePath = path.join(
  root,
  'src/app/api/admin/event-attachments/upload-url/route.ts',
);
const createRoutePath = path.join(root, 'src/app/api/admin/event-attachments/route.ts');
const idRoutePath = path.join(root, 'src/app/api/admin/event-attachments/[id]/route.ts');
const downloadRoutePath = path.join(
  root,
  'src/app/api/public/event-attachments/[id]/download/route.ts',
);
const editorPath = path.join(root, 'src/components/event/EventAttachmentsEditor.tsx');
const downloadsPath = path.join(root, 'src/components/event/EventDownloadsSection.tsx');
const editPagePath = path.join(root, 'src/app/admin/events/[id]/edit/page.tsx');
const eventPagePath = path.join(root, 'src/app/events/[id]/page.tsx');

describe('FPP-43 PDF attachments (storage + admin upload + public download)', () => {
  describe('FPP-3 storage decision + Prisma model', () => {
    it('EventAttachment model has the columns the routes depend on', async () => {
      const schema = await fs.readFile(schemaPath, 'utf-8');
      const block = schema.match(/model EventAttachment \{([\s\S]*?)^\}/m);
      expect(block).not.toBeNull();
      const body = block![1]!;
      // Key columns: id, eventId, uploadedByUserId, key, filename,
      // contentType, sizeBytes, virusScanStatus, createdAt, updatedAt.
      expect(body).toMatch(/id\s+String\s+@id\s+@default\(cuid\(\)\)/);
      expect(body).toMatch(/eventId\s+String/);
      expect(body).toMatch(/uploadedByUserId\s+String/);
      expect(body).toMatch(/key\s+String\s+@unique/);
      expect(body).toMatch(/filename\s+String/);
      expect(body).toMatch(/contentType\s+String\s+@default\("application\/pdf"\)/);
      expect(body).toMatch(/sizeBytes\s+Int/);
      expect(body).toMatch(/virusScanStatus\s+AttachmentScanStatus/);
    });

    it('AttachmentScanStatus enum lists every state the routes cycle through', async () => {
      const schema = await fs.readFile(schemaPath, 'utf-8');
      const match = schema.match(/enum AttachmentScanStatus \{([^}]+)\}/);
      expect(match).not.toBeNull();
      const body = match![1]!.trim();
      expect(body).toContain('PENDING');
      expect(body).toContain('CLEAN');
      expect(body).toContain('INFECTED');
      expect(body).toContain('SKIPPED');
      expect(body).toContain('FAILED');
    });

    it('Event model carries the attachments relation so admin + public pages can query it', async () => {
      const schema = await fs.readFile(schemaPath, 'utf-8');
      expect(schema).toMatch(/model Event \{[\s\S]*?attachments\s+EventAttachment\[\]/);
    });

    it('User model carries uploadedAttachments so per-user audits stay cheap', async () => {
      const schema = await fs.readFile(schemaPath, 'utf-8');
      expect(schema).toMatch(/model User \{[\s\S]*?uploadedAttachments\s+EventAttachment\[\]/);
    });

    it('Index on virusScanStatus lets a future scan worker scan PENDING rows cheaply', async () => {
      const schema = await fs.readFile(schemaPath, 'utf-8');
      const block = schema.match(/model EventAttachment \{([\s\S]*?)^\}/m);
      expect(block).not.toBeNull();
      expect(block![1]!).toMatch(/@@index\(\[virusScanStatus\]\)/);
    });
  });

  describe('FPP-3 s3.ts extensions', () => {
    it('generateAttachmentS3Key places keys under attachments/ not uploads/', async () => {
      const src = await fs.readFile(s3Path, 'utf-8');
      expect(src).toMatch(/generateAttachmentS3Key/);
      // The body builds `events/{eventId}/attachments/{userId}/...`
      expect(src).toMatch(/events\/\$\{eventId\}\/attachments\/\$\{userId\}\//);
    });

    it('generateAttachmentPresignedUploadUrl sets ContentLength for size validation', async () => {
      const src = await fs.readFile(s3Path, 'utf-8');
      expect(src).toContain('generateAttachmentPresignedUploadUrl');
      // Sets ContentLength on the PutObjectCommand so S3 itself
      // stream-validates against the admin's claimed sizeBytes.
      expect(src).toMatch(/ContentLength:\s+sizeBytes/);
    });

    it('generatePresignedDownloadUrl uses a 5-minute expiry for public downloads', async () => {
      const src = await fs.readFile(s3Path, 'utf-8');
      expect(src).toContain('generatePresignedDownloadUrl');
      expect(src).toContain('PDF_DOWNLOAD_URL_EXPIRY_SECONDS = 300');
    });

    it('deleteS3Object cleans the bucket when an admin removes an attachment', async () => {
      const src = await fs.readFile(s3Path, 'utf-8');
      expect(src).toContain('deleteS3Object');
      expect(src).toMatch(/DeleteObjectCommand/);
    });
  });

  describe('FPP-2 admin upload flow', () => {
    it('upload-url route requires per-event admin auth', async () => {
      const src = await fs.readFile(uploadUrlRoutePath, 'utf-8');
      expect(src).toContain('requireEventAdminApi');
    });

    it('upload-url route rejects non-PDF content types', async () => {
      const src = await fs.readFile(uploadUrlRoutePath, 'utf-8');
      expect(src).toContain('eventAttachmentUploadUrlSchema');
    });

    it('admin create route checks the key prefix, not the timestamped canonical key', async () => {
      // Regression guard for the FPP-43 critical bug: the create
      // route must NOT call `generateAttachmentS3Key` because that
      // helper embeds `Date.now()` and the re-derived timestamp
      // never matches the server-issued key from `/upload-url`.
      const src = await fs.readFile(createRoutePath, 'utf-8');
      // Strip line + block comments before matching, so the
      // explanatory doc comment in the route doesn't false-positive.
      const stripped = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      expect(stripped).not.toMatch(/generateAttachmentS3Key\s*\(/);
      // The prefix guard is still in place.
      expect(src).toMatch(
        /expectedPrefix\s*=\s*`events\/\$\{input\.eventId\}\/attachments\/\$\{auth\.session\.user\.id\}\/`/,
      );
      // virusScanStatus is set to SKIPPED directly (the stub).
      expect(src).toContain('AttachmentScanStatus.SKIPPED');
    });

    it('PATCH on [id] renames the display filename without touching S3', async () => {
      const src = await fs.readFile(idRoutePath, 'utf-8');
      expect(src).toContain('eventAttachmentRenameSchema');
      // PATCH path updates only filename, not key.
      expect(src).toMatch(/data:\s*\{\s*filename:\s*schemaCheck\.data\.filename\s*,?\s*\}/);
    });

    it('DELETE on [id] removes the DB row and best-effort cleans the S3 object', async () => {
      const src = await fs.readFile(idRoutePath, 'utf-8');
      expect(src).toContain('deleteS3Object');
      expect(src).toMatch(/prisma\.eventAttachment\.delete/);
    });

    it('admin event edit page renders EventAttachmentsEditor', async () => {
      const src = await fs.readFile(editPagePath, 'utf-8');
      expect(src).toContain('EventAttachmentsEditor');
      expect(src).toMatch(/event\.attachments/);
    });

    it('EventAttachmentsEditor restricts the file picker to PDFs and validates size', async () => {
      const src = await fs.readFile(editorPath, 'utf-8');
      expect(src).toMatch(/ACCEPT\s*=\s*['"]application\/pdf,\.pdf['"]/);
      expect(src).toMatch(/type="file"/);
      expect(src).toContain('PDF_MAX_BYTES');
      // Both client (defensive UX) and server (authoritative).
      expect(src).toContain('PDF_MAX_FILENAME_LENGTH');
    });
  });

  describe('FPP-1 public download link', () => {
    it('download route is unauthenticated and checks event status = PUBLISHED', async () => {
      const src = await fs.readFile(downloadRoutePath, 'utf-8');
      // No `requireSessionApi` / `requireAdminApi` — public endpoint.
      expect(src).not.toMatch(/requireSessionApi|requireAdminApi|requireEventAdminApi/);
      // 404 when the parent event is not PUBLISHED (no info leak).
      expect(src).toMatch(/event\.status\s*!==?\s*['"]PUBLISHED['"]/);
    });

    it('download route uses the in-memory IP rate limiter', async () => {
      const src = await fs.readFile(downloadRoutePath, 'utf-8');
      expect(src).toContain('checkInMemoryIpRateLimit');
      expect(src).toContain('PDF_DOWNLOADS_PER_MINUTE');
      // Adds a Retry-After header when blocked.
      expect(src).toContain("'Retry-After'");
    });

    it('download route 302s to a fresh presigned GET URL', async () => {
      const src = await fs.readFile(downloadRoutePath, 'utf-8');
      expect(src).toContain('generatePresignedDownloadUrl');
      expect(src).toMatch(/NextResponse\.redirect/);
    });

    it('EventDownloadsSection hides entirely when no attachments', async () => {
      const src = await fs.readFile(downloadsPath, 'utf-8');
      expect(src).toMatch(/if\s*\(\s*attachments\.length\s*===\s*0\s*\)\s+return\s+null/);
    });

    it('EventAdditionalInfoSection gates the downloads block on attachments (FPP-137)', async () => {
      // Belt-and-braces: Additional Info embeds EventDownloadsSection when attachments are present.
      const sectionPath = path.join(root, 'src/components/event/EventAdditionalInfoSection.tsx');
      const src = await fs.readFile(sectionPath, 'utf-8');
      expect(src).toMatch(/<EventDownloadsSection\s+attachments=\{attachments\}/);
    });

    it('public event page filters attachments by event.status = PUBLISHED', async () => {
      // Filter ensures PDF filenames do not appear on DRAFT event
      // pages even though the page renders regardless of status.
      const src = await fs.readFile(eventPagePath, 'utf-8');
      expect(src).toMatch(/where:\s*\{[\s\S]*?event:\s*\{\s*status:\s*['"]PUBLISHED['"]\s*\}/);
    });
  });

  describe('rate-limit constants', () => {
    it('public download limiter caps at 10 req/min/IP', async () => {
      const src = await fs.readFile(rateLimitPath, 'utf-8');
      expect(src).toMatch(/PDF_DOWNLOADS_PER_MINUTE\s*=\s*10/);
      expect(src).toMatch(/PDF_DOWNLOAD_WINDOW_MS\s*=\s*60\s*\*\s*1000/);
    });
  });
});
