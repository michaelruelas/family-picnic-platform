# Kubernetes Manifests

Kubernetes manifests for the Family Picnic Platform deployment.

## Structure

```
kubernetes/
├── base/
│   ├── kustomization.yaml       # Base Kustomize configuration
│   ├── namespace.yaml           # Family Picnic namespace with PSS restricted
│   ├── nextjs.yaml              # Next.js app: Deployment, Service, Ingress, HPA, PDB, NetworkPolicy
│   ├── postgres.yaml            # PostgreSQL: StatefulSet, headless Service, PVC, Secret, PDB
│   ├── photoprism.yaml          # PhotoPrism: Deployment, Service, 50TB PVC, Secret, PDB
│   ├── configmap.yaml           # Base environment variables (non-sensitive)
│   └── ingressroute.yaml        # Traefik IngressRoute
└── overlays/
    └── pugquilt-dev/
        ├── kustomization.yaml       # Dev overlay
        ├── nextjs-patch.yaml        # Dev Next.js patches (1 replica, lower resources)
        ├── postgres-patch.yaml      # Dev PostgreSQL patches (1 replica)
        ├── photoprism-patch.yaml    # Dev PhotoPrism patches
        ├── pvc-patch.yaml           # Dev PVC patches (local-path storage)
        ├── external-secrets.yaml    # Dev ExternalSecret → OpenBao paths under secret/family-picnic-dev/*
        ├── patches/
        │   └── probes-patch.yaml    # Dev Next.js probe tweaks
        └── patches/
            └── postgres-netpol-patch.yaml  # Dev Postgres NetworkPolicy patch
```

> SeaweedFS is **not** in this repo. It's deployed by the official Helm chart
> via ArgoCD — see `homelab-infra/clusters/pugquilt/argocd-applications/pugquilt-platform-seaweedfs.yaml`.
> This repo only carries the ExternalSecret that hydrates the chart's
> `s3.existingConfigSecret`.

## Prerequisites

- Kubernetes 1.27+
- Ingress controller (nginx-ingress recommended)
- cert-manager for TLS certificates
- StorageClass `gp3-encrypted` for encrypted volumes
- StorageClass `standard-longhorn` for PhotoPrism 50TB volume
- Traefik `IngressRoute` CRDs (the chart already installs them)

## Quick Start

### 1. Install dependencies

```bash
# Install External Secrets Operator (required for the ExternalSecret resources)
helm install external-secrets external-secrets/external-secrets --namespace external-secrets --create-namespace

# Install cert-manager
helm install cert-manager jetstack/cert-manager --namespace cert-manager --create-namespace --set installCRDs=true

# Create ClusterIssuer for Let's Encrypt
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: your-email@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
      - http01:
          ingress:
            class: nginx
EOF
```

### 2. Configure secrets (OpenBao)

Secrets are pulled from OpenBao via the External Secrets Operator. The `external-secrets.yaml` in each overlay declares the vault paths to use; a future `pugquilt-prod` overlay will reference `secret/family-picnic-prod/*` instead.

Use the idempotent populate script — it reads existing values first and only generates/pushes what's missing:

```bash
./scripts/populate-openbao-secrets.sh
```

Precedence for each value: existing OpenBao > existing `.env.dev` > generate or empty. Re-running never wipes a value that's already set. Workflow:

```bash
# 1. First run: generates random secrets, writes OpenBao + .env.dev
./scripts/populate-openbao-secrets.sh

# 2. Edit .env.dev with real Google/Twilio/SendGrid keys
$EDITOR .env.dev

# 3. Re-run to push your edits to OpenBao (preserves the random secrets)
./scripts/populate-openbao-secrets.sh
```

Requires `kubectl`, `openssl`, and `jq` locally. The script talks to OpenBao via `kubectl exec` into the `openbao-0` pod in the `security` namespace (override with `OPENBAO_POD` / `OPENBAO_NAMESPACE`).

### 3. Deploy to dev

```bash
# Using Kustomize
kubectl apply -k kubernetes/overlays/pugquilt-dev

# Or build and apply
kustomize build kubernetes/overlays/pugquilt-dev | kubectl apply -f -
```

### 4. Verify deployment

```bash
# Check pods
kubectl get pods -n family-picnic-dev

# Check services
kubectl get svc -n family-picnic-dev

# Check ingress
kubectl get ingress -n family-picnic-dev

# Follow logs
kubectl logs -n family-picnic-dev -l app.kubernetes.io/name=nextjs -f
```

## Production Deployment

1. Create a production overlay in `overlays/prod/`
2. Update secrets with real credentials
3. Increase replica counts and resource limits
4. Use a proper storage class for production
5. Configure proper TLS with cert-manager ClusterIssuer

## Network Policies

Each component has a NetworkPolicy that:

- Allows only required ingress traffic
- Restricts egress to necessary destinations only
- PhotoPrism egress is restricted to prevent data exfiltration

## Health Checks

- Next.js: `/api/health` endpoint
- PostgreSQL: `pg_isready` command
- PhotoPrism: `/api/v1/session` endpoint

## Scaling

- Next.js: HPA configured, min 2 replicas, max 10
- PostgreSQL: Manual scaling with `kubectl scale statefulset postgres --replicas=N`
- PhotoPrism: Single replica (uses PersistentVolume)
- SeaweedFS: Single replica (single bucket, low traffic); scale later by adding volume servers

## S3-Compatible Storage (SeaweedFS)

Photo uploads go through a SeaweedFS S3 gateway exposed at
`i.foliapicnic.com`. The bucket `family-picnic-photos` is public-read so the
URL stored in the DB renders directly in the browser without a presigned GET.

The cluster workload is managed by the official SeaweedFS Helm chart via
ArgoCD — see `clusters/pugquilt/argocd-applications/pugquilt-platform-seaweedfs.yaml`
in the `homelab-infra` repo. This repo only carries the ExternalSecret that
hydrates the chart's `s3.existingConfigSecret`:

- `kubernetes/overlays/pugquilt-dev/external-secrets.yaml` →
  `seaweedfs-credentials` ExternalSecret
- OpenBao path: `secret/family-picnic-dev/seaweedfs` — properties
  `access-key-id`, `secret-access-key`, `bucket-name`, and the rendered
  `s3-config-json` identity file. The JSON is generated by
  `scripts/populate-openbao-secrets.sh` so the chart's `existingConfigSecret`
  sees the right key on first sync.
- The chart's `s3.createBuckets` plus `anonymousRead: true` creates the
  bucket and attaches the public-read policy on install — no bootstrap Job
  needed in this repo.

## Backup

See `scripts/backup.sh` for database backup procedures.
