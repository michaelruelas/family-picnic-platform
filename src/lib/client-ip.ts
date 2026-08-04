export type ClientIpResult = { ip: string | null };

/**
 * Resolves the originating client IP from request headers, trusting only
 * forwarded headers when the rightmost proxy in the chain matches the
 * supplied allowlist. When the allowlist is empty (the default), no proxy
 * headers are trusted and this returns null.
 *
 * Algorithm (standard "rightmost-untrusted" parse):
 *   - Split `x-forwarded-for` on commas.
 *   - Walk from the rightmost entry backwards.
 *   - Return the first IP that is NOT in `trustedProxyIps`.
 *   - If everything is trusted (or the header is missing), fall back to
 *     `x-real-ip` only when the allowlist is non-empty.
 *   - Otherwise return null.
 *
 * IPv4 exact-match only for v1; CIDR support is tracked as a follow-up.
 */
export function extractClientIp(
  headers: Pick<Headers, 'get'>,
  trustedProxyIps: readonly string[] = [],
): ClientIpResult {
  if (trustedProxyIps.length === 0) {
    return { ip: null };
  }

  const trusted = new Set(trustedProxyIps);

  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const chain = forwarded
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    for (let i = chain.length - 1; i >= 0; i--) {
      const candidate = chain[i];
      if (!candidate) continue;
      if (!trusted.has(candidate)) {
        return { ip: candidate };
      }
    }
  }

  const real = headers.get('x-real-ip');
  if (real) {
    const trimmed = real.trim();
    if (trimmed) return { ip: trimmed };
  }

  return { ip: null };
}

export function parseTrustedProxyIps(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
