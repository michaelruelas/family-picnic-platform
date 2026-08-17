import type { Metadata, Viewport } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import './globals.css';
import Providers from '~/components/Providers';
import NavBarClient from '~/components/NavBarClient';
import Footer from '~/components/Footer';

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
  title: 'Folia Picnic — Fun, Food, and Memories',
  description:
    'A private family engagement hub for our annual picnic — RSVP, potluck coordination, photo sharing, and family communication.',
  appleWebApp: {
    title: 'Folia Picnic',
  },
};

export const viewport: Viewport = {
  themeColor: '#F9F8F6',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col antialiased">
        <Providers>
          <NavBarClient />
          <div className="flex-1">{children}</div>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
