/**
 * Shared class strings for the pill-themed form-field primitives
 * (`DateTimePicker`, `TimePicker`, and any future picker that follows
 * the QUB-6 token set).
 *
 * FPP-62 follow-ups (F1, F2):
 *   - F1: two primitives duplicated `baseClasses` + `stateClasses`.
 *     A third primitive would copy them a third time, so this is the
 *     single source of truth.
 *   - F2: the focus-ring rgba values were opaque literals inside each
 *     picker. Hoisting them to named constants makes the link to the
 *     theme visible and turns a future theme tweak into one edit.
 *
 * The values match what `Input.tsx` and `Select.tsx` already use, so
 * the field look stays consistent across the existing primitives.
 * The background uses `bg-card` so the field stays legible in dark
 * mode, matching the FPP-44 dark-panel rule.
 */

export const FOCUS_RING_DEFAULT = 'focus:shadow-[0_0_0_3px_rgba(2,132,199,0.15)]';
export const FOCUS_RING_DESTRUCTIVE = 'focus:shadow-[0_0_0_3px_rgba(239,68,68,0.18)]';

export const fieldBaseClasses =
  'text-foreground placeholder:text-muted-foreground disabled:bg-muted disabled:text-muted-foreground ' +
  'block min-h-12 w-full rounded-sm border bg-card px-4 py-3 text-base transition-all duration-200 ' +
  'focus:ring-0 focus:outline-none disabled:cursor-not-allowed';

export function fieldStateClasses(error?: string): string {
  return error
    ? `border-destructive focus:border-destructive ${FOCUS_RING_DESTRUCTIVE}`
    : `border-border focus:border-foreground ${FOCUS_RING_DEFAULT}`;
}
