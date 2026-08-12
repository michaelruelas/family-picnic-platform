'use client';

import { forwardRef, useId, useState } from 'react';
import { formatTimezoneLabel, getClientTimezone } from '~/lib/timezone';
import { fieldBaseClasses, fieldStateClasses } from './fieldStyles';

export interface DateTimePickerProps {
  /** Field label rendered above the input and linked via `htmlFor`. */
  label?: string;
  /** Helper text shown below the input when there is no error. */
  hint?: string;
  /** Validation message. When set, replaces the hint and styles the input red. */
  error?: string;
  /** Current value in `YYYY-MM-DDTHH:MM` form (the native datetime-local shape). */
  value?: string;
  /** Called with the new `YYYY-MM-DDTHH:MM` value (or `''` when cleared). */
  onChange?: (value: string) => void;
  /** Minimum allowed instant in `YYYY-MM-DDTHH:MM` form. Empty string disables. */
  min?: string;
  /** Maximum allowed instant in `YYYY-MM-DDTHH:MM` form. Empty string disables. */
  max?: string;
  /** Required attribute; the visible `*` mirrors `aria-required`. */
  required?: boolean;
  disabled?: boolean;
  /** Native input `name`. Also used to derive the input `id` when `id` is missing. */
  name?: string;
  id?: string;
  className?: string;
  /** Show the resolved timezone next to the picker. Default `true`. */
  showTimezone?: boolean;
  /** Override the auto-resolved timezone (e.g. when an event pins a TZ). */
  timezone?: string;
  /** `step` attribute, defaults to 60 (minute granularity). */
  step?: number;
  /** Test hook forwarded to the underlying `<input>`. */
  'data-testid'?: string;
}

/**
 * Accessible datetime picker used by the event admin form and any other
 * spot that needs a date+time edit. Wraps the native `<input
 * type="datetime-local">` so we get:
 *  - the OS-native picker on mobile (spinning wheels) without shipping
 *    a JS calendar library;
 *  - full keyboard support that the platform already wires up (arrow
 *    keys step the field, PageUp/PageDown jump by month, Enter
 *    commits);
 *  - the screen-reader announcements the browser already makes for
 *    `min`/`max` constraints.
 *
 * FPP-62 adds the theme polish on top of the native control:
 *  - pill-shaped, 48px minimum tap target;
 *  - visible timezone label so the admin always knows which wall clock
 *    they are editing in;
 *  - `aria-required`, `aria-invalid`, and `aria-describedby` wiring for
 *    assistive tech.
 */
const DateTimePicker = forwardRef<HTMLInputElement, DateTimePickerProps>(function DateTimePicker(
  {
    label,
    hint,
    error,
    value,
    onChange,
    min,
    max,
    required,
    disabled,
    name,
    id,
    className = '',
    showTimezone = true,
    timezone,
    step = 60,
    'data-testid': dataTestId,
  },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? name ?? `dt-${generatedId}`;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  // FPP-62 follow-up (DP-1): resolve the timezone on first render
  // instead of in a useEffect, so the label appears with the rest of
  // the form on the first paint and never flashes in after hydration.
  // The lazy initializer runs on the server too, where `getClientTimezone`
  // may return a different value than the browser. We tolerate the
  // mismatch via `suppressHydrationWarning` on the label below; the
  // visible text on the client always reflects the user's actual zone.
  const [resolvedTz] = useState<string | undefined>(() => timezone ?? getClientTimezone());

  const tzLabel = formatTimezoneLabel(resolvedTz);

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
        type="datetime-local"
        value={value ?? ''}
        onChange={(e) => onChange?.(e.target.value)}
        min={min || undefined}
        max={max || undefined}
        step={step}
        required={required}
        disabled={disabled}
        aria-required={required || undefined}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy}
        data-testid={dataTestId}
        className={`${fieldBaseClasses} ${fieldStateClasses(error)} ${className}`}
      />
      {showTimezone && tzLabel && (
        // FPP-62 follow-up (Q1): the resolved timezone does not change
        // for the lifetime of this component, so a live region is the
        // wrong semantic. A plain paragraph lets the screen reader
        // announce the line when the user navigates to it.
        // FPP-62 follow-up (DP-1): `suppressHydrationWarning` keeps the
        // dev console quiet when the server-side initial render and
        // the first client render compute different timezone values.
        <p
          className="text-muted-foreground mt-2 flex items-center gap-1.5 text-sm"
          suppressHydrationWarning
        >
          <span aria-hidden="true">🌐</span>
          <span>
            Time zone: <span className="text-foreground font-medium">{tzLabel}</span>
          </span>
        </p>
      )}
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

export default DateTimePicker;
