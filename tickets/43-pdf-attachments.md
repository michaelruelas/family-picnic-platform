# FPP-43 — Allow PDF attachments to events

Track the parent ticket and its sub-tickets. Each sub-ticket closes independently
so reviewers can scope a PR.

## Status

| Sub-ticket | Title                | Status |
| ---------- | -------------------- | ------ |
| FPP-3      | Storage decision     | Done   |
| FPP-2      | Admin upload UI      | Done   |
| FPP-1      | Public download link | Done   |

## Storage decision (FPP-3)

**Chosen provider: S3-compatible storage (existing `src/lib/s3.ts`).**

The platform already has an S3-compatible client (`@aws-sdk/client-s3`) wired
into the photo upload flow. The same client works against AWS S3, Cloudflare
R2, Supabase Storage (S3-compat mode), and MinIO by configuring:

- `AWS_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `S3_BUCKET_NAME`
- `S3_ENDPOINT` (optional, for R2 / Supabase / MinIO)

### Decision criteria

| Criterion          | AWS S3           | Cloudflare R2 | Supabase Storage |
| ------------------ | ---------------- | ------------- | ---------------- |
| Egress fees        | Per GB           | **Zero**      | Per GB           |
| Signed URL support | Yes              | Yes           | Yes (S3-compat)  |
| Existing footprint | **Yes** (photos) | No            | No               |
| Vendor lock-in     | AWS              | Cloudflare    | Supabase         |
| Compliance         | SOC2, etc.       | SOC2          | SOC2             |

### Rationale

1. **Existing footprint.** Photos already use `src/lib/s3.ts`. Picking the same
   provider means zero new SDK, zero new secrets to plumb through OpenBao, and
   one less auth surface to audit. QUB-16 (featured image) reuses this same
   bucket.
2. **Egress.** Family-picnic traffic is small (a few hundred guests, mostly
   text + small images + occasional PDF). Egress cost is negligible against
   the engineering cost of introducing a second storage surface.
3. **R2 reserved as a future option.** When QUB-16 lands and traffic justifies
   the swap, the only change is `S3_ENDPOINT` + bucket name. No code
   refactor.

### Acceptance criteria

- [x] One option chosen (existing S3-compatible storage).
- [x] Choice recorded in this ticket.
- [x] Next ticket (FPP-2) proceeds against the chosen storage.

## FPP-2 — Admin upload UI

**Done.**

- Admin event form (`/admin/events/[id]/edit`) renders a new `PDF Attachments`
  section with a file picker and per-attachment delete + rename affordances.
- Server validates the PDF MIME (`application/pdf`) and a 10 MB max size.
- Files are uploaded via a presigned URL against the existing S3-compatible
  bucket. The admin's `uploadedByUserId` is recorded for audit.
- A `virusScanStatus` column is added on the row and queued as a stub — the
  first ship logs the scan request and marks the row `SKIPPED` without an
  actual scan worker.

## FPP-1 — Public download link

**Done.**

- Public event page (`/events/[id]`) renders a `Downloads` block in the
  Header tab with one download link per attachment. Block is hidden when no
  PDFs are attached.
- `GET /api/public/event-attachments/[id]/download` issues a 302 redirect to
  a short-lived presigned URL. Rate-limited to **10 requests / minute per IP**
  via `src/lib/rate-limit.ts` (new `checkPdfDownloadRateLimit` helper).
- PDF metadata (filename, byte size) is exposed to the page so guests see a
  human label ("Directions.pdf · 1.2 MB") instead of the raw S3 key.
