# Observability: logging, metrics, tracing

## Status

Missing — no structured logging, no metrics, no tracing. SPEC §10 Q19
flags "Monitoring: What alerts are required for production?" as
unresolved.

## Description

Today every API route does `console.error(...)` on failure. No metrics,
no correlation IDs, no tracing. Production debugging will be painful.

Implement:

- Structured logger (`pino` or `winston`) wrapping Prisma + tRPC.
- Per-request correlation ID (UUID) injected into logs.
- OpenTelemetry exporter (OTLP) for traces — even if backend isn't
  deployed, traces can be emitted to console in dev.
- Sentry for error reporting.
- Prometheus-friendly metrics endpoint or OTLP metrics export:
  - `rsvp.create.count`
  - `potluck.signup.count`
  - `communication.send.count`
  - `photo.upload.bytes`

## Acceptance criteria

- Every log line is JSON with `requestId`, `userId`, `route`.
- Sentry receives errors from server actions and API routes.
- Traces visible in dev tools.

## Files

- `src/lib/logger.ts` (create)
- `src/lib/tracing.ts` (create)
- `src/app/api/**` (replace console.error)
- `src/server/routers/**` (instrument)
- `.env.example` (add `SENTRY_DSN`, `OTEL_EXPORTER_OTLP_ENDPOINT`)
