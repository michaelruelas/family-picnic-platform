'use client';

import { HTMLAttributes, forwardRef } from 'react';

type CardVariant = 'default' | 'success' | 'warning' | 'error' | 'muted' | 'sunlight' | 'sage';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  hover?: boolean;
}

const variantClasses: Record<CardVariant, string> = {
  default: 'bg-card text-card-foreground ring-1 ring-border/60 shadow-card',
  success: 'bg-sage/10 text-foreground ring-1 ring-sage/30',
  warning: 'bg-sunlight/20 text-foreground ring-1 ring-sunlight/40',
  error: 'bg-destructive/10 text-foreground ring-1 ring-destructive/30',
  muted: 'bg-secondary text-foreground',
  sunlight: 'bg-sunlight/20 text-foreground',
  sage: 'bg-sage/15 text-foreground ring-1 ring-sage/30',
};

const paddingClasses: Record<'none' | 'sm' | 'md' | 'lg' | 'xl', string> = {
  none: '',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-7',
  xl: 'p-9',
};

const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    { variant = 'default', padding = 'md', hover = false, className = '', children, ...props },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        className={`rounded-2xl ${variantClasses[variant]} ${paddingClasses[padding]} ${hover ? 'hover-lift' : ''} ${className} `}
        {...props}
      >
        {children}
      </div>
    );
  },
);

Card.displayName = 'Card';

interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {}

const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div ref={ref} className={`flex items-center justify-between ${className}`} {...props}>
        {children}
      </div>
    );
  },
);

CardHeader.displayName = 'CardHeader';

interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {}

const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <h3
        ref={ref}
        className={`font-display text-foreground text-xl font-semibold ${className}`}
        {...props}
      >
        {children}
      </h3>
    );
  },
);

CardTitle.displayName = 'CardTitle';

interface CardContentProps extends HTMLAttributes<HTMLDivElement> {}

const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div ref={ref} className={`mt-4 ${className}`} {...props}>
        {children}
      </div>
    );
  },
);

CardContent.displayName = 'CardContent';

interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {}

const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div ref={ref} className={`mt-4 flex items-center gap-3 ${className}`} {...props}>
        {children}
      </div>
    );
  },
);

CardFooter.displayName = 'CardFooter';

export { CardHeader, CardTitle, CardContent, CardFooter };
export default Card;
