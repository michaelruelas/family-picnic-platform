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
          <label htmlFor={inputId} className="block text-sm font-medium text-stone-700">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`mt-1 block w-full rounded-lg border bg-white px-3 py-2 text-lg text-stone-900 shadow-sm transition-colors duration-150 placeholder:text-stone-400 focus:ring-2 focus:ring-offset-0 focus:outline-none disabled:cursor-not-allowed disabled:bg-stone-50 disabled:text-stone-500 ${
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

Input.displayName = 'Input';

export default Input;
