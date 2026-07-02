# Resolve SPEC open questions

## Status

Done — 10 ADRs created in `docs/decisions/` covering Q1, Q3, Q4, Q6, Q7, Q8, Q9, Q11, Q12, Q15. SPEC §10 updated with decision references. Remaining questions (Q2, Q5, Q10, Q13, Q14, Q16-Q19) documented as Post-MVP or with placeholder resolutions.

## Description

Work through SPEC §10 questions and either pick a default or document the
decision in `docs/decisions/` (MD with status, rationale, date).

Suggested defaults to commit (subject to user review):

- **Q1 (account recovery):** Google account only; surface re-auth link.
- **Q3 (household naming):** any adult member can propose rename, requires
  second adult to confirm.
- **Q4 (household merging):** admin-only merge with audit log entry.
- **Q6 (headcount minimum):** 1 (self only).
- **Q7 (waitlist):** yes, auto-promote on cancellation.
- **Q8 (RSVP closing):** auto-close at deadline, admin can extend by 24h.
- **Q9 (duplicate dishes):** allow; show conflict warning.
- **Q11 (EXIF):** strip GPS + camera serial + timestamps; keep dimensions.
- **Q12 (storage quota):** soft cap 500MB / household, hard cap 5GB / event.
- **Q15 (opt-in default):** opt-in EMAIL only; SMS requires explicit consent.

## Acceptance criteria

- Each open question has a decision entry in `docs/decisions/`.
- Decisions that change the schema are applied via Prisma migration.
- CHANGELOG reflects any breaking changes.

## Files

- `docs/decisions/*.md` (new directory + files)
- `SPEC.md` (mark each question as "Resolved: see ADR-NNN")
- Possibly `prisma/schema.prisma` + migration
