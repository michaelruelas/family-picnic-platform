import { vi, type Mock } from 'vitest';

export const FAR_FUTURE_EXPIRY = '2099-01-01';

/**
 * Returns the `json` function for the `next/server` polyfill. Use with:
 *   vi.mock('next/server', async (importOriginal) => {
 *     const actual = await importOriginal<typeof import('next/server')>();
 *     return { ...actual, NextResponse: { ...actual.NextResponse, json: nextResponseJson() } };
 *   });
 */
export function nextResponseJson() {
  return (body: unknown, init?: ResponseInit) =>
    new Response(JSON.stringify(body), {
      status: init?.status ?? 200,
      headers: {
        'content-type': 'application/json',
        ...(init?.headers as Record<string, string>),
      },
    });
}

/**
 * Returns a polyfilled `NextResponse.redirect` that emits a 302
 * Response with the supplied `Location` header. Tests that exercise
 * a redirect (e.g. `/api/public/event-attachments/[id]/download`)
 * need this in their `next/server` mock so the polyfilled
 * `NextResponse.json` does not erase the redirect.
 */
export function nextResponseRedirect() {
  return (url: string | URL, init?: ResponseInit) =>
    new Response(null, {
      status: init?.status ?? 302,
      headers: {
        location: typeof url === 'string' ? url : url.toString(),
        ...(init?.headers as Record<string, string>),
      },
    });
}

/**
 * Resets all mocks in a hoisted prisma mock. Use in beforeEach:
 *   beforeEach(() => resetPrismaMock(prismaMock));
 */
export function resetPrismaMock(prismaMock: object) {
  vi.clearAllMocks();
  for (const model of Object.values(prismaMock as Record<string, Record<string, unknown>>)) {
    for (const fn of Object.values(model)) {
      const mock = fn as Mock;
      if (typeof mock?.mockReset === 'function') mock.mockReset();
    }
  }
}

/**
 * Builds a Request. The URL can include query params (e.g. `?id=foo`).
 * Body is only set if provided. Defaults to POST; pass a method for
 * PATCH/DELETE/etc.
 */
export function makeJsonRequest(url: string, body?: unknown, method = 'POST'): Request {
  return new Request(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}
