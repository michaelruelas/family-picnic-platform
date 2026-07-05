'use client';

import { TextareaHTMLAttributes, forwardRef } from 'react';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className = '', id, ...props }, ref) => {
    const textareaId = id || props.name;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={textareaId} className="text-foreground mb-2 block text-sm font-medium">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={`text-foreground placeholder:text-muted-foreground disabled:bg-muted disabled:text-muted-foreground block min-h-[80px] w-full resize-y rounded-2xl border bg-white px-4 py-3 text-base transition-all duration-200 focus:ring-0 focus:outline-none disabled:cursor-not-allowed ${
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

Textarea.displayName = 'Textarea';

export default Textarea;
