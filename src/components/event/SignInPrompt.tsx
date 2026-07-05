import Link from 'next/link';
import { ReactNode } from 'react';

interface SignInPromptProps {
  title?: string;
  description?: string;
  variant?: 'sunlight' | 'sage' | 'default';
  children?: ReactNode;
}

export function SignInPrompt({
  title = 'A few details are just for family',
  description = 'Sign in to see who is bringing what and who is joining the table.',
  variant = 'sunlight',
  children,
}: SignInPromptProps) {
  const variantClasses: Record<NonNullable<SignInPromptProps['variant']>, string> = {
    sunlight: 'bg-sunlight/20 ring-sunlight/40',
    sage: 'bg-sage/15 ring-sage/30',
    default: 'bg-secondary ring-border',
  };

  return (
    <div className={`shadow-card rounded-3xl p-8 text-center ring-1 ${variantClasses[variant]}`}>
      <div className="bg-card shadow-soft mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl">
        <svg
          className="text-terracotta h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
          />
        </svg>
      </div>
      <h3 className="font-display text-foreground mt-5 text-2xl font-semibold tracking-tight">
        {title}
      </h3>
      <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-base leading-relaxed">
        {description}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href="/login"
          className="rounded-pill bg-terracotta shadow-soft press px-6 py-3 font-semibold text-white transition-all hover:scale-[1.02] hover:bg-[#cf6c52]"
        >
          Sign in
        </Link>
        {children}
      </div>
    </div>
  );
}
