# Onboarding flow for first-time / multi-generational users

## Status

Missing — no first-run experience. SPEC §1 calls for "Multi-generational
accessibility: Simple UI, large touch targets, forgiving interactions"
as the top design principle.

## Description

Right now after Google sign-in, a user lands on `/profile` with no
explanation of what the platform does. Older users without technical
background may bounce.

Add:

- First-login wizard: pick household, add dependents, set communication
  preference.
- Tooltips / coach-marks on key pages (Events, RSVP, Potluck).
- A printable "How it works" one-pager.
- Persistent "?" button that opens a context-aware help panel.

## Acceptance criteria

- New user lands on `/onboarding` after first sign-in.
- Wizard completes in ≤ 3 steps.
- Each step is large-button, plain-language, low cognitive load.
- Skippable for users who already understand the platform.

## Files

- `src/app/onboarding/page.tsx` (create)
- `src/components/onboarding/WizardStep.tsx` (create)
- `src/components/HelpButton.tsx` (create)
- `src/lib/first-login.ts` (detect via `User.createdAt` + onboarding flag)
