import { NextResponse } from 'next/server';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import type { Session } from 'next-auth';
import { authOptions, isAdminRole } from './auth';

export type AdminApiAuth = { ok: true; session: Session };
export type AdminApiDenied = { ok: false; response: NextResponse };

const UNAUTHORIZED_RESPONSE = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
