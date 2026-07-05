'use client';

import { HTMLAttributes } from 'react';

interface SpinnerProps extends HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

const sizeClasses = {
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-2',
  lg: 'h-12 w-12 border-[3px]',
};

export default function Spinner({ size = 'md', label, className = '', ...props }: SpinnerProps) {
  return (
    <div className={`flex items-center justify-center gap-3 ${className}`} {...props}>
      <span
        className={`${sizeClasses[size]} text-terracotta animate-spin rounded-full border-current border-t-transparent`}
      />
      {label && <span className="text-muted-foreground text-base">{label}</span>}
    </div>
  );
}

interface LoadingOverlayProps extends HTMLAttributes<HTMLDivElement> {
  isLoading: boolean;
  spinner?: React.ReactNode;
}

export function LoadingOverlay({
  isLoading,
  spinner,
  className = '',
  children,
  ...props
}: LoadingOverlayProps) {
  if (!isLoading) return <>{children}</>;

  return (
    <div className={`relative ${className}`} {...props}>
      <div className="bg-background/80 pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl backdrop-blur-sm">
        {spinner || <Spinner size="lg" />}
      </div>
      {children}
    </div>
  );
}
