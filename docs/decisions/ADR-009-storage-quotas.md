# ADR-009: Photo Storage Quotas

## Status

Accepted

## Context

SPEC §10 Q12 asks: Should we have per-household or per-event storage quotas?

Unlimited photo storage could lead to abuse. Need fair limits that accommodate family events.

## Decision

Implement two-tier storage quotas:
- Soft cap: 500MB per household
- Hard cap: 5GB per event (total across all households)

### Rationale

1. Soft cap encourages cleanup without hard blocking
2. Hard cap per event ensures fair resource distribution
3. 500MB accommodates ~100-200 photos per household
4. 5GB per event is sufficient for most family gatherings

### Implementation Notes

- Track storage usage via database aggregation
- Show usage meter in photo upload UI
- When approaching soft cap (450MB), show warning
- At soft cap, allow upload but show persistent warning
- At hard cap, block new uploads - admin must delete photos
- Deleted photos free up quota immediately

## Consequences

- Need storage tracking in Photo model or separate metrics
- UI must show current quota usage
- Hard cap blocking may frustrate users at large events
- Consider implementing photo deletion for quota management

## Related

- SPEC §10 Q12
- Photo model
- S3 storage configuration
