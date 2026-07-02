# Add base UI primitives

## Status

Missing — `src/components/ui/` directory exists but is empty. Tailwind 4
classes are used inline in every component.

## Description

Today `Button`, `Input`, `Card`, `Modal`, `Select`, etc. are recreated
inline or copy-pasted across `RSVPForm`, `PotluckSignupForm`,
`PhotoCard`, `ProfileClient`, `NavBarClient`. With SPEC §1 design
principles ("large touch targets, forgiving interactions"), we need a
shared library tuned for multi-generational UX.

Implement minimal primitives:

- `Button` (variants: primary, secondary, danger, ghost; sizes lg/xl for
  touch).
- `Input` + `Textarea` + `Select` (large fonts, high contrast).
- `Card`.
- `Modal` (with focus trap, escape-to-close).
- `Toast` (success/error banner).
- `EmptyState` (used heavily already).
- `Spinner` for loading states.

## Acceptance criteria

- Each primitive has Storybook-like demo or a Vitest render test.
- Tailwind tokens (`text-lg`, `min-h-12`) sized for 50+ year-old fingers.
- No new component in the app imports raw `<button>` without wrapping in
  `Button`.

## Files

- `src/components/ui/Button.tsx` (create)
- `src/components/ui/Input.tsx` (create)
- `src/components/ui/Card.tsx` (create)
- `src/components/ui/Modal.tsx` (create)
- `src/components/ui/Toast.tsx` (create)
- `src/components/ui/EmptyState.tsx` (create)
- `src/components/ui/__tests__/*` (create)
- Refactor existing files to use them.
