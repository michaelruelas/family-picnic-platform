# ADR-012: Stripe Hosted Payment Element for PCI-Safe Charges

## Status

Accepted

## Context

The picnic needs to charge a per-attendee fee for some events. The
team had to pick a provider (FPP-69 chose Stripe over Square based on US
fee structure, hosted Payment Element coverage of Apple/Google Pay,
refund/dispute tooling, and integration speed) and a PCI-safe charge
flow. PCI compliance is non-negotiable: any code that handles raw PAN
data inherits the heaviest PCI-DSS obligations.

## Decision

Use Stripe's hosted Payment Element. Card data goes directly from the
browser to Stripe over a TLS connection; our Next.js servers only ever
see PaymentIntent ids and webhook events. We do not proxy or render a
custom card form.

- Per-event `registrationFeeCents` field on `Event` (optional; null/0
  means registration is free and no Stripe flow is shown).
- `Registration`, `Charge`, `Refund` Prisma models. Amounts stored as
  integer cents in the smallest currency unit.
- The Stripe `idempotencyKey` on every `paymentIntents.create` and
  `refunds.create` call is the local row id, so retries and double-clicks
  return the same Stripe object without producing duplicates.
- Webhook handler verifies signatures with
  `stripe.webhooks.constructEventAsync` on the raw request body, then
  dispatches to per-event-type handlers that update local state, send
  the receipt email, and write an `AdminAuditLog` entry.
- Receipt email is sent once on `payment_intent.succeeded`. Failure to
  send does not fail the webhook — the admin can resend from
  `/admin/charges`.
- Admin refund path: `admin.refund` accepts an optional `amountCents`.
  Full refund moves the Registration to `REFUNDED`. Partial refunds keep
  it `PAID` and bump `refundedCents`. Each refund writes an audit entry.
- Forfeit path: `admin.forfeit` marks a paid registration closed
  without returning money (no-show, last-minute cancel). No Stripe
  call. Writes an audit entry.
- Out-of-band refunds (admin uses the Stripe dashboard directly) fire
  `charge.refunded` and the webhook reconciles local state so the admin
  UI never drifts from reality.

## Consequences

- **PCI scope is minimal.** We never touch card data; Stripe's PCI-DSS
  AOC covers the card capture path. We are responsible only for the
  webhook handler and the keys we store.
- **Stripe is a hard dependency for paid events.** If Stripe is down
  or misconfigured, the checkout page shows a "payments not configured"
  error and refunds fail. Free events are unaffected.
- **Idempotency on `event.id` is not implemented at the webhook
  layer.** Stripe already retries failed webhook deliveries, and the
  handlers are mostly idempotent on `stripePaymentIntentId` lookups.
  A small window exists where a duplicate delivery could write two
  audit entries; not worth a Redis lock for the picnic's scale.
- **Currency is hard-coded to USD.** The schema carries a `currency`
  column for forward-compatibility, but no multi-currency UI exists.
- **No Apple Pay / Google Pay button on top of the Payment Element.**
  Stripe's Payment Element renders these wallets when the customer's
  device supports them; we did not add a separate "buy with Apple Pay"
  button.
