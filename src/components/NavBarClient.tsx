'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useMounted } from '~/hooks/useMounted';

export default function NavBarClient() {
  const { data: session, status } = useSession();
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();

  const toggleTheme = () => {
    if (!mounted) return;
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <nav className="border-border/60 bg-background/80 sticky top-0 z-30 border-b backdrop-blur-lg">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <Link href="/" className="group flex items-center gap-2.5">
          <div className="bg-terracotta shadow-soft flex h-10 w-10 items-center justify-center rounded-2xl text-lg transition-transform duration-300 group-hover:scale-105">
            <span className="-mt-0.5">🏡</span>
          </div>
          <div className="hidden sm:block">
            <p className="font-display text-foreground text-lg leading-none font-semibold tracking-tight">
              The Family Picnic
            </p>
            <p className="text-muted-foreground mt-1 text-xs">A place for our people</p>
          </div>
        </Link>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="hidden gap-1 md:flex">
            <NavLink href="/">Home</NavLink>
            <NavLink href="/events">Events</NavLink>
            <NavLink href="/potluck">Potluck</NavLink>
            <NavLink href="/photos">Photos</NavLink>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={
              mounted
                ? `Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`
                : 'Toggle theme'
            }
            title="Toggle light/dark — manage in Profile → Appearance"
            className="border-border bg-card text-foreground hover:border-foreground/50 hover:bg-secondary rounded-pill press flex h-10 w-10 items-center justify-center border transition-all"
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
          {status === 'loading' ? (
            <span className="rounded-pill bg-secondary text-muted-foreground px-4 py-2 text-sm font-medium opacity-50">
              ...
            </span>
          ) : session ? (
            <div className="flex items-center gap-1.5">
              <Link
                href="/my-events"
                className="rounded-pill text-muted-foreground hover:text-foreground hidden px-3 py-2 text-sm font-medium transition-colors md:inline"
              >
                My Events
              </Link>
              <Link
                href="/profile"
                className="rounded-pill text-muted-foreground hover:text-foreground hidden px-3 py-2 text-sm font-medium transition-colors md:inline"
              >
                Profile
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="rounded-pill border-border bg-card text-foreground hover:border-foreground press border px-4 py-2 text-sm font-medium transition-all"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-pill bg-foreground text-background hover:bg-foreground/90 press px-5 py-2 text-sm font-semibold transition-all"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-pill text-foreground/80 hover:bg-secondary hover:text-foreground px-4 py-2 text-sm font-medium transition-colors"
    >
      {children}
    </Link>
  );
}
