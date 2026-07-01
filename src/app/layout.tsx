import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Family Picnic Platform',
  description:
    'A private family engagement hub for our annual picnic — RSVP, potluck coordination, photo sharing, and family communication.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-stone-50 text-stone-900 antialiased">{children}</body>
    </html>
  );
}
