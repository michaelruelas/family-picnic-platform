'use client';

import { ReactNode, useRef, KeyboardEvent } from 'react';

export interface TabDefinition<TKey extends string = string> {
  key: TKey;
  label: ReactNode;
  panel: ReactNode;
  /** Optional id used for both the panel anchor and the aria-controls
   * link. Defaults to `panel-<key>`. */
  panelId?: string;
}

interface TabsProps<TKey extends string> {
  tabs: TabDefinition<TKey>[];
  value: TKey;
  onValueChange: (key: TKey) => void;
  ariaLabel: string;
  className?: string;
  /** Additional class applied to the tablist itself. */
  listClassName?: string;
  /** Optional id prefix for tab/panel ids. Defaults to `event-tab`. */
  idPrefix?: string;
}

/**
 * FPP-46: Accessible tab control used by the event overview page
 * (Header / Itinerary / Additional Info / Gallery).
 *
 * Hand-rolled to match the project's no-Radix dependency policy (see
 * `RsvpBottomSheet` for the same pattern). Provides arrow / Home / End
 * keyboard navigation, proper ARIA wiring, and a controlled value so the
 * parent can sync state to `?tab=<key>` deep links.
 *
 * The component renders the tablist plus every panel; non-active panels
 * receive the `hidden` attribute so they stay in the DOM (preserving any
 * client state) but are not visible to sighted users or AT. The event
 * overview page renders mobile anchor markup separately to keep mobile
 * "scroll-anchors not tabs" behavior simple.
 */
export function Tabs<TKey extends string>({
  tabs,
  value,
  onValueChange,
  ariaLabel,
  className = '',
  listClassName = '',
  idPrefix = 'event-tab',
}: TabsProps<TKey>) {
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    let nextIndex: number;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = (currentIndex + 1) % tabs.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = tabs.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const nextKey = tabs[nextIndex]!.key;
    onValueChange(nextKey);
    tabRefs.current[nextKey]?.focus();
  };

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label={ariaLabel}
        aria-orientation="horizontal"
        className={`border-border bg-card/60 inline-flex flex-wrap items-center gap-1 rounded-sm border p-1 shadow-sm backdrop-blur ${listClassName}`}
      >
        {tabs.map((tab, i) => {
          const isActive = tab.key === value;
          const tabId = `${idPrefix}-${tab.key}`;
          return (
            <button
              key={tab.key}
              ref={(el) => {
                tabRefs.current[tab.key] = el;
              }}
              type="button"
              role="tab"
              id={tabId}
              aria-selected={isActive}
              aria-controls={`${idPrefix}-panel-${tab.key}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => {
                if (!isActive) onValueChange(tab.key);
              }}
              onKeyDown={(e) => handleKeyDown(e, i)}
              data-testid={`tab-${tab.key}`}
              data-active={isActive ? 'true' : 'false'}
              className={
                isActive
                  ? 'bg-foreground text-background rounded-sm px-4 py-2 text-sm font-semibold transition-colors'
                  : 'text-muted-foreground hover:text-foreground rounded-sm px-4 py-2 text-sm font-medium transition-colors'
              }
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/*
        Panels are always rendered (with `hidden` on the inactive ones)
        so mobile anchor links can scroll to them and any stateful
        client components inside the panel survive tab switches.
        `mt-8` keeps the active panel clear of the tablist above it.
      */}
      <div className="mt-8">
        {tabs.map((tab) => {
          const isActive = tab.key === value;
          const panelId = tab.panelId ?? `${idPrefix}-panel-${tab.key}`;
          return (
            <div
              key={tab.key}
              role="tabpanel"
              id={panelId}
              aria-labelledby={`${idPrefix}-${tab.key}`}
              hidden={!isActive}
              tabIndex={0}
              className="focus:outline-none"
            >
              {tab.panel}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default Tabs;
