# Kubernetes Manifests

Kubernetes manifests for the Family Picnic Platform deployment.

## Structure

```
kubernetes/
├── kustomization.yaml       # Base Kustomize configuration
├── namespace.yaml           # Family Picnic namespace with PSS restricted
├── nextjs.yaml              # Next.js app: Deployment, Service, Ingress, HPA, PDB, NetworkPolicy
├── postgres.yaml            # PostgreSQL: StatefulSet, headless Service, PVC, Secret, PDB
├── photoprism.yaml          # PhotoPrism: Deployment, Service, 50TB PVC, Secret, PDB
├── env.base                 # Base environment variables (non-sensitive)
├── secrets.base             # Base secrets template (gitignored, fill before deploy)
└── overlays/
    └── dev/
        ├── kustomization.yaml   # Dev overlay
        ├── nextjs-patch.yaml    # Dev Next.js patches (1 replica, lower resources)
        ├── postgres-patch.yaml  # Dev PostgreSQL patches (1 replica)
        ├── photoprism-patch.yaml # Dev PhotoPrism patches
        ├── env.dev              # Dev environment variables
        └── secrets.dev          # Dev secrets template
```

## Prerequisites

- Kubernetes 1.27+
- Ingress controller (nginx-ingress recommended)
- cert-manager for TLS certificates
- StorageClass `gp3-encrypted` for encrypted volumes
- StorageClass `standard-longhorn` for PhotoPrism 50TB volume

## Quick Start

### 1. Install dependencies

```bash
# Install nginx-ingress controller
helm install nginx-ingress ingress-nginx/ingress-nginx --namespace ingress-nginx --create-namespace

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

### 2. Configure secrets

Fill in your actual secrets in `overlays/dev/secrets.dev` or create a production secrets file:

```bash
# Option 1: Use secretGenerator (Kustomize)
# Edit secrets.dev with your actual values

# Option 2: Create secrets manually
kubectl create secret generic nextjs-secrets \
  --from-literal=AUTH_GOOGLE_ID=your-google-client-id \
  --from-literal=AUTH_GOOGLE_SECRET=your-google-secret \
  --from-literal=NEXTAUTH_SECRET=your-32-char-secret \
  --from-literal=SENDGRID_API_KEY=your-sendgrid-key \
  --from-literal=TWILIO_ACCOUNT_SID=your-twilio-sid \
  --from-literal=TWILIO_AUTH_TOKEN=your-twilio-token \
  --namespace=family-picnic-dev

kubectl create secret generic postgres-credentials \
  --from-literal=password=your-secure-db-password \
  --namespace=family-picnic-dev
```

### 3. Deploy to dev

```bash
# Using Kustomize
kubectl apply -k kubernetes/overlays/dev

# Or build and apply
kustomize build kubernetes/overlays/dev | kubectl apply -f -
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

## Backup

See `scripts/backup.sh` for database backup procedures.
