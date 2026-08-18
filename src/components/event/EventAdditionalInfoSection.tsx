import { sanitizeRichText } from '~/lib/sanitize-html';
import { EventDownloadsSection, type PublicEventAttachment } from './EventDownloadsSection';

export interface EventAdditionalInfoSectionProps {
  /**
   * Free-form body supplied by the event host (stored in Event.additionalInfo).
   * Rendered via the same TipTap-compatible sanitizer used for "A note from the host".
   */
  body: string | null;
  /**
   * FPP-137: PDF attachments surfaced directly inside the Additional Info tab.
   */
  attachments?: PublicEventAttachment[];
}

/**
 * FPP-46 / FPP-8 / FPP-136 / FPP-137: Additional Info tab content.
 * Renders the event's free-form additional-info block as sanitized rich text
 * (matching the "A note from the host" rendering on the overview tab) and
 * embeds the host's PDF downloads section.
 */
export function EventAdditionalInfoSection({
  body,
  attachments = [],
}: EventAdditionalInfoSectionProps) {
  const trimmed = body?.trim() ?? '';
  const hasBody = trimmed.length > 0;
  const hasAttachments = attachments.length > 0;

  return (
    <section data-testid="event-additional-info" className="space-y-8">
      <div>
        <p className="text-terracotta text-sm font-semibold tracking-widest uppercase">Extras</p>
        <h2 className="font-display text-foreground mt-2 text-3xl font-medium tracking-tight md:text-4xl">
          Additional Info
        </h2>
      </div>

      {!hasBody && !hasAttachments && (
        <p className="text-muted-foreground mt-6 text-sm italic">Nothing extra to share yet.</p>
      )}

      {hasBody && <AdditionalInfoBody body={trimmed} />}

      {hasAttachments && <EventDownloadsSection attachments={attachments} />}
    </section>
  );
}

function AdditionalInfoBody({ body }: { body: string }) {
  const safeHtml = sanitizeRichText(body);
  return (
    <div
      data-testid="additional-info-body"
      className="bg-card shadow-card ring-border/60 rich-text-content text-foreground/85 mt-6 space-y-3 rounded-sm p-7 text-base leading-relaxed ring-1 md:p-9"
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}
