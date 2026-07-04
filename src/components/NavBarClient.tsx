'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import ThemeSwitcher from './ThemeSwitcher';

export default function NavBarClient() {
  const { data: session, status } = useSession();

  return (
    <nav className="bg-primary text-primary-foreground shadow-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-xl font-bold hover:opacity-90">
          Family Picnic
        </Link>
        <div className="flex items-center gap-6">
          <div className="hidden gap-6 md:flex">
            <Link href="/" className="hover:opacity-80">
              Home
            </Link>
            <Link href="/events" className="hover:opacity-80">
              Events
            </Link>
            <Link href="/potluck" className="hover:opacity-80">
              Potluck
            </Link>
            <Link href="/photos" className="hover:opacity-80">
              Photos
            </Link>
          </div>
          <ThemeSwitcher />
          {status === 'loading' ? (
            <span className="bg-primary-foreground/10 rounded-lg px-3 py-1 text-sm font-medium opacity-50">
              ...
            </span>
          ) : session ? (
            <div className="flex items-center gap-4">
              <Link href="/my-events" className="hidden hover:opacity-80 md:inline">
                My Events
              </Link>
              <Link href="/profile" className="hidden hover:opacity-80 md:inline">
                Profile
              </Link>
              <span className="hidden text-sm opacity-80 md:inline">{session.user?.name}</span>
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="bg-primary-foreground/10 hover:bg-primary-foreground/20 rounded-lg px-3 py-1 text-sm font-medium"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="bg-primary-foreground/10 hover:bg-primary-foreground/20 rounded-lg px-3 py-1 text-sm font-medium"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
