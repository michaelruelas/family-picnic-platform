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
          <label htmlFor={textareaId} className="block text-sm font-medium text-stone-700">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={`mt-1 block min-h-[80px] w-full resize-y rounded-lg border bg-white px-3 py-2 text-lg text-stone-900 shadow-sm transition-colors duration-150 placeholder:text-stone-400 focus:ring-2 focus:ring-offset-0 focus:outline-none disabled:cursor-not-allowed disabled:bg-stone-50 disabled:text-stone-500 ${
            error
              ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
              : 'border-stone-300 focus:border-amber-500 focus:ring-amber-500'
          } ${className} `}
          {...props}
        />
        {hint && !error && <p className="mt-1 text-sm text-stone-500">{hint}</p>}
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>
    );
  },
);

Textarea.displayName = 'Textarea';

export default Textarea;
