'use client';

import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';
import { usePhoneInput } from '~/hooks/usePhoneInput';

export interface PhoneInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type' | 'ref'
> {
  /**
   * Initial value in E.164 format (e.g. `+15551234567`). Used to
   * seed the display state on mount or when the parent wants to
   * reset the field to a server-provided value.
   */
  initialE164?: string;
  /**
   * Fired whenever the formatted E.164 changes (i.e. on every
   * keystroke after formatting). The parent uses this to feed the
   * value into Zod validators / diff helpers that expect the
   * canonical E.164 shape rather than the display string.
   */
  onE164Change?: (e164: string) => void;
}

/**
 * US phone auto-formatted input. Wraps `<input type="tel">` with
 * the `+1 (xxx) xxx-xxxx` formatter from `~/hooks/usePhoneInput` so
 * the field formats digits as the user types and reports the
 * matching E.164 value to the parent for persistence.
 *
 * Drop-in replacement for the manual `<input type="tel">` that
 * previously lived in the RSVP sheet and admin user editor; both
 * call sites now share the same format, validation, and cursor
 * behaviour.
 */
export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(function PhoneInput(
  { initialE164, onE164Change, ...rest },
  ref,
) {
  const phone = usePhoneInput(initialE164 ?? '');
  return (
    <input
      ref={ref}
      type="tel"
      value={phone.display}
      onChange={(e) => {
        // The hook returns the post-keystroke E.164 synchronously
        // so the caller does not have to wait for the re-render
        // to read `phone.e164` (which still reflects the previous
        // display value at this point).
        const nextE164 = phone.onChange(e);
        onE164Change?.(nextE164);
      }}
      {...rest}
    />
  );
});
