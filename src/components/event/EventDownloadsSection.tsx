/**
 * FPP-43 / FPP-1: "Downloads" block for the public event page.
 *
 * Renders one download link per PDF attachment. The link points at
 * `/api/public/event-attachments/{id}/download`, which 302-redirects
 * to a short-lived presigned URL. The block is hidden entirely when
 * the host hasn't attached any PDFs.
 */
export interface PublicEventAttachment {
  id: string;
  filename: string;
  sizeBytes: number;
}

export interface EventDownloadsSectionProps {
  attachments: PublicEventAttachment[];
}

export function EventDownloadsSection({ attachments }: EventDownloadsSectionProps) {
  if (attachments.length === 0) return null;

  return (
    <section
      className="bg-card shadow-card ring-border/60 rounded-sm p-7 ring-1 md:p-9"
      data-testid="event-downloads-section"
    >
      <h3 className="font-display text-foreground text-3xl font-medium tracking-tight md:text-4xl">
        Documents from the host
      </h3>
      <p className="text-muted-foreground mt-2">
        Directions, waivers, schedules — anything the host shared for this event.
      </p>
      <ul className="mt-5 space-y-2" data-testid="event-downloads-list">
        {attachments.map((attachment) => (
          <li
            key={attachment.id}
            data-testid="event-downloads-item"
            data-attachment-id={attachment.id}
          >
            <a
              href={`/api/public/event-attachments/${attachment.id}/download`}
              className="bg-secondary text-foreground hover:bg-sunlight/20 flex items-center gap-3 rounded-sm px-4 py-3 transition-colors"
              rel="noopener"
              download={attachment.filename}
            >
              <span className="text-terracotta text-lg" aria-hidden>
                📄
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{attachment.filename}</span>
                <span className="text-muted-foreground block text-xs">
                  PDF · {formatBytes(attachment.sizeBytes)}
                </span>
              </span>
              <span className="text-terracotta text-sm font-medium" aria-hidden>
                Download
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
