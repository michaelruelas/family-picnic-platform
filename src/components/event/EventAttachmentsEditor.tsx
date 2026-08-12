'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { PDF_MAX_BYTES, PDF_MAX_FILENAME_LENGTH } from '~/lib/schemas/event-attachment';

/**
 * FPP-43 / FPP-2: admin editor for per-event PDF attachments.
 *
 * The flow is a two-step S3 PUT (mirroring the photo upload flow):
 *   1. POST `/api/admin/event-attachments/upload-url` to receive a
 *      presigned PUT URL + the canonical object key.
 *   2. PUT the file bytes directly at that URL.
 *   3. POST `/api/admin/event-attachments` with `{ eventId, key,
 *      filename, contentType, sizeBytes }` so the server can persist
 *      the DB row.
 *
 * Why split it? The PUT to S3 is unauthenticated at the API gateway
 * — the presigned URL carries the auth. Splitting keeps the
 * Next.js process out of the upload path so a 9 MB PDF never
 * crosses our process boundary.
 */
export interface EventAttachment {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  virusScanStatus: string;
  createdAt: string;
}

export interface EventAttachmentsEditorProps {
  eventId: string;
  initialAttachments: EventAttachment[];
}

const ACCEPT = 'application/pdf,.pdf';

export default function EventAttachmentsEditor({
  eventId,
  initialAttachments,
}: EventAttachmentsEditorProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<EventAttachment[]>(initialAttachments);
  const [uploading, setUploading] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetPicker = useCallback(() => {
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleFile = async (file: File) => {
    setError(null);

    if (file.type !== 'application/pdf') {
      setError('Only PDF files are supported.');
      resetPicker();
      return;
    }
    if (file.size > PDF_MAX_BYTES) {
      setError(`File must be ${PDF_MAX_BYTES / (1024 * 1024)} MB or smaller.`);
      resetPicker();
      return;
    }
    if (file.name.length > PDF_MAX_FILENAME_LENGTH) {
      setError(`Filename must be ${PDF_MAX_FILENAME_LENGTH} characters or fewer.`);
      resetPicker();
      return;
    }

    setUploading(true);
    try {
      const presignRes = await fetch('/api/admin/event-attachments/upload-url', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          eventId,
          filename: file.name,
          contentType: 'application/pdf',
          sizeBytes: file.size,
        }),
      });
      const presignData = await presignRes.json();
      if (!presignRes.ok) {
        setError(presignData.error || 'Failed to start upload.');
        resetPicker();
        return;
      }

      const putRes = await fetch(presignData.uploadUrl, {
        method: 'PUT',
        headers: { 'content-type': 'application/pdf' },
        body: file,
      });
      if (!putRes.ok) {
        setError('Upload to storage failed.');
        resetPicker();
        return;
      }

      const createRes = await fetch('/api/admin/event-attachments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          eventId,
          key: presignData.key,
          filename: file.name,
          contentType: 'application/pdf',
          sizeBytes: file.size,
        }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) {
        setError(createData.error || 'Failed to save attachment.');
        resetPicker();
        return;
      }

      resetPicker();
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
      resetPicker();
    } finally {
      setUploading(false);
    }
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
  };

  const beginRename = (attachment: EventAttachment) => {
    setRenamingId(attachment.id);
    setRenameValue(attachment.filename);
    setError(null);
  };

  const saveRename = async (id: string) => {
    const next = renameValue.trim();
    if (!next) {
      setError('Filename cannot be empty.');
      return;
    }
    if (next.length > PDF_MAX_FILENAME_LENGTH) {
      setError(`Filename must be ${PDF_MAX_FILENAME_LENGTH} characters or fewer.`);
      return;
    }
    setError(null);
    try {
      const res = await fetch(`/api/admin/event-attachments/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ filename: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to rename attachment.');
        return;
      }
      setAttachments((prev) => prev.map((a) => (a.id === id ? { ...a, filename: next } : a)));
      setRenamingId(null);
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
    }
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameValue('');
    setError(null);
  };

  const handleDelete = async (id: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/admin/event-attachments/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to delete attachment.');
        return;
      }
      setAttachments((prev) => prev.filter((a) => a.id !== id));
      setDeleteConfirm(null);
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
    }
  };

  return (
    <div className="space-y-4" data-testid="event-attachments-editor">
      {error && (
        <div
          className="bg-destructive/10 text-destructive rounded-lg p-4 text-sm"
          data-testid="event-attachments-error"
        >
          {error}
        </div>
      )}

      <div className="border-border bg-secondary/60 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-sm">
        <p className="text-muted-foreground text-sm">
          Upload PDFs (directions, waivers, schedules). Max {PDF_MAX_BYTES / (1024 * 1024)} MB each.
        </p>
        <label className="bg-terracotta hover:bg-terracotta inline-flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 font-medium text-white">
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            onChange={onPick}
            disabled={uploading}
            className="hidden"
            data-testid="event-attachments-file-input"
          />
          {uploading ? 'Uploading…' : 'Choose PDF'}
        </label>
      </div>

      {attachments.length === 0 ? (
        <p className="text-muted-foreground text-sm italic" data-testid="event-attachments-empty">
          No attachments yet.
        </p>
      ) : (
        <ul className="space-y-3" data-testid="event-attachments-list">
          {attachments.map((attachment) => (
            <li
              key={attachment.id}
              className="border-border bg-card rounded-lg border p-4"
              data-testid="event-attachments-item"
              data-attachment-id={attachment.id}
            >
              {renamingId === attachment.id ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    maxLength={PDF_MAX_FILENAME_LENGTH}
                    className="border-border focus:border-terracotta focus:ring-foreground/20 block w-full rounded-lg border px-3 py-2 shadow-sm focus:ring-1 focus:outline-none"
                    aria-label="New filename"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => saveRename(attachment.id)}
                      className="bg-terracotta hover:bg-terracotta flex-1 rounded-lg px-3 py-1 text-sm font-medium text-white"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={cancelRename}
                      className="bg-secondary text-foreground/85 hover:bg-secondary flex-1 rounded-lg px-3 py-1 text-sm font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : deleteConfirm === attachment.id ? (
                <div className="space-y-2">
                  <p className="text-foreground/85 text-sm">
                    Delete <strong>{attachment.filename}</strong>? Guests will no longer be able to
                    download it.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleDelete(attachment.id)}
                      className="bg-destructive hover:bg-destructive flex-1 rounded-lg px-3 py-1 text-sm font-medium text-white"
                    >
                      Confirm Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm(null)}
                      className="bg-secondary text-foreground/85 hover:bg-secondary flex-1 rounded-lg px-3 py-1 text-sm font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground font-semibold break-all">{attachment.filename}</p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {formatBytes(attachment.sizeBytes)} · uploaded{' '}
                      {new Date(attachment.createdAt).toLocaleDateString('en-US')}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => beginRename(attachment)}
                      className="bg-terracotta/15 text-terracotta hover:bg-terracotta/20 rounded px-3 py-1 text-xs font-medium"
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm(attachment.id)}
                      className="bg-destructive/15 text-destructive hover:bg-destructive/20 rounded px-3 py-1 text-xs font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
