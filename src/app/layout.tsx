import type { Metadata, Viewport } from 'next';
import './globals.css';
import Providers from '~/components/Providers';
import NavBarClient from '~/components/NavBarClient';
import AdminNavBar from '~/components/AdminNavBar';

export const metadata: Metadata = {
  title: 'Family Picnic Platform',
  description:
    'A private family engagement hub for our annual picnic — RSVP, potluck coordination, photo sharing, and family communication.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-512.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#166534',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-stone-50 text-stone-900 antialiased">
        <Providers>
          <NavBarClient />
          <AdminNavBar />
          {children}
        </Providers>
      </body>
    </html>
  );
}
