'use client';

import { useRef, useState } from 'react';
import { stripExifFromFile } from '~/lib/exif-stripper';
import { ALLOWED_IMAGE_CONTENT_TYPES, MAX_IMAGE_BYTES } from '~/lib/image-upload';

interface FeaturedImageUploadProps {
  eventId: string;
  currentUrl?: string;
  onUploaded: (url: string) => void;
}

type Status = 'idle' | 'processing' | 'uploading' | 'done' | 'error';

/**
 * FPP-60: small client widget that uploads an event hero image to
 * S3 via a presigned URL. The shape (strip EXIF, presign, PUT,
 * resolve the public URL) mirrors the gallery `<UploadButton>`
 * because the gallery flow also has no shared uploader hook today;
 * the boundary constants come from `~/lib/image-upload` so the two
 * callers stay in lockstep. This widget differs from the gallery
 * one in that it hits the admin featured-image endpoint (host-only)
 * and never creates a Photo row.
 */
export default function FeaturedImageUpload({
  eventId,
  currentUrl,
  onUploaded,
}: FeaturedImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handlePick = () => {
    fileInputRef.current?.click();
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0]!;

    if (!ALLOWED_IMAGE_CONTENT_TYPES.includes(file.type as never)) {
      setError(`Unsupported image type. Use one of: ${ALLOWED_IMAGE_CONTENT_TYPES.join(', ')}.`);
      setStatus('error');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError(`File too large. Max ${MAX_IMAGE_BYTES / (1024 * 1024)}MB.`);
      setStatus('error');
      return;
    }

    setError(null);
    setStatus('processing');
    setProgress(10);

    try {
      const stripped = await stripExifFromFile(file);
      setProgress(30);

      const presignedRes = await fetch(`/api/admin/events/${eventId}/featured-image-upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          size: stripped.blob.size,
        }),
      });

      if (!presignedRes.ok) {
        const err = (await presignedRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || 'Failed to get upload URL');
      }

      const { uploadUrl, publicUrl } = (await presignedRes.json()) as {
        uploadUrl: string;
        publicUrl: string;
      };

      setStatus('uploading');
      setProgress(60);

      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: stripped.blob,
        headers: { 'Content-Type': file.type },
      });

      if (!uploadRes.ok) {
        throw new Error('Failed to upload image to storage');
      }

      setProgress(100);
      setStatus('done');
      onUploaded(publicUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      // FPP-60 / EH-006: surface upload failures to the browser
      // console so client-side issues are visible in Sentry / dev
      // tools instead of being swallowed by the UI message.
      console.error('[FeaturedImageUpload] upload failed', err);
      setError(message);
      setStatus('error');
    }
  };

  const isBusy = status === 'processing' || status === 'uploading';

  return (
    <div className="space-y-3">
      {currentUrl ? (
        <div className="border-border overflow-hidden rounded-lg border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentUrl}
            alt="Featured image preview"
            className="bg-secondary h-32 w-full object-cover"
          />
        </div>
      ) : (
        <div className="border-border bg-secondary text-muted-foreground flex h-32 items-center justify-center rounded-lg border border-dashed text-xs">
          No featured image yet
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_IMAGE_CONTENT_TYPES.join(',')}
          className="hidden"
          onChange={(e) => {
            void handleFiles(e.target.files);
          }}
        />
        <button
          type="button"
          onClick={handlePick}
          disabled={isBusy}
          className="bg-terracotta hover:bg-terracotta rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {isBusy ? 'Uploading…' : currentUrl ? 'Replace image' : 'Upload image'}
        </button>
        {currentUrl && (
          <button
            type="button"
            onClick={() => onUploaded('')}
            disabled={isBusy}
            className="text-muted-foreground hover:text-foreground text-sm underline disabled:opacity-50"
          >
            Clear
          </button>
        )}
      </div>

      {(isBusy || progress > 0) && status !== 'error' && status !== 'done' && (
        <div className="bg-secondary h-1.5 w-full rounded-full">
          <div
            className="bg-sunlight/200 h-1.5 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {status === 'done' && <p className="text-sage text-xs">Uploaded. Save the form to apply.</p>}
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}
