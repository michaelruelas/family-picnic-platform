'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { processImageForUpload } from '~/lib/exif-stripper';
import { useToast } from '~/components/ui/Toast';

interface UploadButtonProps {
  eventId: string;
  onUploadComplete?: () => void;
  maxFileSizeMB?: number;
  maxFiles?: number;
}

interface UploadingFile {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'processing' | 'done' | 'error';
  fading?: boolean;
  error?: string;
}

const MAX_FILE_SIZE_MB = 10;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const DONE_VISIBLE_MS = 1500;
const FADE_OUT_MS = 500;

export default function UploadButton({
  eventId,
  onUploadComplete,
  maxFileSizeMB = MAX_FILE_SIZE_MB,
  maxFiles = 10,
}: UploadButtonProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addToast } = useToast();
  const router = useRouter();

  const updateFileStatus = (id: string, updates: Partial<UploadingFile>) => {
    setUploadingFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  const scheduleRemoval = (id: string) => {
    setTimeout(() => {
      setUploadingFiles((prev) => prev.map((f) => (f.id === id ? { ...f, fading: true } : f)));
      setTimeout(() => {
        setUploadingFiles((prev) => prev.filter((f) => f.id !== id));
      }, FADE_OUT_MS);
    }, DONE_VISIBLE_MS);
  };

  const uploadFile = async (uploadingFile: UploadingFile): Promise<boolean> => {
    const { id, file } = uploadingFile;

    try {
      updateFileStatus(id, { status: 'processing', progress: 0 });

      const processed = await processImageForUpload(file);
      updateFileStatus(id, { progress: 15 });

      const [fullRes, thumbRes] = await Promise.all([
        fetch('/api/photo-upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId,
            filename: file.name,
            contentType: file.type,
            variant: 'full',
          }),
        }),
        fetch('/api/photo-upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId,
            filename: file.name,
            contentType: file.type,
            variant: 'thumbnail',
          }),
        }),
      ]);

      if (!fullRes.ok || !thumbRes.ok) {
        const err = await (fullRes.ok ? thumbRes : fullRes).json();
        throw new Error(err.error || 'Failed to get upload URLs');
      }

      const { uploadUrl: fullUrl, key: fullKey } = await fullRes.json();
      const { uploadUrl: thumbUrl, key: thumbKey } = await thumbRes.json();

      updateFileStatus(id, { status: 'uploading', progress: 30 });

      const [fullUpload, thumbUpload] = await Promise.all([
        fetch(fullUrl, {
          method: 'PUT',
          body: processed.full,
          headers: { 'Content-Type': 'image/jpeg' },
        }),
        fetch(thumbUrl, {
          method: 'PUT',
          body: processed.thumbnail,
          headers: { 'Content-Type': 'image/jpeg' },
        }),
      ]);

      if (!fullUpload.ok || !thumbUpload.ok) {
        throw new Error('Failed to upload files to S3');
      }

      updateFileStatus(id, { progress: 80 });

      const fullPublicUrl = fullUrl.split('?')[0];
      const thumbPublicUrl = thumbUrl.split('?')[0];

      const createResponse = await fetch('/api/photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          photoPrismId: fullKey,
          url: fullPublicUrl,
          thumbnailUrl: thumbPublicUrl,
          caption: '',
        }),
      });

      if (!createResponse.ok) {
        throw new Error('Failed to create photo record');
      }

      updateFileStatus(id, { status: 'done', progress: 100 });
      scheduleRemoval(id);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      updateFileStatus(id, { status: 'error', error: errorMessage });
      return false;
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const validFiles: File[] = [];
    const errors: string[] = [];

    Array.from(files).forEach((file) => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        errors.push(`${file.name}: Invalid file type`);
        return;
      }
      if (file.size > maxFileSizeMB * 1024 * 1024) {
        errors.push(`${file.name}: File too large (max ${maxFileSizeMB}MB)`);
        return;
      }
      validFiles.push(file);
    });

    if (errors.length > 0) {
      alert(errors.join('\n'));
    }

    if (validFiles.length === 0) return;

    const remainingSlots = maxFiles - uploadingFiles.filter((f) => f.status === 'done').length;
    const filesToUpload = validFiles.slice(0, remainingSlots);

    if (filesToUpload.length === 0) {
      alert(`Maximum ${maxFiles} photos allowed`);
      return;
    }

    const newUploadingFiles: UploadingFile[] = filesToUpload.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      progress: 0,
      status: 'pending',
    }));

    setUploadingFiles((prev) => [...prev, ...newUploadingFiles]);
    setIsUploading(true);

    let successCount = 0;
    for (const uploadingFile of newUploadingFiles) {
      const success = await uploadFile(uploadingFile);
      if (success) successCount++;
    }

    setIsUploading(false);

    const errorCount = newUploadingFiles.length - successCount;

    if (successCount > 0 && errorCount === 0) {
      addToast('success', `Uploaded ${successCount} photo${successCount === 1 ? '' : 's'}`);
    } else if (successCount > 0 && errorCount > 0) {
      addToast('warning', `Uploaded ${successCount}, ${errorCount} failed`);
    } else if (errorCount > 0) {
      addToast('error', `Upload failed for ${errorCount} photo${errorCount === 1 ? '' : 's'}`);
    }

    if (successCount > 0) {
      router.refresh();
      onUploadComplete?.();
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await handleFiles(e.dataTransfer.files);
  };

  const handlePick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_TYPES.join(',')}
        multiple
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
      />

      <div
        className="border-border bg-secondary/60 hover:bg-accent hover:border-primary relative flex flex-col items-center justify-center rounded-sm border-2 border-dashed p-6 transition-colors"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        <div className="text-center">
          <div className="text-4xl">📷</div>
          <p className="text-foreground/85 mt-2 text-sm font-medium">
            Drop photos here or click to upload
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            JPEG, PNG, WebP, HEIC up to {maxFileSizeMB}MB each
          </p>
        </div>

        <button
          onClick={handlePick}
          disabled={isUploading}
          className="bg-terracotta hover:bg-terracotta mt-4 rounded-sm px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
        >
          {isUploading ? 'Uploading...' : 'Select Photos'}
        </button>
      </div>

      {uploadingFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          {uploadingFiles.map((uploadingFile) => (
            <div
              key={uploadingFile.id}
              className={`bg-secondary/60 flex items-center gap-3 rounded-sm p-3 transition-opacity duration-500 ${
                uploadingFile.fading ? 'opacity-0' : 'opacity-100'
              }`}
            >
              <div className="flex-1">
                <p className="text-foreground/85 truncate text-sm font-medium">
                  {uploadingFile.file.name}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <div className="bg-secondary h-1.5 flex-1 rounded-sm">
                    <div
                      className={`h-1.5 rounded-sm transition-all ${
                        uploadingFile.status === 'error'
                          ? 'bg-destructive/100'
                          : uploadingFile.status === 'done'
                            ? 'bg-sage/150'
                            : 'bg-sunlight/200'
                      }`}
                      style={{ width: `${uploadingFile.progress}%` }}
                    />
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {uploadingFile.status === 'done'
                      ? 'Done'
                      : uploadingFile.status === 'error'
                        ? uploadingFile.error
                        : `${uploadingFile.progress}%`}
                  </span>
                </div>
              </div>
              {uploadingFile.status === 'done' && <span className="text-sage">✓</span>}
              {uploadingFile.status === 'error' && <span className="text-destructive">✗</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
