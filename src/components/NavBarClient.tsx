'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';

export default function NavBarClient() {
  const { data: session, status } = useSession();

  return (
    <nav className="bg-amber-800 text-white shadow-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-xl font-bold hover:text-amber-200">
          Family Picnic
        </Link>
        <div className="flex gap-6">
          <Link href="/" className="hover:text-amber-200">
            Home
          </Link>
          <Link href="/events" className="hover:text-amber-200">
            Events
          </Link>
          <Link href="/potluck" className="hover:text-amber-200">
            Potluck
          </Link>
          <Link href="/photos" className="hover:text-amber-200">
            Photos
          </Link>
          {status === 'loading' ? (
            <span className="rounded-lg bg-amber-600 px-3 py-1 text-sm font-medium opacity-50">
              ...
            </span>
          ) : session ? (
            <div className="flex items-center gap-4">
              <Link href="/my-events" className="hover:text-amber-200">
                My Events
              </Link>
              <span className="text-sm text-amber-200">{session.user?.name}</span>
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="rounded-lg bg-amber-600 px-3 py-1 text-sm font-medium hover:bg-amber-500"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-amber-600 px-3 py-1 text-sm font-medium hover:bg-amber-500"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
