# Changelog

All notable changes to this project are documented here.

## [0.1.13](https://github.com/michaelruelas/family-picnic-platform/compare/family-picnic-platform-v0.1.12...family-picnic-platform-v0.1.13) (2026-08-08)

### Features

- Add comprehensive event management with RSVP, potluck signups, and photo galleries ([#2](https://github.com/michaelruelas/family-picnic-platform/issues/2)) ([e1220e8](https://github.com/michaelruelas/family-picnic-platform/commit/e1220e84f20be4b1d473d3aa7deb186fd67298b8))
- add Docker build for tag-based releases ([c3f5f52](https://github.com/michaelruelas/family-picnic-platform/commit/c3f5f524dfe84c2e373682ce545561a290910ba0))
- **admin:** redesign admin UI to table-first (FPP-91) ([#56](https://github.com/michaelruelas/family-picnic-platform/issues/56)) ([4c9ebf9](https://github.com/michaelruelas/family-picnic-platform/commit/4c9ebf956aee376a5e4862cd789bc096d012b446))
- **audit-log:** surface event registrations on the audit log (FPP-50) ([#55](https://github.com/michaelruelas/family-picnic-platform/issues/55)) ([69b7543](https://github.com/michaelruelas/family-picnic-platform/commit/69b7543f36634140ff575bc9a9278438e0e09204))
- **auth:** add Apple and Facebook OAuth with LinkedIdentity lookup ([#57](https://github.com/michaelruelas/family-picnic-platform/issues/57)) ([009a173](https://github.com/michaelruelas/family-picnic-platform/commit/009a1739bd561f1b8e51628d8a62705bc3c42f70))
- Complete MVP implementation of Family Picnic Platform ([#3](https://github.com/michaelruelas/family-picnic-platform/issues/3)) ([790dfc4](https://github.com/michaelruelas/family-picnic-platform/commit/790dfc4e3c1917c72ff6f7cdecf4b7e9d49a2f0a))
- **events:** add sub-nav and per-event photos route ([e93c5ad](https://github.com/michaelruelas/family-picnic-platform/commit/e93c5ad6bf517b1e7f84be37b70d30cfce4ca477))
- **events:** add sub-nav and per-event photos route ([1a52637](https://github.com/michaelruelas/family-picnic-platform/commit/1a5263768b8983222a2560902d95adce8f69b0e1))
- **events:** convert overview page to tabbed layout per FPP-46 ([#54](https://github.com/michaelruelas/family-picnic-platform/issues/54)) ([7207bc2](https://github.com/michaelruelas/family-picnic-platform/commit/7207bc2063340e48069bdae1caa0e8906680b8db))
- **household:** add household member CRUD for name and age ([#22](https://github.com/michaelruelas/family-picnic-platform/issues/22)) ([d0dce05](https://github.com/michaelruelas/family-picnic-platform/commit/d0dce052b7c8654d7e162ad40c3959fb401759b7))
- **kubernetes:** restructure manifests for argocd deployment ([a5a5ade](https://github.com/michaelruelas/family-picnic-platform/commit/a5a5adedb032e0eb70d02000c4b976b3f2f82760))
- **payments:** integrate stripe credit card processing (FPP-47) ([#26](https://github.com/michaelruelas/family-picnic-platform/issues/26)) ([2ff13a5](https://github.com/michaelruelas/family-picnic-platform/commit/2ff13a5b55e3eae402296a91ec166d93d10bbf4f))
- **potluck:** add multi-slot signup with my-slots view (FPP-52) ([#33](https://github.com/michaelruelas/family-picnic-platform/issues/33)) ([3372105](https://github.com/michaelruelas/family-picnic-platform/commit/33721054509232fe5fe0e8d2221ae2d3b02a86ab))
- **potluck:** make slot name optional per FPP-54 ([#48](https://github.com/michaelruelas/family-picnic-platform/issues/48)) ([4afd206](https://github.com/michaelruelas/family-picnic-platform/commit/4afd206992443ca3fe1ff24bdd30e405f18b84b9))
- **routes:** 301 legacy /potluck to event-scoped url ([9607378](https://github.com/michaelruelas/family-picnic-platform/commit/9607378ea341c36c6502403f80c1ba71e1a02927))
- **rsvp:** add dishes tab to rsvp sheet for potluck edits ([389c5f0](https://github.com/michaelruelas/family-picnic-platform/commit/389c5f09726bfdd2d78e32fdac80abcb8c6cab44))
- **rsvp:** add dishes tab to rsvp sheet for potluck edits ([9497373](https://github.com/michaelruelas/family-picnic-platform/commit/949737354edb832a9009e55ca801eaaaf714645b))
- **rsvp:** add household name edit to registration form (FPP-80) ([#30](https://github.com/michaelruelas/family-picnic-platform/issues/30)) ([983591d](https://github.com/michaelruelas/family-picnic-platform/commit/983591dd2b9f5715be56862b0b4c0ef04d3f2f46))
- **rsvp:** add idempotent backfill script for duplicate rsvps (FPP-28) ([#25](https://github.com/michaelruelas/family-picnic-platform/issues/25)) ([7d059a1](https://github.com/michaelruelas/family-picnic-platform/commit/7d059a176f0ca396166fa4bd91d27c8afe98a7a2))
- **rsvp:** add invitation-token RSVP wizard ([#52](https://github.com/michaelruelas/family-picnic-platform/issues/52)) ([1773604](https://github.com/michaelruelas/family-picnic-platform/commit/1773604db228bed6534c0779ffb3b01d1b6d8d17))
- **rsvp:** add names, decline path, and phone capture to rsvp ([#45](https://github.com/michaelruelas/family-picnic-platform/issues/45)) ([b018d27](https://github.com/michaelruelas/family-picnic-platform/commit/b018d27c831150d6318bd1f86b2ce2f86f731727))
- **rsvp:** add per-attendee registration fee with admin backfill (FPP-48) ([#28](https://github.com/michaelruelas/family-picnic-platform/issues/28)) ([bcda9dc](https://github.com/michaelruelas/family-picnic-platform/commit/bcda9dcda7007cae888ab659b1a8fabe192e8806))
- **rsvp:** add per-member attendance and registration confirmation (FPP-56) ([#27](https://github.com/michaelruelas/family-picnic-platform/issues/27)) ([bde0f80](https://github.com/michaelruelas/family-picnic-platform/commit/bde0f80f1346dc41fe720f915ff4c7e6e2c53737))
- **rsvp:** assign names to adult and child slots ([#39](https://github.com/michaelruelas/family-picnic-platform/issues/39)) ([fae5f1f](https://github.com/michaelruelas/family-picnic-platform/commit/fae5f1f88384f6da34d2e7deccdf270643f729eb))
- **rsvp:** audit in-place rsvp updates with diff ([#20](https://github.com/michaelruelas/family-picnic-platform/issues/20)) ([bf48fb4](https://github.com/michaelruelas/family-picnic-platform/commit/bf48fb4d27605992176297d3019dc610c4b4721f))
- **rsvp:** pre-fill form from existing RSVP ([#21](https://github.com/michaelruelas/family-picnic-platform/issues/21)) ([e6d7ebc](https://github.com/michaelruelas/family-picnic-platform/commit/e6d7ebc5b8b763210f230f4040deafb59fe199ab))
- **rsvp:** remove dietary_notes field per FPP-55 ([#47](https://github.com/michaelruelas/family-picnic-platform/issues/47)) ([15aad1e](https://github.com/michaelruelas/family-picnic-platform/commit/15aad1eaae473d31a400617ea22041ee66ebba90))
- **rsvp:** show fee total on confirmation screen (FPP-77) ([#32](https://github.com/michaelruelas/family-picnic-platform/issues/32)) ([fc68317](https://github.com/michaelruelas/family-picnic-platform/commit/fc683172aceb2bf0e7de0e6243d80d688bf92e4c))
- **rsvp:** show last updated on registration confirmation (FPP-53) ([#29](https://github.com/michaelruelas/family-picnic-platform/issues/29)) ([5c8af19](https://github.com/michaelruelas/family-picnic-platform/commit/5c8af198b73affafbfd7e5bd75d6ee7967e261e9))
- **scripts:** add openbao secret population script ([76f5631](https://github.com/michaelruelas/family-picnic-platform/commit/76f563185133f5e3a4a1a3f882e7ebd23227046b))
- **server:** add declineMessage, validate/consume split, invitation URL body ([#51](https://github.com/michaelruelas/family-picnic-platform/issues/51)) ([8e941f1](https://github.com/michaelruelas/family-picnic-platform/commit/8e941f11dbb33a94ef9aabad560d15584d75ceb1))
- **sms:** wire twilio account for transactional sms ([#24](https://github.com/michaelruelas/family-picnic-platform/issues/24)) ([2e7bf32](https://github.com/michaelruelas/family-picnic-platform/commit/2e7bf3204b2d0b63a6217020f9bf237e072f8ec8))
- **ui:** add DataTable primitive on TanStack Table (FPP-92) ([#50](https://github.com/michaelruelas/family-picnic-platform/issues/50)) ([e1d3c36](https://github.com/michaelruelas/family-picnic-platform/commit/e1d3c3698c9e09bb10cdbee3bdc031b46311407e))

### Bug Fixes

- **auth:** accept admin_adult role in admin gates ([#16](https://github.com/michaelruelas/family-picnic-platform/issues/16)) ([477a763](https://github.com/michaelruelas/family-picnic-platform/commit/477a76367cffed4f0b6fecbedb41181bb7d1fe77))
- **auth:** filter soft-deleted users from google oauth signin ([#18](https://github.com/michaelruelas/family-picnic-platform/issues/18)) ([ba81f7a](https://github.com/michaelruelas/family-picnic-platform/commit/ba81f7a4185bdcb35978c0a84b4c15f2d4b9b8d9))
- build only linux/arm64 ([b0e8ec1](https://github.com/michaelruelas/family-picnic-platform/commit/b0e8ec175dcd8de52a282442436c4af7403d0bcb))
- **ci:** add .prettierignore to skip phantom failure on schema-integrity test ([#53](https://github.com/michaelruelas/family-picnic-platform/issues/53)) ([652ddc1](https://github.com/michaelruelas/family-picnic-platform/commit/652ddc1b9c904b57c19bfd58d0de08406655260e))
- **ci:** correct buildah action names ([dec7d97](https://github.com/michaelruelas/family-picnic-platform/commit/dec7d9719d1fe9171516fb907c98196e5ff423e3))
- **ci:** correct runner label to forgejo-pugquilt-runner ([7aa6e4f](https://github.com/michaelruelas/family-picnic-platform/commit/7aa6e4faac985eaf6bd28b999d9a5a13037d0cab))
- **ci:** drop unsupported --config-file flag from renovate step ([3dd9b5c](https://github.com/michaelruelas/family-picnic-platform/commit/3dd9b5c4de7c9afea279ebc3db24024aa116875c))
- **ci:** drop vitest coverage from pipeline ([8f2dc87](https://github.com/michaelruelas/family-picnic-platform/commit/8f2dc870305940839355d2bc7ae19552f7b53e42))
- **ci:** drop vitest coverage thresholds ([0d05298](https://github.com/michaelruelas/family-picnic-platform/commit/0d052981055003e6ab4996cd5c3fec6f15bd63c9))
- **ci:** exclude .next from vitest to prevent stale build artifacts ([a9dee3a](https://github.com/michaelruelas/family-picnic-platform/commit/a9dee3ab02123f635a8f7c22241daf4557496329))
- **ci:** remove invalid buildkitd-config inline block ([9d04fa2](https://github.com/michaelruelas/family-picnic-platform/commit/9d04fa23de0b620ac1245e691f10254cb9ca328f))
- **ci:** remove invalid bunVersion option from renovate config ([c5ef572](https://github.com/michaelruelas/family-picnic-platform/commit/c5ef5725349216f40167a2719e7261e28716e495))
- **ci:** remove invalid name driver-opt from buildx setup ([7631897](https://github.com/michaelruelas/family-picnic-platform/commit/7631897ab516505cd12e49d3984ae00404059d48))
- **ci:** revert to pugquilt-runner-set ([14c4555](https://github.com/michaelruelas/family-picnic-platform/commit/14c4555c5aebbcf73525f7f0bfc725cf28a7a510))
- **ci:** run renovate via npx on self-hosted runner without docker ([eb5d7bc](https://github.com/michaelruelas/family-picnic-platform/commit/eb5d7bcc6c05f0c3f74b8d80fb2e481f9c63f260))
- **ci:** run vitest via node to avoid bun zod bug ([3abeb0f](https://github.com/michaelruelas/family-picnic-platform/commit/3abeb0f59c72253167872c2667c5a8b1d742c918))
- **ci:** update runner label to family-picnic-runner-set ([9691b50](https://github.com/michaelruelas/family-picnic-platform/commit/9691b5033fabc00f883666e1ac9bd1ef2824b560))
- **ci:** upgrade node to 24 and pass repo arg to renovate ([7f3cb7e](https://github.com/michaelruelas/family-picnic-platform/commit/7f3cb7ed93efc47e5c8e8a8649424607dfc48d13))
- **ci:** upgrade setup-buildx-action to v4 for node 24 support ([addb679](https://github.com/michaelruelas/family-picnic-platform/commit/addb67936415246598de53f86ad0ec6593d32c2a))
- **ci:** use docker/build-push-action for build ([50341f3](https://github.com/michaelruelas/family-picnic-platform/commit/50341f3725a9f2c4c3f1ea34c602876c4646804c))
- **ci:** use sticky loadbalance for buildx k8s driver ([569dc06](https://github.com/michaelruelas/family-picnic-platform/commit/569dc0610bc589ae802028f5dc8ceec5144a5ca0))
- **deps:** force patched versions of vulnerable transitive packages ([2a75818](https://github.com/michaelruelas/family-picnic-platform/commit/2a758189a0390ca09ca1253a814201ba290f1e03))
- docker workflow yaml parsing ([36dc6a6](https://github.com/michaelruelas/family-picnic-platform/commit/36dc6a6a31c93446fd1d959ab4fe3a3270ea88eb))
- **docker:** enable local build testing and self-hosted runner ([53b8304](https://github.com/michaelruelas/family-picnic-platform/commit/53b830452dddc4a3f7134323f4d0fa938f18df08))
- include bun.lockb in docker build context ([b938971](https://github.com/michaelruelas/family-picnic-platform/commit/b938971370059c71cd6e57fc97131dd8690af05c))
- **kubernetes:** bump nextjs dev memory limit to 1Gi ([8a24859](https://github.com/michaelruelas/family-picnic-platform/commit/8a248593c4963fa8fc18030f78bc2e5ff45b06c0))
- **kubernetes:** correct ghcr image name to michaelruelas/family-picnic-platform ([baf6ed9](https://github.com/michaelruelas/family-picnic-platform/commit/baf6ed90b8a51534c16157f11a800b95f610aae4))
- **kubernetes:** drop topology spread + reduce es refresh in dev ([bb0efac](https://github.com/michaelruelas/family-picnic-platform/commit/bb0efac2c790a40fde512b69f649dcea3c5fb1a7))
- **kubernetes:** photoprism /run mount + nextjs probe path override ([599302b](https://github.com/michaelruelas/family-picnic-platform/commit/599302b496be749351a081a8f30578eb381da96d))
- **kubernetes:** photoprism image tag 260601, gentler nextjs probes ([e064255](https://github.com/michaelruelas/family-picnic-platform/commit/e06425502c345fd6b7ad7384d4d98bb72023c27d))
- **kubernetes:** reference openbao-backend ClusterSecretStore ([7afa1ce](https://github.com/michaelruelas/family-picnic-platform/commit/7afa1ce8471f52f9f1723b2526a2042e0d6ee90a))
- **kubernetes:** use actual ghcr tag 0.1.10 (no v prefix) ([d8c6c12](https://github.com/michaelruelas/family-picnic-platform/commit/d8c6c1218c9dfd03f3ac2349c7a925f40b0eab7f))
- **kubernetes:** use existing ghcr tag v0.1.10 in dev overlay ([956c95f](https://github.com/michaelruelas/family-picnic-platform/commit/956c95ff3627c7b7cc57d9373e4fd2d54fad876a))
- move CI env vars to job level so postinstall can resolve DATABASE_URL ([0ea8e56](https://github.com/michaelruelas/family-picnic-platform/commit/0ea8e56beca2a0fdb19c65ff100e9a0a7eb41630))
- repair lint-staged precommit hook, bump all deps to latest ([ec42ce9](https://github.com/michaelruelas/family-picnic-platform/commit/ec42ce90b4fb94a5aefb53716c1ef3dc4d10314a))
- simplify docker metadata tags ([df76819](https://github.com/michaelruelas/family-picnic-platform/commit/df768196842278c933e8ab1c22314d1e0f0efd1f))
- skip postinstall scripts during deps install ([cab8296](https://github.com/michaelruelas/family-picnic-platform/commit/cab829663c6ce531a86648b5fc4eadf4f9ce51c5))
- use bun.lock instead of bun.lockb ([bd17b1f](https://github.com/michaelruelas/family-picnic-platform/commit/bd17b1fa745a1aaa7b0786d7ee83f858db37ae94))
- use bunx prisma generate ([85ac49e](https://github.com/michaelruelas/family-picnic-platform/commit/85ac49e6d2f4f5d9f0b1501c39e7ec621674dc3f))
- use bunx prisma generate ([c51a217](https://github.com/michaelruelas/family-picnic-platform/commit/c51a21711dd53ab84d973837e405e882b62e7371))

### Performance Improvements

- **ci:** add bun cache mount, registry cache, shared builder ([23e6874](https://github.com/michaelruelas/family-picnic-platform/commit/23e68749dc290b434574a12bddbbb25d8aee6754))

## [Unreleased]

### Added

- **Household payment model + admin view (FPP-48, FPP-16, FPP-14)** — New `Event.registrationFeeMinAge Int` column (default 0, inclusive age threshold for the per-attendee fee). Pure fee calculator at `src/lib/fee.ts` (`calculateFee(attendees, {amountCents, minAge})` and `calculateFeeFromEvent`) — attendees are skipped when `memberAge === null`, and `memberAge >= minAge` qualifies (inclusive boundary). `rsvpRouter.confirm` / `update` / `adminOverride` now read the event's `registrationFeeCents` + `registrationFeeMinAge` from the same transaction as the RSVP write and upsert a `Registration` row with the computed `amountCents`. Settled rows (`PAID` / `REFUNDED` / `FORFEITED` / `CANCELLED`) are never overwritten. `EventRsvpCard` renders the snapshotted fee on the "You're in!" card; `RsvpBottomSheet` shows a live fee line that recomputes on every attendance flip. `EventForm` exposes a "Minimum Age for Fee" integer field (validated 0-120) alongside the existing fee field; `eventCreateSchema` and `eventUpdateSchema` accept the new column; REST `/api/admin/events` POST + PATCH validate and persist it. One-shot backfill at `prisma/backfill-registration-fees.ts` and `src/lib/registration-fee-backfill.ts` (`bun run db:backfill-registration-fees [--apply]`): pins `Registration.amountCents = 0` for every non-settled row, writes one `REGISTRATION_FEE_BACKFILL` audit entry per registration (old + new value + `source: 'backfill-registration-fees'`), idempotent, exits non-zero on any per-row failure. (FPP-15 — the admin payments view — shipped on the FPP-47 branch as an inline design; no separate ticket needed.)
- **RSVP duplicate backfill script (FPP-28)** — `prisma/backfill-rsvp-duplicates.ts` and `src/lib/rsvp-backfill.ts` ship a one-time merge utility for any duplicate `RSVP` rows the pre-fix re-registration bug may have left behind. Per `(eventId, userId)` group, picks the most recent row as the winner (tiebreak: `respondedAt`, then `id`), reassigns any `PotluckSignup` rows to the winner, writes one `RSVP_MERGE` entry to `AdminAuditLog` per loser, and deletes the losers. Wraps each group in a `$transaction`. Default mode is dry-run; pass `--apply` (or run `bun run db:backfill-rsvp-duplicates --apply`) to write. Idempotent and exits non-zero on any per-group failure.

- **Audit log for event registrations (FPP-50 / FPP-20, FPP-19, FPP-18)** — New append-only `AuditLog` table (`id, actorId, action, subjectType, subjectId, payload, occurredAt`) with composite indexes on `(subjectType, subjectId)` and `(actorId, occurredAt)`. Postgres trigger blocks `UPDATE` / `DELETE` so entries are immutable at the DB level. `writeDomainAuditLog()` helper writes inside the same transaction as the originating mutation so the audit row never outlives the action it describes. Domain hooks fire on `rsvp.signup` (first-time RSVP), `rsvp.confirm` (first-time confirmation, replaces the prior silent path), `rsvp.adminOverride` (with the diff against the previous RSVP), `potluck.signup.create` / `potluck.signup.update` / `potluck.signup.cancel`, and `event.admin.add` / `event.admin.remove` (subject id is `${eventId}:${userId}` so role changes are filterable by event and target user). Existing `AdminAuditLog` entries are untouched — the new table is additive. The admin audit-log page (`/admin/audit-log`) now shows merged entries from both tables with `source` tagged on each row and four new filter inputs: subject type, subject id, `from`, `to`. The `/api/admin/audit-log` endpoint validates the new filter params with a Zod schema (`auditLogFilterSchema` in `src/lib/schemas/audit.ts`) and returns `400` on malformed dates. One-shot idempotent backfill at `prisma/backfill-audit-log.ts` (`bun run db:backfill-audit-log [--apply]`) replays historical `RSVP`, `PotluckSignup`, and `EventAdmin` rows into the new table — each entry tagged with `payload.source = 'backfill-audit-log'` so a re-run is a no-op (the dedupe query matches `(subjectType, subjectId, action)` triples).

- **Stripe credit card processing (FPP-47)** — `Registration`, `Charge`, and `Refund` models with Stripe PaymentIntent ids; per-event `registrationFeeCents` field; `payment.createPaymentIntent` / `payment.getMyRegistration` / `payment.getPublishableKey` procedures; `admin.listCharges` / `admin.refund` (full + partial, idempotent on the Refund row id) / `admin.forfeit` (no money returned) / `admin.resendReceipt` procedures; Stripe webhook route with `constructEventAsync` signature verification, idempotent on `charge.id`, handling `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, `charge.refunded`, and `charge.updated`; hosted Payment Element checkout page with `return_url` flow; admin `/admin/charges` page with filter, refund dialog, forfeit dialog, and resend-receipt action; branded receipt email template sent on `payment_intent.succeeded` and resendable from admin; every charge and refund writes an `AdminAuditLog` entry. Three new Stripe env vars (`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`) wired through `kubernetes/base/nextjs.yaml`, the dev `ExternalSecret`, and `scripts/populate-openbao-secrets.sh`.

- **Stripe webhook bootstrap script (FPP-47)** — `scripts/setup-stripe-webhook.sh` registers the production webhook endpoint via `stripe webhook_endpoints create`, pushes `stripe-webhook-secret` to OpenBao at `secret/family-picnic-${ENV}/nextjs` (idempotent; refuses to create a duplicate URL), and pins `api_version` to `2025-08-27.basil` to match `src/lib/stripe.ts`. `dev` is intentionally rejected — use `stripe listen` instead. `scripts/lib/openbao.sh` extracts the `bao_exec` / `bao_get_json` / `bao_put_kv` / `extract` helpers so `scripts/populate-openbao-secrets.sh` and the new bootstrap script share them. The populate script accepts a positional `dev|prod` arg. `STRIPE_API_KEY` is bootstrap-only (surfaced into `.env.dev` for convenience; never pushed to OpenBao; never read by the Next.js runtime).

### Removed

- **`RSVP.dietaryNotes` (FPP-55)** — Platform-level free-form dietary note field removed from the RSVP schema, RSVP form, and confirmation flow. Historical values are preserved in the database column for audit. The migration `20260805171107_fpp55_remove_dietary_notes` writes an `AdminAuditLog` row with action `FPP55_DIETARY_NOTES_REMOVED` (idempotent via a `NOT EXISTS` guard on the action type). `Dependent.dietaryLabels` and `PotluckSignup.dietaryLabels` are unchanged (per-attendee and per-dish structured labels remain).

### Fixed

- **Google OAuth signIn lookup** (`src/lib/auth.ts`) — filter `deletedAt: null` on the active-user lookup, then refuse sign-in entirely when the email matches a soft-deleted tombstone. The `User.email` unique index covers soft-deleted rows, so re-provisioning would throw on insert; refusing matches the dev-credentials `authorize` behavior and ADR-001 ("account recovery won't do"). The admin must explicitly re-invite a deleted user.

### Tests

- **Fee calculator coverage** — `src/lib/__tests__/fee.test.ts` (17 tests) covers the calculator: zero-fee and missing-config paths, YES-only filter (NO and MAYBE skipped), null-age skip, `minAge` inclusive boundary, multi-attendee multiplication, and `calculateFeeFromEvent` mapping from an `Event` row.
- **Registration fee backfill coverage** — `src/lib/__tests__/registration-fee-backfill.test.ts` (15 tests) covers dry-run no-op, apply zeros non-settled + audits each, settled-row protection (PAID / REFUNDED / FORFEITED / CANCELLED left alone with real amount in audit newValue per B7), idempotency on a re-run, per-row error isolation, top-level scan failure, formatter output, B6 pre-cutoff scoping (post-cutoff RSVPs are never touched), and `--cutoff` override. `tests/integration/registration-fee-backfill-script.test.ts` (11 tests) verifies the script wiring: thin CLI wrapper, `--apply` and `--cutoff=` flag handling, exit non-zero on errors, package script registered, lib exports, audit action name, `$transaction` wrapping, explicit settled-status guard, B6 cutoff scope, and B7 audit-amount correctness.
- **Fee display coverage** — `EventRsvpCard.test.tsx` (6 new tests) covers the "You're in!" fee badge: hidden when the snapshot is 0 or undefined, rendered with the snapshotted amount + currency, USD fallback, and DECLINED-status suppression. `RsvpBottomSheet.test.tsx` (6 new tests) covers the live fee line: hidden when no fee config, hidden when amount is 0, render with minAge threshold applied, recompute on YES/NO flip, $0 when every attendee is below minAge, and EUR currency rendering. `EventForm.test.tsx` (4 new tests) covers the new "Minimum Age for Fee" field: rendering, pre-fill from `initialData`, submit payload carries `registrationFeeCents` + `registrationFeeMinAge`, and default-to-0 behavior when empty.
- **RSVP backfill coverage** — 12 unit tests in `src/lib/__tests__/rsvp-backfill.test.ts` (dry-run no-op, apply merges + reassigns + audits, idempotent second run, tiebreak order, partial-failure isolation, top-level error handling, formatter output) and 9 integration smoke tests in `tests/integration/rsvp-backfill-script.test.ts` (script wires the lib, defaults to dry-run, exits non-zero on errors, package script registered).
- **OAuth soft-deleted user coverage** (`src/lib/__tests__/auth.test.ts`) — assert the Google signIn callback (1) filters the active-user lookup with `deletedAt: null`, (2) performs an unfiltered tombstone lookup, and (3) returns `false` with no create when the email matches a soft-deleted record. Updated the pre-existing string-pattern smoke test in `tests/auth/sign-in.test.ts` to match the new control flow.
- **Domain audit log coverage** — `src/lib/__tests__/audit-domain.test.ts` (4 tests) covers `writeDomainAuditLog`: payload shaping, null-actor coercion, `occurredAt` passthrough, and transaction-client forwarding. `src/lib/__tests__/audit-log-backfill.test.ts` (10 tests) covers the new `AuditLog` backfill: plan shape per source row, composite `event:user` subject id for `EventAdmin`, idempotency via `(subjectType, subjectId, action)` dedupe, dry-run no-op, apply mode marker stamping, and per-row error isolation. `src/server/__tests__/audit-entries.test.ts` (4 tests) covers `listAuditLogEntries`: parallel `AdminAuditLog` + `AuditLog` queries, merge sort by occurred time, time-range filter wiring, and subject-only filter scoping. `src/app/api/admin/__tests__/route.test.ts` adds two cases for the merged audit-log endpoint: `400` on invalid `from` date and `auditLog.findMany` invocation when subject filters are set. `src/server/routers/__tests__/routers.test.ts` adds six cases asserting the new hooks fire on `rsvp.create`, first-time `rsvp.confirm`, `rsvp.adminOverride`, `event.addAdmin`, `event.removeAdmin`, `potluck.signup` (new dish), and `potluck.cancelSignup`; the pre-existing "confirm skips audit log when no prior RSVP exists" assertion is renamed to reflect that the silent path is now closed (a domain entry is written instead).
- **Stripe lib + receipt + webhook + payment router coverage** — `src/lib/__tests__/stripe.test.ts` (19 tests) covers env detection, payment-intent creation with `idempotencyKey`, refund creation, signature verification with explicit-secret override, amount formatting, and the test-header helper. `src/lib/__tests__/receipt.test.ts` (5 tests) covers HTML escaping, receipt-link inclusion, and success/failure paths. `src/app/api/stripe/webhook/__tests__/route.test.ts` covers 503 on missing secret, 400 on bad signature, every supported event type, out-of-band `charge.refunded` reconciliation, receipt-failure isolation, retry dedup on `payment_intent.succeeded`, partial-refund reconciliation via `charge.updated`, status-guard against resurrecting `FORFEITED`/`REFUNDED` registrations, and the 200-on-handler-error behavior. `src/server/routers/__tests__/payment.test.ts` and `__tests__/admin-payment.test.ts` cover the user-facing payment flow and the admin charge list / refund / forfeit / resend paths. `tests/integration/payments-fpp47-config.test.ts` verifies the K8s deployment + `ExternalSecret` + populate script + `.env.example` + `stripe.ts` + webhook route + `package.json` all carry the three new Stripe keys. `tests/integration/stripe-webhook-bootstrap.test.ts` (12 tests) verifies the script shape: file-exists, args, env refusal, event subscription, API-version pin, idempotency, OpenBao push, ExternalSecret binding, lib exports, and that the populate script sources the shared OpenBao lib.
- **Transaction retry helper coverage** — `src/lib/__tests__/transaction-retry.test.ts` (10 tests) covers the `withSerializableRetry` helper that backs `payment.createPaymentIntent` and `admin.refund`: P2034 retry, max-attempt exhaustion, non-P2034 passthrough, and the `onRetry` callback.

### Fixed

- **Boop review fixes for FPP-48 (PR #28)** — `syncRegistrationFee` extracted to `src/lib/registration-fee.ts` so the tRPC `confirm` / `update` / `adminOverride` procedures, the `rsvp.create` procedure, and the REST `POST /api/rsvp` route all share one path. B1: `payment.createPaymentIntent` now sources the charge amount from the `Registration` snapshot, with a fallback recompute for legacy pre-FPP-48 RSVPs. B2: after persisting attendances, the full snapshot is reloaded before fee calculation so partial lists do not undercount. B3: fee decreases now reflect immediately and active `Charge` rows are canceled when the amount changes, so a stale Stripe session never ships at the old price. B4: `rsvp.create` and the REST endpoint now run the same fee write. B5: `EventStickyBar` forwards `registrationFeeConfig` to the mobile `RsvpBottomSheet`. B6: backfill scopes to `createdAt < 2026-08-06T09:00:00Z` (the FPP-48 migration timestamp) with a `--cutoff` override flag for safety, so post-deployment RSVPs are never touched. B7: settled-row audit `newValue.amountCents` reports the actual amount, not a misleading zero.

## [0.1.12] — 2026-07-30

### Fixed

- **Google OAuth admin signups blocked from admin pages (#16)** — Google signups land with role `admin_adult` (the schema default), but every admin gate checked `role !== 'admin'` and silently redirected to `/`. Promoted admins signing in via Google were locked out of the admin dashboard. Introduced `isAdminRole` helper and `ADMIN_ROLES` set in `src/lib/auth.ts`; switched tRPC `isAdmin` middleware, all 7 admin pages, 18 admin API routes, photo-delete, and the photo router to use it. Added a `jwt` callback to stamp the local Prisma user id into `token.sub` so the `session` callback's Prisma lookup resolves Google users. Audit-log user filter now matches against `ADMIN_ROLES` so `admin_adult` users appear in the picker.

### Refactoring

- **`requireAdmin` helper extraction (#17)** — Pulled the `session.user.role ∈ ADMIN_ROLES` check into `src/lib/admin-auth.ts` so admin gating is a single import across pages, route handlers, and tRPC procedures.

## [0.1.0] — 2026-07-02

### Added

- **Prisma schema** — 13 models, 14 enums, full relation graph aligned with SPEC.md
- **Project scaffold** — Next.js 16 (App Router), tRPC v11, Prisma 7, NextAuth 4, Tailwind CSS 4, TypeScript 6
- **Auth module** — Google OAuth via NextAuth, session enrichment with role and householdId
- **tRPC middleware** — `protectedProcedure` (authenticated) and `adminProcedure` (admin-only) with structured error formatting
- **Prisma client** — Singleton with `@prisma/adapter-pg`, dev-query logging, global caching
- **Test suite** — Vitest with 21 tests across unit, integration, and schema-integrity specs
- **CI pipeline** — GitHub Actions: typecheck, lint, format, test, prisma validate, build
- **Tooling** — ESLint (Next.js config), Prettier (with Tailwind plugin), `.env.example`, `.gitignore`
- **Complete MVP implementation (`790dfc4`)** — Full feature set landed in a single commit on 2026-07-02. The items below were all part of that MVP commit and shipped with v0.1.0:
  - **Observability Infrastructure (Ticket 39)** — Structured logging with pino (`src/lib/logger.ts`) with request-scoped loggers, JSON output, and requestId/userId/route correlation. `src/lib/tracing.ts` provides AsyncLocalStorage trace context. LOG_LEVEL, SENTRY_DSN, and OTEL_EXPORTER_OTLP_ENDPOINT added to `.env.example`. Key API routes instrumented: `/api/rsvp`, `/api/potluck-signup`, `/api/profile`, `/api/admin/events`, `/api/admin/communications/send`.
  - **Kubernetes Manifests (Ticket 13)** — `kubernetes/` with base manifests for Next.js, PostgreSQL (3-replica StatefulSet), and PhotoPrism (50TB PVC, egress-restricted NetworkPolicy). Kustomize dev overlay at `kubernetes/overlays/dev/`. Deployment docs in `kubernetes/README.md`.
  - **Accessibility Audit (Ticket 38)** — Toast `aria-live`/`aria-atomic` per WCAG. `tests/a11y/` with 29 tests covering Toast, Modal, UI primitives keyboard nav, and 4.5:1 color contrast on all primary text.
  - **Commit Hygiene and Release Please (Ticket 35)** — Conventional commit enforcement via commitlint + husky. `release-please` config and `release:dry`/`release:full` scripts.
  - **Dev Onramp and AGENTS.md (Tickets 43, 32)** — `AGENTS.md` developer guide, `scripts/dev.sh` one-command setup, `docker-compose.yml` for local PostgreSQL.
  - **Rate Limiting for Broadcasts and Invitations (Ticket 25)** — `src/lib/rate-limit.ts` with admin (5/hr), recipient group (1/30min), and per-recipient (2/day) limits. Wired into `sendBroadcast` and `invitation.send`.
  - **Type Safety Hardening (Ticket 34)** — Replaced loose `string` types with Prisma enums in RSVPForm, PotluckSignupForm, ProfileClient, and `RELATIONSHIP_LABELS`.
  - **Loading Skeletons (Ticket 33)** — Pulse-animated placeholders at `/events/loading.tsx` and `/my-events/loading.tsx`. Root `error.tsx` for friendly error UI.
  - **Zod Schemas and Validation (Ticket 27)** — Shared schemas in `src/lib/schemas/` for rsvp, potluck, dependent, profile, photo. 30 schema tests.
  - **RSVP Waitlist (Ticket 29)** — `WAITLISTED` enum, `waitlistPosition` field, waitlist UI in `RSVPForm`. See ADR-005.
  - **Multi-Admin Per Event (Ticket 20)** — `EventAdmin` join table, `listAdmins`/`addAdmin`/`removeAdmin` procedures, `/admin/events/[id]/edit/admins` page.
  - **Admin Bulk CSV Import (Ticket 19)** — PapaParse-based `src/lib/csv-parser.ts` and `CsvUploader` component with drag-and-drop, preview, and dry-run.
  - **First-Time Onboarding Wizard (Ticket 21)** — `/onboarding` 3-step wizard (household, family members, comm preference) with `WizardStep` and `HelpButton` components.
  - **Audit Middleware (Tickets 18, 05)** — `auditLog` middleware writes `AdminAuditLog` entries. `auditedAdminProcedure` exported for admin mutations.
  - **Dietary Label Filtering (Ticket 22)** — `DietaryLabelChip`, `DietaryFilter`, `DietaryAttendeeFilter` components on event detail and admin dashboard.
  - **Events Calendar View (Ticket 23)** — `/events/calendar` month grid with `Calendar` component.
  - **Component Hook Migration (Ticket 16)** — `useRsvp`, `useUser`, `usePhoto` hooks. `TRPCProvider` for tRPC + React Query.
  - **PWA Offline Support (Ticket 12)** — `public/manifest.webmanifest` and `public/sw.js`. `OfflineBanner` component.
  - **Photo Upload Flow (Ticket 10)** — S3 presigned URLs, client-side EXIF stripping, PhotoPrism sync. `UploadButton` and `PhotoGrid` components.
  - **Integration Test Coverage (Ticket 17)** — 136 tests across 13 files covering all six SPEC §8 edge cases.
  - **Photo Deletion Policy (Ticket 11)** — Soft-delete via `deletedAt`, all deletions audited.
  - **Realistic Seed Data (Ticket 37)** — `prisma/seed.ts` extended with household, users, dependents, event, RSVPs, photos.
  - **Admin Communications Page (Ticket 04)** — `/admin/communications` broadcast composer with Twilio and SendGrid wrappers.
  - **Admin Invitations Page (Ticket 03)** — `/admin/invitations` with event selector, send/resend/track actions.
  - **Unsubscribe Communication Logging** — `communication.unsubscribe` writes `CommunicationLog` with `UNSUBSCRIBED` status.
  - **Invitation Single-Use Tokens (Ticket 41)** — `consume` procedure enforces one-time use.
  - **UI Primitives Library (Ticket 15)** — `src/components/ui/` with Button, Input, Card, Modal, Toast, EmptyState, Spinner. Tests in `tests/ui/primitives.test.ts`.
  - **Admin Audit Log UI (Tickets 05, 18)** — `/admin/audit-log` filterable table with JSON diff viewer.
  - **Audit helper** — `src/lib/audit.ts` with `diff()` and `writeAuditLog()`.
  - **Architecture Decision Records (Ticket 14)** — 10 ADRs in `docs/decisions/`.
  - **Admin Event CRUD UI (Ticket 08)** — `/admin/events` list, create, and edit pages.
  - **Household Dashboard (Ticket 06)** — `/household` member list with cumulative headcount.
  - **Household Tree Visualization (Ticket 07)** — `/household/tree` interactive family tree.
  - **Admin Potluck Slot Management (Ticket 09)** — Slot management UI in `/admin/events/[id]/edit`.
  - **Admin Dashboard (Ticket 02)** — `/admin/dashboard` aggregated RSVP metrics.
  - **Empty Route Shells Cleanup (Ticket 26)** — Documented flat `/events/[id]/*` layout in `docs/architecture.md`. Removed scaffolded empty route groups.

### Fixed

- Aligned all enum values with SPEC (Role, InvitationStatus, CommunicationStatus, ReactionType)
- Renamed `Event.details` → `description`
- Added missing `RSVP.householdId`, `RSVP.dietaryNotes`
- Added missing `Photo.photoPrismId`, `Photo.caption`
- Added missing `CommunicationLog.messageId`
- Restructured `PotluckSignup` to reference RSVP (not User/Household directly)
- Upgraded to Prisma 7 driver-adapter pattern (`prisma.config.ts`, `@prisma/adapter-pg`)
- Removed deprecated `dependentSlots` relation and ReactionType enum
- **Potluck slot race condition (Ticket 28)** — Signup + counter increment wrapped in `prisma.$transaction` with `Serializable` isolation. Returns 409 Conflict on full slot.
- **Auto-release potluck slots on RSVP decline (Ticket 42)** — On decline, potluck signups released and `PotluckSlot.currentSignups` decremented atomically.
- **Remove duplicate NextAuth handler (Ticket 36)** — Removed duplicate handler exports from `src/lib/auth.ts`. Single active handler in `src/app/api/auth/[...nextauth]/route.ts`.

## [0.1.11] — 2026-07-27

### Added

- **Renovate replaces Dependabot** — Self-hosted [Renovate](https://docs.renovatebot.com/) bot via `renovatebot/github-action` for weekly dependency updates. `renovate.json` configures the `bun` and `github-actions` managers, groups production and development dependencies separately, and skips major version updates. Weekly Monday morning schedule via `.github/workflows/renovate.yml`. Closes the loop on the dependabot/bun-lockfile conflict — the previous dependabot config updated `package-lock.json` only and could never pass `bun install --frozen-lockfile` in CI.
- **Release-please manifest** — Added `.release-please-manifest.json` and `release-please-config.json` to track the current release version and configure changelog generation from conventional commits.
- **CI test pipeline** — Tests moved from the pre-commit hook to the CI pipeline. Full `bun test` (with coverage gate) now runs on every push; `lint-staged` runs a partial mirror (`vitest run --passWithNoTests`) for staged files. `bun run ci` script added for the full local suite.

### Changed

- **Prisma 7.9.0 → 7.9.1** — Security patch for a transitive dependency advisory in `@prisma/dev` (prisma/prisma#29780). No production behavior change.
- **Next.js 16.2.11 and NextAuth 4.24.15** — Patch upgrades addressing a NextAuth session-handling security advisory and pulling the latest Next.js stable patches.
- **GitHub Actions kept current** — Renovate/Dependabot bumped `actions/*` (5 updates) and production (11) plus development (19) dependency groups.

### Fixed

- **Vulnerable transitive dependencies** — Added npm overrides to force patched versions of `brace-expansion` (1.1.16) and six other packages with open Dependabot security alerts. See commit `2a75818` for the full list.
- **Renovate runner setup** — Switched from Docker-based to `npx renovate` on the self-hosted runner, dropped the unsupported `--config-file` flag, pinned Node 24, and removed the invalid `bunVersion` option. Iterative fixes landed in `eb5d7bc`, `3dd9b5c`, `7f3cb7e`, `c5ef572`.

### Removed

- **`package-lock.json`** — Stale npm lockfile. Project uses `bun.lock` exclusively; `package.json`, `Dockerfile`, and CI all read from `bun.lock`. Regenerate with `bun install` if needed.
- **`.github/dependabot.yml`** — Replaced by Renovate (see above).

## [0.1.10] — 2026-07-26

### Fixed

- **Docker buildx for Node 24** — Upgraded `setup-buildx-action` from v3 to v4 to restore Docker image builds under the Node 24 CI runtime. Removed the invalid `driver-opt: name=name` flag that v4 rejects. See commits `7631897` and `addb679`.
