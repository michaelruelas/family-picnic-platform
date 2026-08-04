/**
 * Format a minor-unit amount (cents) as a currency string using the
 * ICU Intl API. Lives in its own module so call sites that only need
 * to render money don't drag the Stripe SDK (or any other lib) into
 * their bundles.
 */
export function formatAmount(cents: number, currency = 'usd'): string {
  const amount = cents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount);
}
