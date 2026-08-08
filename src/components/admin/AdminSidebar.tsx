'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';

interface NavItem {
  href: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  {
    href: '/admin/dashboard',
    label: 'Dashboard',
    description: 'Event metrics and recent activity',
    icon: (
      <svg
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.6}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3v-7h6v7h3a1 1 0 001-1V10"
        />
      </svg>
    ),
  },
  {
    href: '/admin/events',
    label: 'Events',
    description: 'Manage family picnic events',
    icon: (
      <svg
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.6}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    ),
  },
  {
    href: '/admin/invitations',
    label: 'Invitations',
    description: 'Send and track invitations',
    icon: (
      <svg
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.6}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 8l9 6 9-6m-18 0v8a2 2 0 002 2h14a2 2 0 002-2V8m-18 0V6a2 2 0 012-2h14a2 2 0 012 2v2"
        />
      </svg>
    ),
  },
  {
    href: '/admin/communications',
    label: 'Communications',
    description: 'Broadcasts and SMS',
    icon: (
      <svg
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.6}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"
        />
      </svg>
    ),
  },
  {
    href: '/admin/charges',
    label: 'Charges',
    description: 'Payments, refunds, forfeits',
    icon: (
      <svg
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.6}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 10h18M5 6h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2zm4 9h2"
        />
      </svg>
    ),
  },
  {
    href: '/admin/audit-log',
    label: 'Audit Log',
    description: 'All administrative actions',
    icon: (
      <svg
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.6}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
        />
      </svg>
    ),
  },
];

function isActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  // Treat nested routes (e.g. /admin/events/[id]/edit) as belonging to the
  // parent section so the section stays highlighted while drilling down.
  if (pathname.startsWith(`${href}/`)) return true;
  return false;
}

interface AdminSidebarProps {
  onNavigate?: () => void;
}

export default function AdminSidebar({ onNavigate }: AdminSidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <aside
      className="border-sidebar-border bg-sidebar text-sidebar-foreground flex h-full w-64 flex-col border-r"
      data-testid="admin-sidebar"
    >
      <div className="border-sidebar-border border-b px-5 py-5">
        <Link
          href="/admin/dashboard"
          className="group flex items-center gap-2.5"
          onClick={onNavigate}
        >
          <div className="bg-terracotta shadow-soft flex h-10 w-10 items-center justify-center rounded-2xl text-lg transition-transform group-hover:scale-105">
            <span className="-mt-0.5">🏡</span>
          </div>
          <div>
            <p className="font-display text-foreground text-base leading-none font-semibold tracking-tight">
              Admin
            </p>
            <p className="text-muted-foreground mt-1 text-xs">The Family Picnic</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Admin navigation">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              data-testid={`admin-nav-${item.href.split('/').pop()}`}
              data-active={active}
              className={`group flex items-start gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                active
                  ? 'bg-terracotta/15 text-terracotta font-semibold'
                  : 'text-foreground/80 hover:bg-secondary hover:text-foreground'
              }`}
            >
              <span
                className={`mt-0.5 shrink-0 ${active ? 'text-terracotta' : 'text-muted-foreground group-hover:text-foreground'}`}
              >
                {item.icon}
              </span>
              <span className="flex-1">
                <span className="block">{item.label}</span>
                {item.description ? (
                  <span
                    className={`mt-0.5 block text-xs font-normal ${
                      active ? 'text-terracotta/80' : 'text-muted-foreground'
                    }`}
                  >
                    {item.description}
                  </span>
                ) : null}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="border-sidebar-border space-y-2 border-t px-4 py-4">
        <div className="text-muted-foreground flex items-center justify-between text-xs">
          <span>Quick navigate</span>
          <kbd className="bg-card border-border rounded border px-1.5 py-0.5 font-mono text-[10px]">
            ⌘K
          </kbd>
        </div>
        {session?.user ? (
          <div className="text-foreground/85 text-sm">
            <p className="font-semibold">{session.user.name ?? 'Admin'}</p>
            <p className="text-muted-foreground truncate text-xs">{session.user.email}</p>
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/' })}
          className="border-border bg-card text-foreground hover:bg-secondary w-full rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
