export interface EventAdditionalInfoSectionProps {
  /**
   * Free-form body supplied by the event host. Until the dedicated
   * `additionalInfo` column lands on the `Event` model, this is
   * always `null` and the tab renders its empty state. When the field
   * arrives, swap this prop for `event.additionalInfo` and the
   * placeholder copy goes away.
   */
  body: string | null;
}

/**
 * FPP-46 / FPP-8: Additional Info tab content. Renders the event's
 * free-form additional-info block (bold / lists / basic markdown).
 *
 * Today the `Event` model has no `additionalInfo` column, so `body`
 * is always null and the tab shows its empty state. The marker
 * `data-testid="event-additional-info"` lets future tests assert
 * that the section is present even when empty (the tab panel itself
 * stays mounted behind the `Tabs` primitive).
 */
export function EventAdditionalInfoSection({ body }: EventAdditionalInfoSectionProps) {
  const trimmed = body?.trim() ?? '';

  return (
    <section data-testid="event-additional-info">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-terracotta text-sm font-semibold tracking-widest uppercase">Extras</p>
          <h2 className="font-display text-foreground mt-2 text-3xl font-medium tracking-tight md:text-4xl">
            Additional Info
          </h2>
        </div>
      </div>

      {trimmed.length === 0 ? (
        /*
          FPP-8: "Empty state: hidden." We honour that by not
          rendering an empty-state card when the host hasn't shared
          anything yet — the tab itself stays available so the URL
          deep link still resolves, but the panel body is a quiet
          "nothing extra" line instead of a noisy placeholder.
        */
        <p className="text-muted-foreground mt-6 text-sm italic">Nothing extra to share yet.</p>
      ) : (
        <AdditionalInfoBody body={trimmed} />
      )}
    </section>
  );
}

/**
 * Minimal markdown-ish renderer for `additional_info`. The host can
 * use **bold**, *italic*, `code`, simple `- lists`, and [links](url)
 * without us pulling in a full markdown dependency. Anything more
 * exotic falls through as plain text until we add `react-markdown`
 * alongside the new `additionalInfo` column on `Event`.
 */
function AdditionalInfoBody({ body }: { body: string }) {
  return (
    <div className="bg-card shadow-card ring-border/60 mt-6 space-y-3 rounded-3xl p-7 text-base leading-relaxed ring-1 md:p-9">
      {body.split(/\n{2,}/).map((paragraph, idx) => {
        const trimmedParagraph = paragraph.trim();
        if (!trimmedParagraph) return null;
        if (trimmedParagraph.startsWith('- ')) {
          const items = trimmedParagraph.split(/\n-\s+/).map((s) => s.replace(/^- /, '').trim());
          return (
            <ul key={idx} className="text-foreground/85 list-disc space-y-1 pl-5">
              {items.map((item, itemIdx) => (
                <li key={itemIdx}>{renderInline(item)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={idx} className="text-foreground/85">
            {renderInline(trimmedParagraph)}
          </p>
        );
      })}
    </div>
  );
}

function renderInline(text: string) {
  // Order matters: links first (they may contain ** or *), then bold,
  // then italic, then inline code. Each match is replaced with a
  // React node carrying its original source for keys.
  const nodes: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  const patterns: Array<{
    regex: RegExp;
    render: (match: RegExpMatchArray) => React.ReactNode;
  }> = [
    {
      regex: /\[([^\]]+)\]\(([^)]+)\)/,
      render: (m) => (
        <a
          key={`link-${key++}`}
          href={m[2]}
          className="text-terracotta underline underline-offset-2 hover:text-[#cf6c52]"
        >
          {m[1]}
        </a>
      ),
    },
    {
      regex: /\*\*([^*]+)\*\*/,
      render: (m) => (
        <strong key={`b-${key++}`} className="text-foreground font-semibold">
          {m[1]}
        </strong>
      ),
    },
    {
      regex: /\*([^*]+)\*/,
      render: (m) => (
        <em key={`i-${key++}`} className="text-foreground/90 italic">
          {m[1]}
        </em>
      ),
    },
    {
      regex: /`([^`]+)`/,
      render: (m) => (
        <code
          key={`c-${key++}`}
          className="bg-secondary text-foreground rounded-md px-1.5 py-0.5 font-mono text-sm"
        >
          {m[1]}
        </code>
      ),
    },
  ];

  while (remaining.length > 0) {
    let earliestMatch: {
      index: number;
      match: RegExpMatchArray;
      render: (typeof patterns)[number]['render'];
    } | null = null;
    for (const pattern of patterns) {
      const match = remaining.match(pattern.regex);
      if (match && match.index !== undefined) {
        if (!earliestMatch || match.index < earliestMatch.index) {
          earliestMatch = { index: match.index, match, render: pattern.render };
        }
      }
    }
    if (!earliestMatch) {
      nodes.push(remaining);
      break;
    }
    if (earliestMatch.index > 0) {
      nodes.push(remaining.slice(0, earliestMatch.index));
    }
    nodes.push(earliestMatch.render(earliestMatch.match));
    remaining = remaining.slice(earliestMatch.index + earliestMatch.match[0].length);
  }

  return nodes;
}
