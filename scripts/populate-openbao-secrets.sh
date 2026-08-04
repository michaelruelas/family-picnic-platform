#!/usr/bin/env bash
#
# populate-openbao-secrets.sh
#
# Idempotently populates the OpenBao secret paths required by the
# family-picnic-dev ArgoCD Application. Runs `bao kv get` / `bao kv put`
# via `kubectl exec` into the openbao-0 pod, so no local OpenBao CLI is
# required.
#
# Precedence for each value: existing OpenBao > existing .env.dev > generate
# or empty. Re-running the script never wipes a value that is already set
# somewhere; it only fills in the gaps.
#
# Generated random values are also written to
# ./family-picnic-dev-secrets.txt (mode 0600, gitignored) so they can be
# referenced later. A matching ./.env.dev (mode 0600, gitignored) is kept
# in sync for `bun run dev` against a port-forwarded cluster.
#
# Usage:
#   ./scripts/populate-openbao-secrets.sh
#
# Env overrides:
#   OPENBAO_NAMESPACE  default: security
#   OPENBAO_POD        default: openbao-0
#   SECRET_PREFIX      default: secret/family-picnic-dev
#   LOCAL_OUTPUT       default: ./family-picnic-dev-secrets.txt
#   ENV_DEV_OUTPUT     default: ./.env.dev
#   APP_DOMAIN         default: family-picnic.dev.qubitquilt.dev
#   PHOTOS_DOMAIN      default: photos.family-picnic.dev.qubitquilt.dev

set -euo pipefail

OPENBAO_NAMESPACE="${OPENBAO_NAMESPACE:-security}"
OPENBAO_POD="${OPENBAO_POD:-openbao-0}"
SECRET_PREFIX="${SECRET_PREFIX:-secret/family-picnic-dev}"
LOCAL_OUTPUT="${LOCAL_OUTPUT:-./family-picnic-dev-secrets.txt}"
ENV_DEV_OUTPUT="${ENV_DEV_OUTPUT:-./.env.dev}"
APP_DOMAIN="${APP_DOMAIN:-family-picnic.dev.qubitquilt.dev}"
PHOTOS_DOMAIN="${PHOTOS_DOMAIN:-photos.family-picnic.dev.qubitquilt.dev}"

# --- preflight ---------------------------------------------------------------

if ! command -v kubectl >/dev/null 2>&1; then
  echo "ERROR: kubectl not found in PATH" >&2
  exit 1
fi

if ! command -v openssl >/dev/null 2>&1; then
  echo "ERROR: openssl not found in PATH" >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq not found in PATH" >&2
  exit 1
fi

if ! kubectl -n "$OPENBAO_NAMESPACE" get pod "$OPENBAO_POD" >/dev/null 2>&1; then
  echo "ERROR: pod $OPENBAO_POD not found in namespace $OPENBAO_NAMESPACE" >&2
  echo "Set OPENBAO_POD / OPENBAO_NAMESPACE if it lives elsewhere." >&2
  exit 1
fi

# --- helpers -----------------------------------------------------------------

bao_exec() {
  kubectl -n "$OPENBAO_NAMESPACE" exec -i "$OPENBAO_POD" -- bao "$@"
}

# bao_get_json <path>
# Prints the JSON body of an OpenBao KV v2 secret, or empty string if unset.
bao_get_json() {
  local path="$1"
  bao_exec kv get -format=json "$path" 2>/dev/null || true
}

# extract <json> <key>
# Pulls .data.data.<key> out of an OpenBao KV v2 response.
extract() {
  local json="$1" key="$2"
  [ -n "$json" ] || return 0
  printf '%s' "$json" | jq -r --arg k "$key" '.data.data[$k] // empty' 2>/dev/null || true
}

# env_dev_get <key>
# Reads <key>=... from $ENV_DEV_OUTPUT, stripping surrounding quotes.
env_dev_get() {
  local key="$1"
  [ -f "$ENV_DEV_OUTPUT" ] || return 0
  grep -E "^${key}=" "$ENV_DEV_OUTPUT" 2>/dev/null \
    | head -n 1 \
    | cut -d'=' -f2- \
    | sed -E "s/^['\"]|['\"]$//g" \
    || true
}

# resolve <openbao_value> <env_dev_value> <generator>
# Returns the first non-empty value, or runs the generator.
resolve() {
  local bao_val="$1" env_val="$2" generator="$3"
  if [ -n "$bao_val" ]; then
    printf '%s' "$bao_val"
  elif [ -n "$env_val" ]; then
    printf '%s' "$env_val"
  else
    eval "$generator"
  fi
}

gen_secret() {
  local bytes="${1:-32}"
  openssl rand -base64 "$bytes" 2>/dev/null | tr -d '/+=\n' | head -c "$bytes"
}

# --- read existing state -----------------------------------------------------

echo "==> Reading existing secrets from ${SECRET_PREFIX}/* and ${ENV_DEV_OUTPUT}"

POSTGRES_JSON=$(bao_get_json "${SECRET_PREFIX}/postgres")
NEXTJS_JSON=$(bao_get_json "${SECRET_PREFIX}/nextjs")
PHOTOPRISM_JSON=$(bao_get_json "${SECRET_PREFIX}/photoprism")

# Track which values were freshly generated so we can summarize at the end.
GENERATED=()
PRESERVED=()

# --- resolve each value ------------------------------------------------------

# Random-generated secrets: OpenBao > .env.dev > openssl rand
# External-service keys: OpenBao > .env.dev > empty (never auto-generate)

PG_PASS=$(resolve \
  "$(extract "$POSTGRES_JSON" password)" \
  "$(env_dev_get PG_PASS)" \
  "gen_secret 32")
if [ -n "$(extract "$POSTGRES_JSON" password)" ] || [ -n "$(env_dev_get PG_PASS)" ]; then
  PRESERVED+=("postgres/password")
else
  GENERATED+=("postgres/password")
fi

NEXTAUTH_SECRET=$(resolve \
  "$(extract "$NEXTJS_JSON" nextauth-secret)" \
  "$(env_dev_get NEXTAUTH_SECRET)" \
  "gen_secret 32")
if [ -n "$(extract "$NEXTJS_JSON" nextauth-secret)" ] || [ -n "$(env_dev_get NEXTAUTH_SECRET)" ]; then
  PRESERVED+=("nextjs/nextauth-secret")
else
  GENERATED+=("nextjs/nextauth-secret")
fi

PHOTOPRISM_ADMIN_PASS=$(resolve \
  "$(extract "$PHOTOPRISM_JSON" admin-password)" \
  "$(env_dev_get PHOTOPRISM_ADMIN_PASS)" \
  "gen_secret 16")
if [ -n "$(extract "$PHOTOPRISM_JSON" admin-password)" ] || [ -n "$(env_dev_get PHOTOPRISM_ADMIN_PASS)" ]; then
  PRESERVED+=("photoprism/admin-password")
else
  GENERATED+=("photoprism/admin-password")
fi

# External-service keys: never auto-generated.
AUTH_GOOGLE_ID=$(resolve \
  "$(extract "$NEXTJS_JSON" auth-google-id)" \
  "$(env_dev_get AUTH_GOOGLE_ID)" \
  "printf ''")
[ -n "$AUTH_GOOGLE_ID" ] && PRESERVED+=("nextjs/auth-google-id") || true

AUTH_GOOGLE_SECRET=$(resolve \
  "$(extract "$NEXTJS_JSON" auth-google-secret)" \
  "$(env_dev_get AUTH_GOOGLE_SECRET)" \
  "printf ''")
[ -n "$AUTH_GOOGLE_SECRET" ] && PRESERVED+=("nextjs/auth-google-secret") || true

SENDGRID_API_KEY=$(resolve \
  "$(extract "$NEXTJS_JSON" sendgrid-api-key)" \
  "$(env_dev_get SENDGRID_API_KEY)" \
  "printf ''")
[ -n "$SENDGRID_API_KEY" ] && PRESERVED+=("nextjs/sendgrid-api-key") || true

TWILIO_ACCOUNT_SID=$(resolve \
  "$(extract "$NEXTJS_JSON" twilio-account-sid)" \
  "$(env_dev_get TWILIO_ACCOUNT_SID)" \
  "printf ''")
[ -n "$TWILIO_ACCOUNT_SID" ] && PRESERVED+=("nextjs/twilio-account-sid") || true

TWILIO_AUTH_TOKEN=$(resolve \
  "$(extract "$NEXTJS_JSON" twilio-auth-token)" \
  "$(env_dev_get TWILIO_AUTH_TOKEN)" \
  "printf ''")
[ -n "$TWILIO_AUTH_TOKEN" ] && PRESERVED+=("nextjs/twilio-auth-token") || true

TWILIO_PHONE_NUMBER=$(resolve \
  "$(extract "$NEXTJS_JSON" twilio-phone-number)" \
  "$(env_dev_get TWILIO_PHONE_NUMBER)" \
  "printf ''")
[ -n "$TWILIO_PHONE_NUMBER" ] && PRESERVED+=("nextjs/twilio-phone-number") || true

# Stripe: sk_test_*/pk_test_*/whsec_*. Never auto-generated; the user must
# paste real test keys from the Stripe dashboard before payments can flow.
STRIPE_SECRET_KEY=$(resolve \
  "$(extract "$NEXTJS_JSON" stripe-secret-key)" \
  "$(env_dev_get STRIPE_SECRET_KEY)" \
  "printf ''")
[ -n "$STRIPE_SECRET_KEY" ] && PRESERVED+=("nextjs/stripe-secret-key") || true

STRIPE_PUBLISHABLE_KEY=$(resolve \
  "$(extract "$NEXTJS_JSON" stripe-publishable-key)" \
  "$(env_dev_get STRIPE_PUBLISHABLE_KEY)" \
  "printf ''")
[ -n "$STRIPE_PUBLISHABLE_KEY" ] && PRESERVED+=("nextjs/stripe-publishable-key") || true

STRIPE_WEBHOOK_SECRET=$(resolve \
  "$(extract "$NEXTJS_JSON" stripe-webhook-secret)" \
  "$(env_dev_get STRIPE_WEBHOOK_SECRET)" \
  "printf ''")
[ -n "$STRIPE_WEBHOOK_SECRET" ] && PRESERVED+=("nextjs/stripe-webhook-secret") || true

# DATABASE_URL: in-cluster form for OpenBao, localhost form for .env.dev.
# Each form is preserved independently if the user has set it.
IN_CLUSTER_DATABASE_URL="postgresql://postgres:${PG_PASS}@postgres:5432/familypicnic?schema=public"
DATABASE_URL=$(resolve \
  "$(extract "$NEXTJS_JSON" database-url)" \
  "" \
  "printf '%s' \"$IN_CLUSTER_DATABASE_URL\"")

LOCAL_DATABASE_URL=$(env_dev_get DATABASE_URL)
if [ -z "$LOCAL_DATABASE_URL" ]; then
  LOCAL_DATABASE_URL="postgresql://postgres:${PG_PASS}@localhost:5432/familypicnic-dev?schema=public"
fi

# --- write to OpenBao --------------------------------------------------------

echo "==> Writing ${SECRET_PREFIX}/postgres"
bao_exec kv put "${SECRET_PREFIX}/postgres" \
  password="$PG_PASS" \
  >/dev/null

echo "==> Writing ${SECRET_PREFIX}/nextjs"
bao_exec kv put "${SECRET_PREFIX}/nextjs" \
  database-url="$DATABASE_URL" \
  auth-google-id="$AUTH_GOOGLE_ID" \
  auth-google-secret="$AUTH_GOOGLE_SECRET" \
  nextauth-secret="$NEXTAUTH_SECRET" \
  sendgrid-api-key="$SENDGRID_API_KEY" \
  twilio-account-sid="$TWILIO_ACCOUNT_SID" \
  twilio-auth-token="$TWILIO_AUTH_TOKEN" \
  twilio-phone-number="$TWILIO_PHONE_NUMBER" \
  stripe-secret-key="$STRIPE_SECRET_KEY" \
  stripe-publishable-key="$STRIPE_PUBLISHABLE_KEY" \
  stripe-webhook-secret="$STRIPE_WEBHOOK_SECRET" \
  >/dev/null

echo "==> Writing ${SECRET_PREFIX}/photoprism"
bao_exec kv put "${SECRET_PREFIX}/photoprism" \
  admin-password="$PHOTOPRISM_ADMIN_PASS" \
  >/dev/null

# --- save local copy ---------------------------------------------------------

cat > "$LOCAL_OUTPUT" <<EOF
# Generated by scripts/populate-openbao-secrets.sh on $(date -u +%Y-%m-%dT%H:%M:%SZ)
# DO NOT COMMIT. Keep this file local.
#
PG_PASS=$PG_PASS
NEXTAUTH_SECRET=$NEXTAUTH_SECRET
PHOTOPRISM_ADMIN_PASS=$PHOTOPRISM_ADMIN_PASS
DATABASE_URL=$DATABASE_URL
EOF
chmod 600 "$LOCAL_OUTPUT"

# --- write .env.dev for local dev --------------------------------------------

cat > "$ENV_DEV_OUTPUT" <<EOF
# Generated by scripts/populate-openbao-secrets.sh on $(date -u +%Y-%m-%dT%H:%M:%SZ)
# Local dev .env. Matches the OpenBao values pushed to ${SECRET_PREFIX}/*.
#
# To use the in-cluster postgres, forward the service first:
#   kubectl port-forward svc/postgres 5432:5432 -n family-picnic-dev
#
# To use the in-cluster photoprism, forward it too:
#   kubectl port-forward svc/photoprism 2342:8080 -n family-picnic-dev

# --- Database ---
DATABASE_URL="$LOCAL_DATABASE_URL"

# --- NextAuth ---
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="${NEXTAUTH_SECRET}"

# --- Dev auth bypass (gated by DEV_AUTH_ENABLED) ---
DEV_AUTH_ENABLED=true
DEV_AUTH_USERNAME=admin
DEV_AUTH_PASSWORD="${PHOTOPRISM_ADMIN_PASS}"

# --- Google OAuth (leave empty for now) ---
AUTH_GOOGLE_ID="${AUTH_GOOGLE_ID}"
AUTH_GOOGLE_SECRET="${AUTH_GOOGLE_SECRET}"

# --- Twilio (leave empty) ---
TWILIO_ACCOUNT_SID="${TWILIO_ACCOUNT_SID}"
TWILIO_AUTH_TOKEN="${TWILIO_AUTH_TOKEN}"
TWILIO_PHONE_NUMBER="${TWILIO_PHONE_NUMBER}"

# --- SendGrid (leave empty) ---
SENDGRID_API_KEY="${SENDGRID_API_KEY}"
SENDGRID_FROM_EMAIL="dev@${APP_DOMAIN}"

# --- Stripe (leave empty until you paste real test keys) ---
STRIPE_SECRET_KEY="${STRIPE_SECRET_KEY}"
STRIPE_PUBLISHABLE_KEY="${STRIPE_PUBLISHABLE_KEY}"
STRIPE_WEBHOOK_SECRET="${STRIPE_WEBHOOK_SECRET}"

# --- S3 (using photoprism via Next.js; no S3 in dev) ---
S3_ENDPOINT=""
S3_BUCKET="family-picnic-dev"
S3_ACCESS_KEY=""
S3_SECRET_KEY=""
S3_PUBLIC_URL=""

# --- PhotoPrism ---
PHOTOPRISM_URL="http://localhost:2342"
PHOTOPRISM_API_KEY="${PHOTOPRISM_ADMIN_PASS}"

# --- Observability ---
LOG_LEVEL=debug
SENTRY_DSN=""
OTEL_EXPORTER_OTLP_ENDPOINT=""

# --- Cron ---
CRON_SECRET="${NEXTAUTH_SECRET}"
EOF
chmod 600 "$ENV_DEV_OUTPUT"

# --- summary -----------------------------------------------------------------

echo ""
echo "==> All three OpenBao paths written under ${SECRET_PREFIX}"
echo "==> Raw values: $LOCAL_OUTPUT (mode 0600)"
echo "==> .env.dev:   $ENV_DEV_OUTPUT (mode 0600)"
echo ""

if [ "${#GENERATED[@]}" -gt 0 ]; then
  echo "Generated (new):"
  for k in "${GENERATED[@]}"; do
    echo "  + $k"
  done
fi

if [ "${#PRESERVED[@]}" -gt 0 ]; then
  echo "Preserved (already set):"
  for k in "${PRESERVED[@]}"; do
    echo "  = $k"
  done
fi

echo ""
echo "Next steps:"
echo "  1. Forward cluster services to localhost:"
echo "       kubectl port-forward svc/postgres 5432:5432 -n family-picnic-dev &"
echo "       kubectl port-forward svc/photoprism 2342:8080 -n family-picnic-dev &"
echo "  2. Force the ExternalSecret to refresh (or wait up to 1m):"
echo "       kubectl annotate externalsecret -n family-picnic-dev --all force-sync=\$(date +%s)"
echo "  3. Watch the pods come up:"
echo "       kubectl get pods -n family-picnic-dev -w"
echo "  4. Visit https://${APP_DOMAIN}"
