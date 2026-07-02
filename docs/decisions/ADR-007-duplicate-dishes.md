# ADR-007: Duplicate Potluck Dishes

## Status

Accepted

## Context

SPEC §10 Q9 asks: Should we allow duplicate dishes (e.g., two families bring potato salad)?

Duplicate dishes could lead to food waste, but restricting them creates friction and removes family autonomy.

## Decision

Allow duplicate dishes. Display a conflict warning to users when a similar dish already exists.

### Rationale

1. Reduces friction in potluck signup process
2. Families may intentionally want to bring the same dish (backup)
3. Warning instead of restriction respects family autonomy
4. Real-world potlucks often have duplicate dishes

### Implementation Notes

- Fuzzy matching on dish names (e.g., "Potato Salad" matches "Potato Salad")
- Show warning: "Another family is bringing Potato Salad. Consider a different dish?"
- User can dismiss warning and proceed anyway
- No hard blocking - user choice is final

## Consequences

- May lead to more duplicate dishes than in a strict system
- Need fuzzy matching algorithm (can use Levenshtein distance or similar)
- Warning fatigue if duplicates are common

## Related

- SPEC §10 Q9
- PotluckSignup model
