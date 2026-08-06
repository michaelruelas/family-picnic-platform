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
 * from the invitation email/SMS. Falls back to localhost in
 * dev when NEXTAUTH_URL is unset so unit tests that exercise
 * the helper directly still produce a usable string.
 */
export function buildInvitationUrl(token: string): string {
  const base = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}/events/invitation/${token}`;
}
