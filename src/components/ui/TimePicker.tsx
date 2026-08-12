'use client';

import { forwardRef, useId } from 'react';

export interface TimePickerProps {
  /** Field label rendered above the input and linked via `htmlFor`. */
  label?: string;
  /** Helper text shown below the input when there is no error. */
  hint?: string;
  /** Validation message. When set, replaces the hint and styles the input red. */
  error?: string;
  /** Current value in `HH:MM` form (the native time shape). */
  value?: string;
  /** Called with the new `HH:MM` value (or `''` when cleared). */
  onChange?: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  /** Native input `name`. Also used to derive the input `id` when `id` is missing. */
  name?: string;
  id?: string;
  className?: string;
  /** `step` attribute, defaults to 60 (minute granularity). */
  step?: number;
  /** Minimum allowed time in `HH:MM` form. */
  min?: string;
  /** Maximum allowed time in `HH:MM` form. */
  max?: string;
  /** Test hook forwarded to the underlying `<input>`. */
  'data-testid'?: string;
}

const baseClasses =
  'text-foreground placeholder:text-muted-foreground disabled:bg-muted disabled:text-muted-foreground ' +
  'block min-h-12 w-full rounded-pill border bg-white px-4 py-3 text-base transition-all duration-200 ' +
  'focus:ring-0 focus:outline-none disabled:cursor-not-allowed';

const stateClasses = (error?: string) =>
  error
    ? 'border-destructive focus:border-destructive focus:shadow-[0_0_0_3px_rgba(196,69,54,0.15)]'
    : 'border-border focus:border-foreground focus:shadow-[0_0_0_3px_rgba(43,45,66,0.08)]';

/**
 * Accessible time picker used by the itinerary editor and any other
 * wall-clock field. Wraps the native `<input type="time">` for the same
 * reasons as `DateTimePicker`: OS-native picker on mobile, native
 * keyboard nav, and native screen-reader announcements. Applies the
 * QUB-6 pill theme + 48px tap target on top.
 *
 * FPP-62: the itinerary editor (QUB-31.2) was the second consumer
 * called out in the ticket. It only needs a wall-clock time (no date),
 * so this is the matching primitive.
 */
const TimePicker = forwardRef<HTMLInputElement, TimePickerProps>(function TimePicker(
  {
    label,
    hint,
    error,
    value,
    onChange,
    required,
    disabled,
    name,
    id,
    className = '',
    step = 60,
    min,
    max,
    'data-testid': dataTestId,
  },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? name ?? `t-${generatedId}`;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="text-foreground mb-2 block text-sm font-medium">
          {label}
          {required && (
            <span className="text-destructive ml-1" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        name={name}
        type="time"
        value={value ?? ''}
        onChange={(e) => onChange?.(e.target.value)}
        step={step}
        min={min || undefined}
        max={max || undefined}
        required={required}
        disabled={disabled}
        aria-required={required || undefined}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy}
        data-testid={dataTestId}
        className={`${baseClasses} ${stateClasses(error)} ${className}`}
      />
      {hint && !error && (
        <p id={hintId} className="text-muted-foreground mt-2 text-sm">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-destructive mt-2 text-sm" role="alert">
          {error}
        </p>
      )}
    </div>
  );
});

export default TimePicker;
