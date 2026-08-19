# Tickets

This directory contains feature tickets and their implementation status.

## Priority Order

Tickets are ordered by suggested implementation priority. Lower numbers = higher priority.

### MVP Scope (Phase 1)

| Ticket | Description                              | Status |
| ------ | ---------------------------------------- | ------ |
| 01     | tRPC router structure                    | Done   |
| 02     | Admin dashboard page                     | Done   |
| 03     | Admin invitations page                   | Done   |
| 04     | Admin communications page                | Done   |
| 05     | Admin audit log page                     | Done   |
| 06     | Household dashboard                      | Done   |
| 07     | Household tree visualization             | Done   |
| 08     | Admin event CRUD                         | Done   |
| 09     | Potluck slot management UI               | Done   |
| 10     | Photo upload flow                        | Done   |
| 11     | Photo deletion policy                    | Done   |
| 12     | PWA offline support                      | Done   |
| 14     | Resolve open questions (ADRs)            | Done   |
| 15     | UI primitives library                    | Done   |
| 16     | React hooks layer                        | Done   |
| 17     | Integration test coverage                | Done   |
| 18     | Audit log middleware                     | Done   |
| 19     | CSV bulk import                          | Done   |
| 20     | Multi-admin per event                    | Done   |
| 21     | First-time onboarding wizard             | Done   |
| 22     | Dietary label filtering                  | Done   |
| 23     | Events calendar view                     | Done   |
| 24     | Photo search                             | Done   |
| 25     | Rate limiting for broadcasts             | Done   |
| 26     | Empty route shells cleanup               | Done   |
| 27     | Zod schemas and validation               | Done   |
| 28     | Potluck slot race condition fix          | Done   |
| 29     | RSVP waitlist                            | Done   |
| 33     | Loading and error states                 | Done   |
| 34     | Type safety hardening                    | Done   |
| 35     | Changelog and commit hygiene             | Done   |
| 36     | Remove duplicate NextAuth handler        | Done   |
| 37     | Realistic seed data                      | Done   |
| 38     | Accessibility audit                      | Done   |
| 39     | Observability (logging, metrics, Sentry) | Done   |
| 41     | Invitation single-use tokens             | Done   |
| 42     | Auto-release potluck on decline          | Done   |
| 47     | Integrate credit card processing         | Done   |

### Post-MVP (Phase 2+)

| Ticket | Description              | Status                 |
| ------ | ------------------------ | ---------------------- |
| 13     | Kubernetes manifests     | Done                   |
| 30     | Account recovery         | Won't do (see ADR-001) |
| 31     | Scheduled broadcasts     | Done                   |
| 32     | Repo documentation       | Done (this file)       |
| 40     | Backup and data export   | Done                   |
| 43     | Dev onramp and AGENTS.md | Done                   |

### Iteration (Phase 3+ — post-MVP)

Tickets opened after MVP completion via stakeholder bug-bash sessions,
follow-up audits, and post-release hardening. All merged to `main`.

#### Auth & Permissions

| Ticket  | Description                                                      | PR  | Status |
| ------- | ---------------------------------------------------------------- | --- | ------ |
| FPP-65  | Host role + per-event assignment                                 | #67 | Done   |
| FPP-103 | Dependent FK error returns `USER_HAS_NO_HOUSEHOLD`               | #59 | Done   |
| FPP-104 | Complete per-event host scoping (potluck, RSVP, event lifecycle) | #69 | Done   |
| FPP-110 | Apple login `invalid_client` error                               | #83 | Done   |

#### Event Features

| Ticket  | Description                                      | PR       | Status                                                                   |
| ------- | ------------------------------------------------ | -------- | ------------------------------------------------------------------------ |
| FPP-4   | Render itinerary on event page                   | #74      | Done                                                                     |
| FPP-43  | Allow PDF attachments to events                  | #76      | Done (sub-tickets in [`43-pdf-attachments.md`](./43-pdf-attachments.md)) |
| FPP-45  | Itinerary management                             | #66      | Done                                                                     |
| FPP-46  | Tabbed layout on event page                      | #54      | Done                                                                     |
| FPP-60  | Featured image on event page                     | #75      | Done                                                                     |
| FPP-61  | Event location map with directions               | #71      | Done                                                                     |
| FPP-68  | Past events archive view                         | #79      | Done                                                                     |
| FPP-70  | Reopen closed events                             | #70      | Done                                                                     |
| FPP-145 | Custom display name for event location | (inline) | Done |

#### RSVP & Potluck

| Ticket  | Description                                       | PR           | Status |
| ------- | ------------------------------------------------- | ------------ | ------ |
| FPP-52  | Multi-slot potluck signup with my-slots view      | #33          | Done   |
| FPP-53  | Show last-updated on registration confirmation    | #29          | Done   |
| FPP-54  | Make potluck slot name optional                   | #48          | Done   |
| FPP-55  | Remove `RSVP.dietaryNotes` field                  | #47          | Done   |
| FPP-56  | Per-member attendance + registration confirmation | #27          | Done   |
| FPP-80  | Editable household name in registration form      | #30          | Done   |
| FPP-89  | Invitation-token RSVP wizard (server + e2e)       | #52, #62     | Done   |
| FPP-106 | Stabilize input focus in member-name fields       | #80          | Done   |
| FPP-107 | Allow head-of-household age for fee calc          | #81          | Done   |
| FPP-109 | Allow multiple ad-hoc guests in one attendance    | #82          | Done   |
| FPP-111 | Link accounts by email (`LinkedIdentity`)         | #84          | Done   |
| FPP-113 | Fix age charge edge cases                         | #84          | Done   |
| FPP-115 | Expand RSVP modal layout                          | #84          | Done   |
| FPP-117 | Household requires age + name surfaced            | (#80 series) | Done   |
| FPP-118 | Mobile sheet dismissal                            | (inline)     | Done   |
| FPP-124 | Keep SMS contact fields visible on RSVP           | (inline)     | Done   |
| FPP-125 | Streamline potluck transition (in RSVP)           | (inline)     | Done   |
| FPP-126 | Potluck transition follow-up                      | (inline)     | Done   |
| FPP-128 | Save button + potluck completion in RSVP          | (inline)     | Done   |
| FPP-129 | Refresh slot queries immediately                  | (inline)     | Done   |
| FPP-130 | Decrement signup count once on decline            | (inline)     | Done   |
| FPP-131 | Potluck completion polish                         | (inline)     | Done   |

#### Payments

| Ticket  | Description                                  | PR       | Status |
| ------- | -------------------------------------------- | -------- | ------ |
| FPP-77  | Show fee total on confirmation screen        | #32      | Done   |
| FPP-101 | Wire `deliverOne` email branch to SendGrid   | #60      | Done   |
| FPP-123 | Inline Stripe Elements form with 3DS support | (inline) | Done   |

#### Communications

| Ticket | Description                          | PR  | Status |
| ------ | ------------------------------------ | --- | ------ |
| FPP-86 | SMS via Twilio (`deliverOne` branch) | #65 | Done   |

#### UI & Visual

| Ticket  | Description                                | PR  | Status |
| ------- | ------------------------------------------ | --- | ------ |
| FPP-44  | Panels don't display properly in dark mode | #77 | Done   |
| FPP-62  | Accessible timezone-aware date picker      | #78 | Done   |
| FPP-84  | Homepage becomes a login screen            | #72 | Done   |
| FPP-85  | Hide top-level nav on public routes        | #64 | Done   |
| FPP-87  | Delete unused legacy `RSVPForm` component  | #73 | Done   |
| FPP-91  | Admin UI table-first redesign              | #56 | Done   |
| FPP-92  | DataTable primitive on TanStack Table      | #50 | Done   |
| FPP-112 | Potluck roster in RSVP view                | #85 | Done   |
| FPP-114 | Simplified header                          | #85 | Done   |
| FPP-116 | Logo in nav                                | #85 | Done   |

#### Audit & Observability

| Ticket  | Description                              | PR  | Status |
| ------- | ---------------------------------------- | --- | ------ |
| FPP-50  | Event registrations surface on audit log | #55 | Done   |
| FPP-78  | Document payment audit action strings    | #31 | Done   |
| FPP-102 | Manual RSVP entry on members page        | #61 | Done   |

#### Stakeholder Bug-Bash Round

| Ticket | Description                                                          | PR       | Status |
| ------ | -------------------------------------------------------------------- | -------- | ------ |
| (anon) | User feedback form emailed to info@foliapicnic.com                   | #86      | Done   |
| (anon) | PostHog analytics tracking on non-local hosts                        | (inline) | Done   |
| (anon) | Admin user + household management pages                              | (inline) | Done   |
| (anon) | Split `ADMIN_ADULT` into `ADMIN` and `ADULT` roles                   | (inline) | Done   |
| (anon) | Event header consolidation + `additionalInfo` + PDF embed            | (inline) | Done   |
| (anon) | Migrate from deprecated `Autocomplete` to `PlaceAutocompleteElement` | (inline) | Done   |
| (anon) | Rebrand to Folia Family Picnic, update typeface                      | (inline) | Done   |

### Open Follow-ups

| Ticket  | Description                                                                                             | Source                                                          | Status                                                                              |
| ------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| FPP-132 | Verify per-event host scoping end-to-end (REST admins gate, `stampHostRole` un-stamp path, scope audit) | [`audits/pr-review-summary.md`](../audits/pr-review-summary.md) | Open (see [`132-host-scoping-verification.md`](./132-host-scoping-verification.md)) |

## Active Development

All scoped tickets are merged to `main`. FPP-132 is the one open follow-up. See [CHANGELOG.md](../CHANGELOG.md) for release history.
