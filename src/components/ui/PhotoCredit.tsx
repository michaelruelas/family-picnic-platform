import Link from 'next/link';
import type { ComponentProps } from 'react';

type LinkProps = ComponentProps<typeof Link>;

interface PhotoCreditProps {
  photographer: string;
  photographerUrl?: string;
  platform?: string;
  licenseUrl?: string;
  /** Tailwind classes for the wrapper — useful for positioning */
  className?: string;
  /** Aria label override */
  ariaLabel?: string;
}

/**
 * Tasteful photo credit overlay for Unsplash / Pexels etc. imagery.
 * Renders "Photo by [Name] on [Platform]" with the photographer name
 * linking to their profile and "Platform" linking to the source page.
 * Per Unsplash License (https://unsplash.com/license) attribution is
 * not required, but is appreciated.
 */
export function PhotoCredit({
  photographer,
  photographerUrl,
  platform = 'Unsplash',
  licenseUrl,
  className = '',
  ariaLabel,
}: PhotoCreditProps) {
  const linkProps: Partial<LinkProps> = {
    target: '_blank',
    rel: 'noopener noreferrer',
  };
  return (
    <p
      className={`text-[11px] leading-snug text-white/70 sm:text-xs ${className}`}
      aria-label={ariaLabel ?? `Photo by ${photographer} on ${platform}`}
    >
      Photo by{' '}
      {photographerUrl ? (
        <Link
          href={photographerUrl}
          {...linkProps}
          className="font-medium text-white/85 underline decoration-white/30 underline-offset-2 transition-colors hover:text-white hover:decoration-white/60"
        >
          {photographer}
        </Link>
      ) : (
        <span className="font-medium text-white/85">{photographer}</span>
      )}{' '}
      on{' '}
      {licenseUrl ? (
        <Link
          href={licenseUrl}
          {...linkProps}
          className="font-medium text-white/85 underline decoration-white/30 underline-offset-2 transition-colors hover:text-white hover:decoration-white/60"
        >
          {platform}
        </Link>
      ) : (
        <span className="font-medium text-white/85">{platform}</span>
      )}
    </p>
  );
}
