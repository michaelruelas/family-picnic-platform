import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Family Picnic Platform',
  description:
    'A private family engagement hub for our annual picnic — RSVP, potluck coordination, photo sharing, and family communication.',
};

function NavBar() {
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
        </div>
      </div>
    </nav>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-stone-50 text-stone-900 antialiased">
        <NavBar />
        {children}
      </body>
    </html>
  );
}
