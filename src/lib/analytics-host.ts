export function isTrackingAllowed(hostname: string | null | undefined): boolean {
  if (!hostname) return false;
  const host = hostname.toLowerCase().split(':')[0] ?? '';
  return !isLocalHost(host);
}

export function isLocalHost(hostname: string): boolean {
  if (hostname === 'localhost') return true;
  if (hostname === '127.0.0.1') return true;
  if (hostname === '0.0.0.0') return true;
  if (hostname === '::1') return true;
  if (hostname.endsWith('.localhost')) return true;
  if (hostname.endsWith('.local')) return true;
  return false;
}
