import { useCallback, useState } from 'react';
import type { ChangeEvent } from 'react';
import { countDigitsBefore, formatUsPhone, indexAfterDigits, toE164 } from '~/lib/phone-format';

export interface UsePhoneInputResult {
  /** Current display value, formatted as `+1 (xxx) xxx-xxxx`. */
  display: string;
  /** E.164 representation suitable for storage / API calls. */
  e164: string;
  /**
   * Change handler for a controlled `<input type="tel">`. Returns
   * the freshly-computed E.164 so the caller can react without
   * waiting for a re-render to read the new `e164` value.
   */
  onChange: (e: ChangeEvent<HTMLInputElement>) => string;
  /**
   * Programmatic reset. Useful when the parent swaps the sheet
   * open or refetches the underlying profile and the display value
   * needs to re-seed from the new E.164.
   */
  reset: (nextE164?: string) => void;
}

/**
 * US phone auto-formatter hook for controlled `<input>`s.
 *
 * The hook keeps two views of the same value: the formatted display
 * string the user sees in the field, and the E.164 string the
 * caller can hand to the API. Every keystroke is re-formatted on
 * the fly and the caret is restored to the same digit it was on
 * before, so deleting a digit from the middle never jumps the
 * cursor across the field.
 *
 * Cursor handling: the browser updates the DOM input first, then
 * fires `change`. We capture the caret position from the post-
 * keystroke `e.target.value`, count how many digits sit before it,
 * re-format, and restore the caret to the matching digit in the
 * new value via `requestAnimationFrame` so React commits the new
 * `value` prop before we touch the selection.
 */
export function usePhoneInput(initialE164: string = ''): UsePhoneInputResult {
  const [display, setDisplay] = useState<string>(() => formatUsPhone(initialE164));

  const onChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const input = e.target;
      const cursor = input.selectionStart ?? display.length;
      const rawValue = input.value;
      // The DOM value is the previously-formatted display plus the
      // new character. The "+1" country-code prefix is part of the
      // format, not user input, so subtract it from the digit count
      // before re-pinning the caret to the same user-typed digit.
      const hasPrefix = rawValue.startsWith('+1');
      const digitsBeforeCursor = countDigitsBefore(rawValue, cursor);
      const userTypedDigits = digitsBeforeCursor - (hasPrefix ? 1 : 0);
      const formatted = formatUsPhone(rawValue);
      setDisplay(formatted);
      if (typeof window !== 'undefined') {
        // Defer until React commits the new `value` prop, otherwise the
        // browser resets the selection to the end of the string.
        window.requestAnimationFrame(() => {
          // The formatted string always starts with "+1", so the
          // Nth user-typed digit is the (N+1)th digit overall.
          const next = indexAfterDigits(formatted, userTypedDigits + 1);
          try {
            input.setSelectionRange(next, next);
          } catch {
            // Some browsers throw if the input is no longer focused;
            // safe to ignore — the cursor will land at the end on
            // next interaction.
          }
        });
      }
      // Return the E.164 derived from the *just-typed* value so the
      // caller's `onE164Change` (and any synchronous diff against the
      // snapshot) sees the post-keystroke state without waiting for
      // React to re-render.
      return toE164(formatted);
    },
    [display.length],
  );

  const reset = useCallback((nextE164: string = '') => {
    setDisplay(formatUsPhone(nextE164));
  }, []);

  return {
    display,
    e164: toE164(display),
    onChange,
    reset,
  };
}
