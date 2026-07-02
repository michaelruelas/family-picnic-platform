# ADR-003: Household Merging

## Status

Accepted

## Context

SPEC §10 Q4 asks: Should we support merging two households if families combine?

When families merge (e.g., through marriage), combining households in the system would provide a cleaner data model.

## Decision

Admin-only household merge with mandatory audit log entry. The merge operation is irreversible and logged with full details.

### Rationale

1. Prevents accidental household merges by regular users
2. Provides traceability for compliance and debugging
3. Admin can verify the merge is intentional and correct
4. Audit trail allows rollback planning if needed

### Implementation Notes

- Only ADMIN role can initiate household merge
- Requires selecting source and target household
- All users/dependents from source are moved to target
- Source household is soft-deleted (retained for historical RSVPs)
- All RSVPs are preserved and linked to new household
- Create AdminAuditLog entry with before/after state

## Consequences

- Requires admin UI for household merge operation
- Need to handle conflicts (duplicate emails, etc.)
- Historical data becomes harder to follow after merge
- Cannot easily undo merge

## Related

- SPEC §10 Q4
- AdminAuditLog model
- Household model
