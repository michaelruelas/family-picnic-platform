'use client';

import { HTMLAttributes } from 'react';

interface SpinnerProps extends HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

const sizeClasses = {
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-2',
  lg: 'h-12 w-12 border-3',
};

export default function Spinner({
  size = 'md',
  label,
  className = '',
  ...props
}: SpinnerProps) {
  return (
    <div className={`flex items-center justify-center gap-2 ${className}`} {...props}>
      <span
        className={`${sizeClasses[size]} animate-spin rounded-full border-current border-t-transparent text-amber-600`}
      />
      {label && <span className="text-base text-stone-600">{label}</span>}
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
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm">
        {spinner || <Spinner size="lg" />}
      </div>
      {children}
    </div>
  );
}
