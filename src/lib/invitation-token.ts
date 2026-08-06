export function generateInvitationToken(): string {
  const timestamp = Date.now();
  const timestampHex = timestamp.toString(16).padStart(12, '0');
  const randomHex = Array.from({ length: 20 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join('');
  return `${timestampHex}-${randomHex}`.toUpperCase();
}

export function getInvitationExpiry(days: number = 30): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

/**
 * FPP-88: build the wizard landing page URL the recipient clicks
 * from the invitation email/SMS.
 *
 * FPP-88 review: previously fell back to `http://localhost:3000`
 * silently. In production a misconfigured NEXTAUTH_URL would
 * produce a broken link for every recipient without any signal.
 * We now throw in non-test environments. The unit test suite
 * sets `NODE_ENV=test` (or the test sets `NEXTAUTH_URL` directly)
 * to keep exercising the fallback path.
 */
export function buildInvitationUrl(token: string): string {
  const base = process.env.NEXTAUTH_URL;
  if (!base) {
    if (process.env.NODE_ENV === 'test') {
      return `http://localhost:3000/events/invitation/${token}`;
    }
    throw new Error(
      'NEXTAUTH_URL is not set. Set it to the public app URL so invitation links work. ' +
        '(NODE_ENV=test still falls back to http://localhost:3000 for unit tests.)',
    );
  }
  return `${base.replace(/\/$/, '')}/events/invitation/${token}`;
}
