'use client';

import { ButtonHTMLAttributes, forwardRef } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'sage';
type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  pill?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-terracotta text-white hover:bg-[#cf6c52] focus:ring-terracotta shadow-soft',
  sage: 'bg-sage text-sage-foreground hover:bg-[#6fa18a] focus:ring-sage shadow-soft',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-[#e8e1d2] focus:ring-secondary',
  outline:
    'bg-transparent text-foreground border border-border hover:border-foreground focus:ring-foreground',
  danger: 'bg-destructive text-destructive-foreground hover:bg-[#a83a2d] focus:ring-destructive',
  ghost:
    'bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground focus:ring-secondary',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-5 py-2.5 text-base',
  lg: 'px-6 py-3 text-lg min-h-12',
  xl: 'px-8 py-3.5 text-lg min-h-14',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading,
      pill = true,
      className = '',
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`focus:ring-offset-background inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${sizeClasses[size]} ${pill ? 'rounded-pill' : 'rounded-xl'} press ${className} `}
        {...props}
      >
        {isLoading && (
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        )}
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';

export default Button;
