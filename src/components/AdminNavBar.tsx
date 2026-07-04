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
    <nav className="bg-secondary text-secondary-foreground shadow-sm">
      <div className="mx-auto flex max-w-5xl items-center px-4 py-2">
        <div className="flex gap-6">
          {adminLinks.map((link) => (
            <Link key={link.href} href={link.href} className="text-sm font-medium hover:opacity-80">
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
