'use client';

import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = '', id, ...props }, ref) => {
    const inputId = id || props.name;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="text-foreground mb-2 block text-sm font-medium">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`text-foreground placeholder:text-muted-foreground disabled:bg-muted disabled:text-muted-foreground block min-h-12 w-full rounded-2xl border bg-white px-4 py-3 text-lg transition-all duration-200 focus:ring-0 focus:outline-none disabled:cursor-not-allowed ${
            error
              ? 'border-destructive focus:border-destructive focus:shadow-[0_0_0_3px_rgba(196,69,54,0.15)]'
              : 'border-border focus:border-foreground focus:shadow-[0_0_0_3px_rgba(43,45,66,0.08)]'
          } ${className} `}
          {...props}
        />
        {hint && !error && <p className="text-muted-foreground mt-2 text-sm">{hint}</p>}
        {error && <p className="text-destructive mt-2 text-sm">{error}</p>}
      </div>
    );
  },
);

Input.displayName = 'Input';

export default Input;
