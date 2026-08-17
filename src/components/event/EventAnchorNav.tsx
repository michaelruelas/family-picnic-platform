'use client';

import { ReactNode } from 'react';

export interface AnchorNavItem {
  key: string;
  label: ReactNode;
  /** DOM id of the section this link scrolls to. */
  anchorId: string;
}

interface EventAnchorNavProps {
  items: AnchorNavItem[];
  value: string;
  onValueChange: (key: string) => void;
  ariaLabel: string;
}

/**
 * FPP-46: Mobile scroll-anchor strip used on the event overview page.
 * Visible only on small viewports; the desktop tab strip lives in
 * `~/components/ui/Tabs`. Each click smooth-scrolls to the matching
 * section id and notifies the parent so it can keep the active-tab
 * state in sync with the visible section.
 */
export function EventAnchorNav({ items, value, onValueChange, ariaLabel }: EventAnchorNavProps) {
  const handleClick = (item: AnchorNavItem) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const target = document.getElementById(item.anchorId);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Update history so back-button / refresh preserves the section.
      if (typeof window !== 'undefined' && window.history?.replaceState) {
        const url = new URL(window.location.href);
        url.hash = item.anchorId;
        window.history.replaceState(null, '', url.toString());
      }
      onValueChange(item.key);
    }
  };

  return (
    <nav
      aria-label={ariaLabel}
      className="border-border bg-card/60 no-scrollbar -mx-5 overflow-x-auto rounded-sm border px-5 py-1.5 shadow-sm backdrop-blur"
      data-testid="event-anchor-nav"
    >
      <ul className="flex items-center gap-1">
        {items.map((item) => {
          const isActive = item.key === value;
          return (
            <li key={item.key} className="shrink-0">
              <a
                href={`#${item.anchorId}`}
                onClick={handleClick(item)}
                aria-current={isActive ? 'true' : undefined}
                data-testid={`event-anchor-${item.key}`}
                data-active={isActive ? 'true' : 'false'}
                className={
                  isActive
                    ? 'bg-foreground text-background inline-flex items-center justify-center gap-2 rounded-sm px-4 py-2.5 text-sm font-semibold transition-colors'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary inline-flex items-center justify-center gap-2 rounded-sm px-4 py-2.5 text-sm font-medium transition-colors'
                }
              >
                {item.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default EventAnchorNav;
