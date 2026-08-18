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
  /**
   * Optional. When provided, the matching item gets the active
   * visual treatment + `aria-current="true"`. Used by scroll-spy
   * callers to highlight the section currently in view.
   */
  value?: string;
  /** Optional. Fires with the clicked item's key. */
  onValueChange?: (key: string) => void;
  ariaLabel: string;
  className?: string;
}

/**
 * FPP-46 / FPP-154: in-page scroll-anchor strip used on the event
 * overview page. Renders on every viewport (was mobile-only under
 * the tabbed shell, promoted under the FPP-154 continuous-scroll
 * redesign). Each click smooth-scrolls to the matching section id
 * and updates the URL hash so the back button + refresh preserve
 * the section.
 *
 * `value`/`onValueChange` are optional — the nav renders fine
 * without highlight state, and callers can wire up scroll-spy via
 * an IntersectionObserver if they want the in-view section to
 * stay highlighted as the user scrolls.
 */
export function EventAnchorNav({
  items,
  value,
  onValueChange,
  ariaLabel,
  className,
}: EventAnchorNavProps) {
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
      onValueChange?.(item.key);
    }
  };

  return (
    <nav
      aria-label={ariaLabel}
      className={
        'border-border bg-card/60 no-scrollbar overflow-x-auto rounded-sm border px-1.5 py-1.5 shadow-sm backdrop-blur' +
        (className ? ` ${className}` : '')
      }
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
