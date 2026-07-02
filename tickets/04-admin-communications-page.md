# Implement Admin Communications page

## Status

Done — page, components, API routes, and service wrappers implemented.

## Description

SPEC §4.5 requires a broadcast composer with recipient selectors
(`ALL | HOUSEHOLD | INDIVIDUAL | NOT_RESPONDED`), a reasonable-hours
constraint (8 AM–9 PM local), and delivery logging. No implementation
exists today.

Build `/admin/communications` to:

- Compose rich-text + SMS message bodies.
- Pick recipient group via `RecipientSelector` component.
- Schedule send time or send immediately.
- Respect per-user `CommunicationPreference`.
- Honor "reasonable hours" — defer sends outside 8am–9pm.
- Show delivery status from `CommunicationLog`.

## Acceptance criteria

- Twilio (SMS) and SendGrid (email) clients wrapped in `src/lib/twilio.ts`
  and `src/lib/sendgrid.ts` (already in `.env.example`).
- `communication.sendBroadcast` and `communication.scheduleMessage` procedures.
- One-click unsubscribe links inside emails.
- Observability-only retry policy (per SPEC: no automatic retries).

## Files

- `src/app/admin/communications/page.tsx` (create)
- `src/server/routers/communication.ts` (create)
- `src/lib/twilio.ts` (create)
- `src/lib/sendgrid.ts` (create)
- `src/components/communication/BroadcastComposer.tsx` (create)
- `src/components/communication/RecipientSelector.tsx` (create)
- `src/components/communication/DeliveryStatus.tsx` (create)
