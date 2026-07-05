import type { Metadata, Viewport } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import './globals.css';
import Providers from '~/components/Providers';
import NavBarClient from '~/components/NavBarClient';
import AdminNavBar from '~/components/AdminNavBar';

const fraunces = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
  axes: ['SOFT', 'opsz'],
});

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Family Picnic — A Place for Our People',
  description:
    'A private family engagement hub for our annual picnic — RSVP, potluck coordination, photo sharing, and family communication.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-512.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#F9F8F6',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`} suppressHydrationWarning>
      <body className="antialiased">
        <Providers>
          <NavBarClient />
          <AdminNavBar />
          {children}
        </Providers>
      </body>
    </html>
  );
}
