'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';

const adminLinks = [
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/events', label: 'Events' },
  { href: '/admin/invitations', label: 'Invitations' },
  { href: '/admin/communications', label: 'Communications' },
  { href: '/admin/audit-log', label: 'Audit Log' },
];

export default function AdminNavBar() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return null;
  }

  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'ADMIN_ADULT';

  if (!isAdmin) {
    return null;
  }

  return (
    <nav className="border-terracotta/15 bg-sunlight/15 border-b">
      <div className="mx-auto max-w-6xl px-5 py-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-pill bg-terracotta/15 text-terracotta mr-2 inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold tracking-wider uppercase">
            <span className="bg-terracotta h-1.5 w-1.5 rounded-full" />
            Admin
          </span>
          {adminLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-pill text-foreground/80 hover:bg-card hover:text-foreground px-3 py-1.5 text-sm font-medium transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
