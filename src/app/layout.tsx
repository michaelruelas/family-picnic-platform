import type { Metadata, Viewport } from 'next';
import { Bevan, Inter } from 'next/font/google';
import './globals.css';
import Providers from '~/components/Providers';
import NavBarClient from '~/components/NavBarClient';
import Footer from '~/components/Footer';
import { themeColors, getThemeCss, getThemeScript } from '~/lib/theme';

const bevan = Bevan({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
  weight: '400',
});

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Folia Family Picnic — Fun, Food, and Memories',
  description:
    'A private family engagement hub for our annual picnic — RSVP, potluck coordination, photo sharing, and family communication.',
  appleWebApp: {
    title: 'Folia Family Picnic',
  },
};

export const viewport: Viewport = {
  themeColor: themeColors.primary,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bevan.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        <style
          id="dynamic-theme"
          dangerouslySetInnerHTML={{
            __html: getThemeCss(),
          }}
        />
        <script
          id="dynamic-theme-script"
          dangerouslySetInnerHTML={{
            __html: getThemeScript(),
          }}
        />
      </head>
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
