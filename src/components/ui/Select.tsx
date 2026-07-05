'use client';

import { SelectHTMLAttributes, forwardRef } from 'react';

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: SelectOption[];
  placeholder?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, options, placeholder, className = '', id, ...props }, ref) => {
    const selectId = id || props.name;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={selectId} className="text-foreground mb-2 block text-sm font-medium">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={`text-foreground disabled:bg-muted disabled:text-muted-foreground block min-h-12 w-full rounded-2xl border bg-white px-4 py-3 text-base transition-all duration-200 focus:ring-0 focus:outline-none disabled:cursor-not-allowed ${
            error
              ? 'border-destructive focus:border-destructive focus:shadow-[0_0_0_3px_rgba(196,69,54,0.15)]'
              : 'border-border focus:border-foreground focus:shadow-[0_0_0_3px_rgba(43,45,66,0.08)]'
          } ${className} `}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        {hint && !error && <p className="text-muted-foreground mt-2 text-sm">{hint}</p>}
        {error && <p className="text-destructive mt-2 text-sm">{error}</p>}
      </div>
    );
  },
);

Select.displayName = 'Select';

export default Select;
