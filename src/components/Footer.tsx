import Link from 'next/link';
import { APP_VERSION } from '~/lib/constants';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-border/60 bg-card/40 text-muted-foreground mt-auto border-t py-8 text-sm">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 text-center sm:flex-row sm:text-left">
        <div className="flex flex-col gap-1">
          <p className="font-display text-foreground font-semibold tracking-tight">
            Folia Family Picnic
          </p>
          <p className="text-xs">
            © {currentYear} Folia Picnic. All rights reserved. • Build v{APP_VERSION}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-6 text-xs sm:text-sm">
          <Link href="/terms-of-service" className="hover:text-foreground transition-colors">
            Terms of Service
          </Link>
          <Link href="/privacy-policy" className="hover:text-foreground transition-colors">
            Privacy Policy
          </Link>
          <a
            href="mailto:support@foliapicnic.com"
            className="hover:text-foreground transition-colors"
          >
            Contact
          </a>
        </div>
      </div>
    </footer>
  );
}
