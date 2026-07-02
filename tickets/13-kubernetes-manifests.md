# Helm / Kubernetes manifests for deployment

## Status

Missing — `kubernetes/` directory is empty.

## Description

SPEC §7.1 requires Kubernetes deployment for Next.js, PostgreSQL, and
PhotoPrism. Today no manifests exist. CI has no deploy step.

Implement:

- `kubernetes/nextjs.yaml` — Deployment + Service + Ingress.
- `kubernetes/postgres.yaml` — StatefulSet + PVC + secret references.
- `kubernetes/photoprism.yaml` — Deployment + 50TB PVC + service.
- Optional: Kustomize overlay per environment (dev/prod).
- TLS via cert-manager.
- Sealed-secrets or External Secrets for `AUTH_GOOGLE_SECRET`,
  `DATABASE_URL`, etc.

## Acceptance criteria

- `kubectl apply -k kubernetes/overlays/dev` brings up a working stack.
- PVCs sized correctly (50TB for PhotoPrism).
- Resource requests/limits set, HPA on Next.js.
- Network policies restricting PhotoPrism egress.

## Files

- `kubernetes/nextjs.yaml` (create)
- `kubernetes/postgres.yaml` (create)
- `kubernetes/photoprism.yaml` (create)
- `kubernetes/overlays/dev/kustomization.yaml` (create)
- `.github/workflows/deploy.yml` (optional, create if asked)
