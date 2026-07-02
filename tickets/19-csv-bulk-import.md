# CSV bulk import for households + invitations

## Status

Missing — SPEC §9 lists "Admin bulk CSV import" as post-MVP High priority.

## Description

Today households and users are created one at a time via Google OAuth sign-in.
For seeding an annual picnic, admins need to bulk-load ~50–200 households
from a spreadsheet.

Implement:

- `POST /api/admin/csv-import` (or tRPC `admin.csvImport`).
- Expected columns: `household_name, primary_email, primary_name, member2_email, member2_name, ...`
- Validates each row, surfaces row-level errors with line numbers.
- Sends invitation emails/SMS in batches (rate-limited).
- Writes `AdminAuditLog` entry with summary counts.

## Acceptance criteria

- 100-row CSV imports in < 30 s.
- Partial failures are reported, not silent.
- Dry-run mode produces a report without mutating DB.
- File upload UI on `/admin/invitations` with column-mapping helper.

## Files

- `src/server/routers/admin.ts` (`csvImport` procedure)
- `src/components/admin/CsvUploader.tsx` (create)
- `src/lib/csv-parser.ts` (create — use `papaparse` or `csv-parse`)
- `tests/integration/csv-import.test.ts` (create)
