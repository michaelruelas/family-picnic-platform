'use client';

import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { usePathname } from 'next/navigation';
import { useMounted } from '~/hooks/useMounted';
import { isAdminRole } from '~/lib/constants';
import { trpc } from '~/lib/trpc-client';

interface NavItem {
  href: string;
  label: string;
}

export default function NavBarClient() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleTheme = () => {
    if (!mounted) return;
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (normalized === '/login') return null;

  const isAdmin = session?.user?.role ? isAdminRole(session.user.role) : false;

  // FPP-148: navbar "Event" link resolves to the latest non-archived
  // PUBLISHED event. Hidden until the query resolves so the navbar
  // does not flash an empty href.
  const { data: latestEvent } = trpc.event.getLatest.useQuery();
  const latestEventHref = latestEvent ? `/events/${latestEvent.id}` : null;

  const publicNavItems: NavItem[] = latestEventHref
    ? [{ href: latestEventHref, label: 'Event' }]
    : [];

  const authenticatedNavItems: NavItem[] = session
    ? [
        { href: '/household', label: 'Household' },
        { href: '/profile', label: 'Profile' },
        ...(isAdmin ? [{ href: '/admin/dashboard', label: 'Admin' }] : []),
      ]
    : [];

  return (
    <nav className="border-border/60 bg-background/80 sticky top-0 z-30 border-b backdrop-blur-lg">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <Link
          href="/"
          onClick={() => setMobileMenuOpen(false)}
          className="group flex items-center gap-2.5"
        >
          <div className="border-border bg-card shadow-soft flex h-10 w-10 items-center justify-center overflow-hidden rounded-sm border p-1 transition-transform duration-300 group-hover:scale-105">
            <Image
              src="/folia-family-picnic-logo.png"
              alt="Folia Family Picnic logo"
              width={32}
              height={32}
              priority
              className="h-full w-full object-contain"
            />
          </div>
          <div className="hidden sm:block">
            <p className="font-display text-foreground text-lg leading-none font-semibold tracking-tight">
              Folia Family Picnic
            </p>
            <p className="text-muted-foreground mt-1 text-xs">Gathering every year.</p>
          </div>
        </Link>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="hidden gap-1 md:flex">
            {publicNavItems.map((item) => (
              <NavLink key={item.href} href={item.href}>
                {item.label}
              </NavLink>
            ))}
          </div>
          {status === 'loading' ? (
            <span className="bg-secondary text-muted-foreground rounded-sm px-4 py-2 text-sm font-medium opacity-50">
              ...
            </span>
          ) : session ? (
            <div className="flex items-center gap-1.5">
              {authenticatedNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-muted-foreground hover:text-foreground hidden rounded-sm px-3 py-2 text-sm font-medium transition-colors md:inline"
                >
                  {item.label}
                </Link>
              ))}
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="border-border bg-card text-foreground hover:border-foreground press rounded-sm border px-4 py-2 text-sm font-medium transition-all"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="bg-foreground text-background hover:bg-foreground/90 press rounded-sm px-5 py-2 text-sm font-semibold transition-all"
            >
              Sign In
            </Link>
          )}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={
              mounted
                ? `Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`
                : 'Toggle theme'
            }
            title="Toggle light/dark — manage in Profile → Appearance"
            className="border-border bg-card text-foreground hover:border-foreground/50 hover:bg-secondary press flex h-10 w-10 items-center justify-center rounded-sm border transition-all"
          >
            {mounted && resolvedTheme === 'dark' ? (
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <circle cx="12" cy="12" r="4" />
                <path
                  strokeLinecap="round"
                  d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41"
                />
              </svg>
            ) : (
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
                />
              </svg>
            )}
          </button>

          {/* Mobile hamburger menu button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
            className="border-border bg-card text-foreground hover:bg-secondary press flex h-10 w-10 items-center justify-center rounded-sm border transition-all md:hidden"
          >
            {mobileMenuOpen ? (
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile navigation drawer / dropdown */}
      {mobileMenuOpen && (
        <div
          className="border-border/60 bg-background/95 divide-border/60 divide-y border-t px-5 py-4 md:hidden"
          data-testid="mobile-nav-menu"
        >
          <div className="flex flex-col gap-1 pb-3">
            {publicNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="text-foreground hover:bg-secondary rounded-sm px-3 py-2 text-sm font-medium transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </div>
          {session ? (
            <div className="flex flex-col gap-1 pt-3">
              {authenticatedNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-foreground hover:bg-secondary rounded-sm px-3 py-2 text-sm font-medium transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          ) : (
            <div className="pt-3">
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="bg-foreground text-background hover:bg-foreground/90 block w-full rounded-sm px-4 py-2.5 text-center text-sm font-semibold transition-all"
              >
                Sign In
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-foreground/80 hover:bg-secondary hover:text-foreground rounded-sm px-4 py-2 text-sm font-medium transition-colors"
    >
      {children}
    </Link>
  );
}
