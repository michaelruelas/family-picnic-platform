'use client';

import { HTMLAttributes } from 'react';

interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: 'calendar' | 'photo' | 'users' | 'list' | 'search' | 'inbox' | 'sparkle';
  variant?: 'default' | 'sunlight' | 'sage';
}

const iconPaths: Record<string, string> = {
  calendar:
    'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  photo:
    'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
  users:
    'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
  list: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
  search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  inbox:
    'M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4',
  sparkle:
    'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z',
};

const variantClasses: Record<'default' | 'sunlight' | 'sage', string> = {
  default: 'bg-secondary',
  sunlight: 'bg-sunlight/20',
  sage: 'bg-sage/15',
};

export default function EmptyState({
  title,
  description,
  action,
  icon = 'inbox',
  variant = 'default',
  className = '',
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-3xl py-16 text-center ${variantClasses[variant]} ${className}`}
      {...props}
    >
      <div className="bg-card shadow-soft rounded-full p-5">
        <svg
          className="text-muted-foreground h-10 w-10"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d={iconPaths[icon]} />
        </svg>
      </div>
      <h3 className="font-display text-foreground mt-5 text-2xl font-semibold">{title}</h3>
      {description && (
        <p className="text-muted-foreground mt-2 max-w-sm text-base leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
