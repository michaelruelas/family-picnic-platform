'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import type { EventStatus } from '~/lib/generated/enums';

interface UserHit {
  id: string;
  name: string;
  email: string;
  household: { name: string } | null;
}

interface EventHit {
  id: string;
  name: string;
  date: string;
  status: EventStatus;
}

interface PageHit {
  href: string;
  label: string;
  description?: string;
}

const PAGES: PageHit[] = [
  {
    href: '/admin/dashboard',
    label: 'Dashboard',
    description: 'Event metrics and recent activity',
  },
  {
    href: '/admin/events',
    label: 'Events',
    description: 'Manage family picnic events',
  },
  {
    href: '/admin/invitations',
    label: 'Invitations',
    description: 'Send and track invitations',
  },
  {
    href: '/admin/communications',
    label: 'Communications',
    description: 'Broadcasts and SMS',
  },
  {
    href: '/admin/charges',
    label: 'Charges',
    description: 'Payments, refunds, forfeits',
  },
  {
    href: '/admin/audit-log',
    label: 'Audit Log',
    description: 'All administrative actions',
  },
];

const EMPTY: never[] = [];

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<UserHit[]>(EMPTY);
  const [events, setEvents] = useState<EventHit[]>(EMPTY);
  const [loading, setLoading] = useState(false);
  // Tracks whether the events list has been fetched at least once this
  // mount, so the events fetch in the search effect only fires the
  // first time and never re-runs when `events` state updates.
  const eventsLoadedRef = useRef(false);

  // ⌘K / Ctrl+K opens the palette. Esc closes.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  // Reset query + results on close.
  useEffect(() => {
    if (open) return;
    // Defer so the reset happens after React commits the close.
    const handle = window.setTimeout(() => {
      setQuery('');
      setUsers(EMPTY);
      setLoading(false);
    }, 0);
    return () => window.clearTimeout(handle);
  }, [open]);

  // Load the event list once per mount. The ref guard means the
  // user-search effect does not re-fire when the events state updates.
  useEffect(() => {
    if (eventsLoadedRef.current) return;
    eventsLoadedRef.current = true;
    void fetch('/api/admin/events')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Array<{ id: string; name: string; date: string; status: EventStatus }>) =>
        setEvents(
          data.map((e) => ({
            id: e.id,
            name: e.name,
            date: e.date,
            status: e.status,
          })),
        ),
      )
      .catch(() => {
        // On failure we still mark loaded so we don't retry forever;
        // an empty list just means no event matches will appear.
      });
  }, []);

  // Debounced user search. Runs on every query change while the
  // palette is open. Independent of `events` so the events fetch
  // completing doesn't restart the debounce.
  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();

    if (trimmed.length < 2) {
      const handle = window.setTimeout(() => {
        setUsers(EMPTY);
        setLoading(false);
      }, 0);
      return () => window.clearTimeout(handle);
    }

    const handle = window.setTimeout(() => {
      setLoading(true);
      fetch(`/api/admin/users/search?q=${encodeURIComponent(trimmed)}`)
        .then((r) => (r.ok ? r.json() : { users: [] }))
        .then((data) => setUsers(data.users ?? []))
        .catch(() => setUsers([]))
        .finally(() => setLoading(false));
    }, 200);
    return () => window.clearTimeout(handle);
  }, [query, open, events.length]);

  const filteredPages = useMemo(() => {
    if (!query) return PAGES;
    const lower = query.toLowerCase();
    return PAGES.filter(
      (p) =>
        p.label.toLowerCase().includes(lower) ||
        (p.description?.toLowerCase().includes(lower) ?? false),
    );
  }, [query]);

  const filteredEvents = useMemo(() => {
    if (!query) return events.slice(0, 8);
    const lower = query.toLowerCase();
    return events.filter((e) => e.name.toLowerCase().includes(lower)).slice(0, 8);
  }, [events, query]);

  function navigate(href: string) {
    setOpen(false);
    router.push(href);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-24"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      data-testid="command-palette"
    >
      <button
        type="button"
        aria-label="Close palette"
        onClick={() => setOpen(false)}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      <div className="bg-card border-border relative z-10 w-full max-w-lg overflow-hidden rounded-sm border shadow-xl">
        <Command label="Command palette" className="flex flex-col">
          <div className="border-border border-b px-4 py-3">
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Search users, events, or pages…"
              className="text-foreground placeholder:text-muted-foreground w-full bg-transparent text-base outline-none"
              autoFocus
              data-testid="command-palette-input"
            />
          </div>
          <Command.List className="max-h-80 overflow-y-auto p-2">
            {filteredPages.length === 0 && filteredEvents.length === 0 && users.length === 0 ? (
              <Command.Empty className="text-muted-foreground py-6 text-center text-sm">
                {loading ? 'Searching…' : 'No results.'}
              </Command.Empty>
            ) : null}

            {filteredPages.length > 0 ? (
              <Command.Group
                heading="Pages"
                className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase"
              >
                {filteredPages.map((p) => (
                  <Command.Item
                    key={p.href}
                    value={`page:${p.label}`}
                    onSelect={() => navigate(p.href)}
                    className="text-foreground aria-selected:bg-secondary flex cursor-pointer items-start gap-3 rounded-sm px-3 py-2 text-sm"
                  >
                    <span className="bg-terracotta/15 text-terracotta mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-xs">
                      →
                    </span>
                    <span className="flex-1">
                      <span className="block font-medium">{p.label}</span>
                      {p.description ? (
                        <span className="text-muted-foreground block text-xs">{p.description}</span>
                      ) : null}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            ) : null}

            {filteredEvents.length > 0 ? (
              <Command.Group
                heading="Events"
                className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase"
              >
                {filteredEvents.map((e) => (
                  <Command.Item
                    key={e.id}
                    value={`event:${e.name}`}
                    onSelect={() => navigate(`/admin/events/${e.id}/edit`)}
                    className="text-foreground aria-selected:bg-secondary flex cursor-pointer items-center gap-3 rounded-sm px-3 py-2 text-sm"
                  >
                    <span className="bg-sage/20 text-sage flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-xs">
                      📅
                    </span>
                    <span className="flex-1">
                      <span className="block font-medium">{e.name}</span>
                      <span className="text-muted-foreground block text-xs">
                        {new Date(e.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}{' '}
                        · {e.status}
                      </span>
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            ) : null}

            {users.length > 0 ? (
              <Command.Group
                heading="Users"
                className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase"
              >
                {users.map((u) => (
                  <Command.Item
                    key={u.id}
                    value={`user:${u.name} ${u.email}`}
                    onSelect={() => navigate(`/admin/charges?user=${encodeURIComponent(u.email)}`)}
                    className="text-foreground aria-selected:bg-secondary flex cursor-pointer items-center gap-3 rounded-sm px-3 py-2 text-sm"
                  >
                    <span className="bg-secondary text-foreground/85 flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-xs font-semibold">
                      {(u.name ?? u.email).slice(0, 1).toUpperCase()}
                    </span>
                    <span className="flex-1">
                      <span className="block font-medium">{u.name || u.email}</span>
                      <span className="text-muted-foreground block text-xs">
                        {u.email}
                        {u.household?.name ? ` · ${u.household.name}` : ''}
                      </span>
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            ) : null}
          </Command.List>
          <div className="border-border text-muted-foreground flex items-center justify-between border-t px-4 py-2 text-xs">
            <span>
              <kbd className="bg-secondary rounded px-1.5 py-0.5 font-mono">↑↓</kbd> navigate
            </span>
            <span>
              <kbd className="bg-secondary rounded px-1.5 py-0.5 font-mono">↵</kbd> open
            </span>
            <span>
              <kbd className="bg-secondary rounded px-1.5 py-0.5 font-mono">Esc</kbd> close
            </span>
          </div>
        </Command>
      </div>
    </div>
  );
}
