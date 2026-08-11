import { NextResponse } from 'next/server';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import type { Session } from 'next-auth';
import { authOptions, isAdminRole } from './auth';
import { canAccessEvent } from './event-access';

export type AdminApiAuth = { ok: true; session: Session };
export type AdminApiDenied = { ok: false; response: NextResponse };

const UNAUTHORIZED_RESPONSE = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
const FORBIDDEN_RESPONSE = NextResponse.json({ error: 'Forbidden' }, { status: 403 });

/**
 * For API routes: returns either `{ ok: true, session }` if the caller is an
 * admin, or `{ ok: false, response }` (a 401 NextResponse) if not. Caller
 * pattern:
 *
 *   const auth = await requireAdminApi();
 *   if (!auth.ok) return auth.response;
 *   const { session } = auth;
 *
 * A tagged union is used (instead of `instanceof NextResponse`) so the auth
 * check works under tests that mock `next/server`.
 */
export async function requireAdminApi(): Promise<AdminApiAuth | AdminApiDenied> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isAdminRole(session.user.role)) {
    return { ok: false, response: UNAUTHORIZED_RESPONSE };
  }
  return { ok: true, session };
}

/**
 * FPP-104: returns `{ ok: true, session }` when the caller has any
 * authenticated session, or `{ ok: false, response }` (a 401
 * NextResponse) when the caller is unauthenticated. No role check.
 *
 * Use this at the top of a route that needs to look up a sub-resource
 * (e.g. a slot id) before it can run a per-event auth gate. Without
 * this helper, the sub-resource lookup runs first and a missing
 * session + missing slot returns 404 — leaking the slot's existence
 * to unauthenticated callers. Calling `requireSessionApi` first
 * returns 401 before any DB read, so the leak is closed.
 *
 * Pass the returned `session` to `requireEventAdminApi` via the
 * `preloadedSession` option to avoid a second `getServerSession`
 * call.
 */
export async function requireSessionApi(): Promise<AdminApiAuth | AdminApiDenied> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { ok: false, response: UNAUTHORIZED_RESPONSE };
  }
  return { ok: true, session };
}

/**
 * For admin pages: returns the session if the caller is an admin, or redirects
 * to the home page if not.
 */
export async function requireAdminPage(): Promise<Session> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isAdminRole(session.user.role)) {
    redirect('/');
  }
  return session;
}

/**
 * FPP-65 / QUB-13.1: per-event-scoped admin guard for REST routes.
 *
 * Allows the caller through if EITHER:
 *   - they pass `isAdminRole(...)` (platform-level super-admin or
 *     adult-family user), OR
 *   - they have an EventAdmin row for `eventId` (host, co-admin, or
 *     inviter — `canAccessEvent` short-circuits super-admins too).
 *
 * Returns 401 on missing session and 403 on a session that lacks
 * either the admin role or the per-event EventAdmin row. Use this
 * for `/api/admin/events/[id]/admins` and any future per-event
 * admin surface that hosts need to access.
 */
export async function requireEventAdminApi(
  eventId: string,
  opts?: { preloadedSession?: Session },
): Promise<AdminApiAuth | AdminApiDenied> {
  const session = opts?.preloadedSession ?? (await getServerSession(authOptions));
  if (!session?.user?.id) {
    return { ok: false, response: UNAUTHORIZED_RESPONSE };
  }
  if (isAdminRole(session.user.role)) {
    return { ok: true, session };
  }
  const allowed = await canAccessEvent(session, eventId);
  if (!allowed) {
    return { ok: false, response: FORBIDDEN_RESPONSE };
  }
  return { ok: true, session };
}

/**
 * FPP-65 / QUB-13.1: per-event-scoped admin guard for page routes.
 * Mirrors `requireEventAdminApi` but redirects to the home page on
 * denial instead of returning a 401/403 JSON response. Use this for
 * pages like `/admin/events/[id]/edit/admins` that hosts need to be
 * able to reach for events they have an EventAdmin row for.
 */
export async function requireEventAdminPage(eventId: string): Promise<Session> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/');
  if (isAdminRole(session.user.role)) return session;
  const allowed = await canAccessEvent(session, eventId);
  if (!allowed) redirect('/');
  return session;
}
