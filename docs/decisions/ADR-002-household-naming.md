# ADR-002: Household Naming

## Status

Accepted

## Context

SPEC §10 Q3 asks: Who can rename a household? What if family members disagree on the name?

Households represent families and should have meaningful names. However, allowing any member to rename could cause confusion or conflict.

## Decision

Any adult member can propose a household name change. The change requires a second adult member to confirm before it takes effect.

### Rationale

1. Prevents unilateral changes by single household members
2. Encourages family discussion about household identity
3. Provides a clear conflict resolution mechanism
4. Still allows a single member to initiate the process

### Implementation Notes

- Store `proposedName` and `proposedNameConfirmedBy` in Household model
- Require at least 2 adult members for rename operations
- If household has only 1 adult, allow unilateral rename with confirmation dialog
- Add notification to household members when rename is proposed

## Consequences

- Requires confirmation workflow in household management UI
- May delay renaming if second adult is unavailable
- Need to handle edge case of single-member households

## Related

- SPEC §10 Q3
- Household model
