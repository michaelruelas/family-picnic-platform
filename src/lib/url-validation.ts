import { NextResponse } from 'next/server';

/**
 * FPP-60: trust-boundary URL check used by the admin REST event
 * routes. `new URL()` accepts `javascript:` and other dangerous
 * schemes, so the helper additionally enforces an http(s) protocol.
 * The Zod schemas enforce the same rule via `.string().url()` but
 * are only consulted by the client form, so REST routes that bypass
 * the form layer must re-validate at the boundary.
 *
 * Returns a 400 `NextResponse` on failure, or `null` when the value
 * is acceptable. Empty string is treated as "no value" and never
 * reaches this helper (callers short-circuit on `=== ''`).
 */
export function assertHttpUrl(value: string, fieldName: string): NextResponse | null {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return NextResponse.json({ error: `${fieldName} must be a valid URL` }, { status: 400 });
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return NextResponse.json({ error: `${fieldName} must be an http(s) URL` }, { status: 400 });
  }
  return null;
}
