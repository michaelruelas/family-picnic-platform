// Domains for known third-party email relays. Emails at these domains
// are aliases — they forward to a hidden destination the user controls,
// so inbound mail sent to them is not deliverable in the normal sense
// and the user can rotate the alias at any time.
//
// Apple's "Hide My Email" (https://support.apple.com/en-us/HT210425)
// issues addresses under @privaterelay.appleid.com. FastMail's masked
// email feature uses a sub-address pattern on the user's own domain
// rather than a fixed relay domain, so it is not on this list.
export const RELAY_EMAIL_DOMAINS = ['privaterelay.appleid.com'] as const;

export function isRelayEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const at = email.lastIndexOf('@');
  if (at === -1) return false;
  const domain = email
    .slice(at + 1)
    .trim()
    .toLowerCase();
  if (!domain) return false;
  return (RELAY_EMAIL_DOMAINS as readonly string[]).includes(domain);
}
