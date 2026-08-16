#!/usr/bin/env bash
#
# populate-openbao-secrets.sh
#
# Idempotently populates the OpenBao secret paths required by the
# family-picnic-{env} cluster(s). Runs `bao kv get` / `bao kv put` via
# `kubectl exec` into the openbao-0 pod, so no local OpenBao CLI is
# required.
#
# Precedence for each value: existing OpenBao > existing .env.dev > generate
# or empty. Re-running the script never wipes a value that is already set
# somewhere; it only fills in the gaps.
#
# Generated random values are also written to
# ./${LOCAL_OUTPUT} (mode 0600, gitignored) so they can be referenced
# later. A matching ./.env.dev (mode 0600, gitignored) is kept in sync for
# `bun run dev` against a port-forwarded cluster.
#
# Usage:
#   ./scripts/populate-openbao-secrets.sh                # defaults to dev
#   ./scripts/populate-openbao-secrets.sh prod           # explicit env
#   ./scripts/populate-openbao-secrets.sh dev --export-patch  # print bao kv patch commands
#
# Env overrides:
#   TARGET_ENV        default: dev (accepts: dev|stage|prod)
#   EXPORT_PATCH      default: false (set to true or use --export-patch)
#   OPENBAO_NAMESPACE  default: security
#   OPENBAO_POD        default: openbao-0
#   SECRET_PREFIX      default: secret/family-picnic-${TARGET_ENV}
#   LOCAL_OUTPUT       default: ./family-picnic-${TARGET_ENV}-secrets.txt
#   ENV_DEV_OUTPUT     default: ./.env.dev
#   APP_DOMAIN         default: foliapicnic.com (ignored unless TARGET_ENV=dev)
#   PHOTOS_DOMAIN      default: photos.foliapicnic.com (ignored unless TARGET_ENV=dev)

set -euo pipefail

TARGET_ENV="${1:-${TARGET_ENV:-dev}}"
EXPORT_PATCH="${EXPORT_PATCH:-false}"

for arg in "$@"; do
  case "$arg" in
    --export-patch|--print-patch|--patch|-p)
      EXPORT_PATCH=true
      ;;
  esac
done

if [ "$TARGET_ENV" = "--export-patch" ] || [ "$TARGET_ENV" = "--print-patch" ] || [ "$TARGET_ENV" = "--patch" ] || [ "$TARGET_ENV" = "-p" ]; then
  TARGET_ENV="dev"
fi

case "$TARGET_ENV" in
  dev|stage|prod) ;;
  *)
    echo "ERROR: TARGET_ENV must be one of dev|stage|prod (got '$TARGET_ENV')" >&2
    exit 1
    ;;
esac

OPENBAO_NAMESPACE="${OPENBAO_NAMESPACE:-security}"
OPENBAO_POD="${OPENBAO_POD:-openbao-0}"
SECRET_PREFIX="${SECRET_PREFIX:-secret/family-picnic-$TARGET_ENV}"
LOCAL_OUTPUT="${LOCAL_OUTPUT:-./family-picnic-$TARGET_ENV-secrets.txt}"
ENV_DEV_OUTPUT="${ENV_DEV_OUTPUT:-./.env.dev}"
APP_DOMAIN="${APP_DOMAIN:-foliapicnic.com}"
PHOTOS_DOMAIN="${PHOTOS_DOMAIN:-photos.foliapicnic.com}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/openbao.sh
. "$SCRIPT_DIR/lib/openbao.sh"

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

if [ "$EXPORT_PATCH" != "true" ]; then
  if ! kubectl -n "$OPENBAO_NAMESPACE" get pod "$OPENBAO_POD" >/dev/null 2>&1; then
    echo "ERROR: pod $OPENBAO_POD not found in namespace $OPENBAO_NAMESPACE" >&2
    echo "Set OPENBAO_POD / OPENBAO_NAMESPACE if it lives elsewhere." >&2
    exit 1
  fi
fi

# --- script-local helpers -----------------------------------------------------

# env_dev_get <key>
# Reads <key>=... from $ENV_DEV_OUTPUT or fallback .env files, stripping surrounding quotes.
env_dev_get() {
  local key="$1"
  local val=""
  if [ -f "$ENV_DEV_OUTPUT" ]; then
    val=$(grep -E "^${key}=" "$ENV_DEV_OUTPUT" 2>/dev/null | head -n 1 | cut -d'=' -f2- | sed -E "s/^['\"]|['\"]$//g" || true)
  fi
  if [ -z "$val" ] && [ -f ".env.${TARGET_ENV}" ]; then
    val=$(grep -E "^${key}=" ".env.${TARGET_ENV}" 2>/dev/null | head -n 1 | cut -d'=' -f2- | sed -E "s/^['\"]|['\"]$//g" || true)
  fi
  if [ -z "$val" ] && [ -f ".env" ]; then
    val=$(grep -E "^${key}=" ".env" 2>/dev/null | head -n 1 | cut -d'=' -f2- | sed -E "s/^['\"]|['\"]$//g" || true)
  fi
  printf '%s' "$val"
}

escape_val() {
  local v="$1"
  v="${v//$'\n'/\\n}"
  printf '%s' "$v"
}

print_patch_cmd() {
  local path="$1"
  shift
  local args=("$@")
  local valid_args=()
  for item in "${args[@]}"; do
    if [ -n "$item" ]; then
      valid_args+=("$item")
    fi
  done
  if [ "${#valid_args[@]}" -eq 0 ]; then
    return 0
  fi
  printf 'kubectl -n %s exec -i %s -- env BAO_TOKEN="${BAO_TOKEN:-<your-root-token>}" bao kv patch %s' "$OPENBAO_NAMESPACE" "$OPENBAO_POD" "$path"
  for item in "${valid_args[@]}"; do
    printf ' \\\n  %s' "$item"
  done
  printf '\n'
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

AUTH_APPLE_ID=$(resolve \
  "$(extract "$NEXTJS_JSON" auth-apple-id)" \
  "$(env_dev_get AUTH_APPLE_ID)" \
  "printf ''")
[ -n "$AUTH_APPLE_ID" ] && PRESERVED+=("nextjs/auth-apple-id") || true

AUTH_APPLE_TEAM_ID=$(resolve \
  "$(extract "$NEXTJS_JSON" auth-apple-team-id)" \
  "$(env_dev_get AUTH_APPLE_TEAM_ID)" \
  "printf ''")
[ -n "$AUTH_APPLE_TEAM_ID" ] && PRESERVED+=("nextjs/auth-apple-team-id") || true

AUTH_APPLE_KEY_ID=$(resolve \
  "$(extract "$NEXTJS_JSON" auth-apple-key-id)" \
  "$(env_dev_get AUTH_APPLE_KEY_ID)" \
  "printf ''")
[ -n "$AUTH_APPLE_KEY_ID" ] && PRESERVED+=("nextjs/auth-apple-key-id") || true

AUTH_APPLE_PRIVATE_KEY=$(resolve \
  "$(extract "$NEXTJS_JSON" auth-apple-private-key)" \
  "$(env_dev_get AUTH_APPLE_PRIVATE_KEY)" \
  "printf ''")
[ -n "$AUTH_APPLE_PRIVATE_KEY" ] && PRESERVED+=("nextjs/auth-apple-private-key") || true

AUTH_FACEBOOK_ID=$(resolve \
  "$(extract "$NEXTJS_JSON" auth-facebook-id)" \
  "$(env_dev_get AUTH_FACEBOOK_ID)" \
  "printf ''")
[ -n "$AUTH_FACEBOOK_ID" ] && PRESERVED+=("nextjs/auth-facebook-id") || true

AUTH_FACEBOOK_SECRET=$(resolve \
  "$(extract "$NEXTJS_JSON" auth-facebook-secret)" \
  "$(env_dev_get AUTH_FACEBOOK_SECRET)" \
  "printf ''")
[ -n "$AUTH_FACEBOOK_SECRET" ] && PRESERVED+=("nextjs/auth-facebook-secret") || true

NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=$(resolve \
  "$(extract "$NEXTJS_JSON" google-maps-api-key)" \
  "$(env_dev_get NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)" \
  "printf ''")
[ -n "$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY" ] && PRESERVED+=("nextjs/google-maps-api-key") || true

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

# STRIPE_API_KEY is bootstrap-only (used by scripts/setup-stripe-webhook.sh
# to register the webhook endpoint). It is intentionally NOT pushed to
# OpenBao or wired into the cluster secret — the runtime app never reads
# it. We only round-trip it via .env.dev for convenience.
STRIPE_API_KEY=$(resolve \
  "" \
  "$(env_dev_get STRIPE_API_KEY)" \
  "printf ''")

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

# --- export patch mode -------------------------------------------------------

if [ "$EXPORT_PATCH" = "true" ]; then
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

# --- Apple OAuth (leave empty for now) ---
AUTH_APPLE_ID="${AUTH_APPLE_ID}"
AUTH_APPLE_TEAM_ID="${AUTH_APPLE_TEAM_ID}"
AUTH_APPLE_KEY_ID="${AUTH_APPLE_KEY_ID}"
AUTH_APPLE_PRIVATE_KEY="${AUTH_APPLE_PRIVATE_KEY}"

# --- Facebook OAuth (leave empty for now) ---
AUTH_FACEBOOK_ID="${AUTH_FACEBOOK_ID}"
AUTH_FACEBOOK_SECRET="${AUTH_FACEBOOK_SECRET}"

# --- Google Maps ---
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="${NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}"

# --- Twilio (leave empty) ---
TWILIO_ACCOUNT_SID="${TWILIO_ACCOUNT_SID}"
TWILIO_AUTH_TOKEN="${TWILIO_AUTH_TOKEN}"
TWILIO_PHONE_NUMBER="${TWILIO_PHONE_NUMBER}"

# --- SendGrid (leave empty) ---
SENDGRID_API_KEY="${SENDGRID_API_KEY}"
SENDGRID_FROM_EMAIL="dev@${APP_DOMAIN}"

# --- Stripe (leave empty until you paste real test keys) ---
# STRIPE_*_KEY values are used at runtime by the Next.js app; STRIPE_API_KEY
# is bootstrap-only — it lets scripts/setup-stripe-webhook.sh register the
# webhook endpoint without re-pasting the key each run.
STRIPE_SECRET_KEY="${STRIPE_SECRET_KEY}"
STRIPE_PUBLISHABLE_KEY="${STRIPE_PUBLISHABLE_KEY}"
STRIPE_WEBHOOK_SECRET="${STRIPE_WEBHOOK_SECRET}"
STRIPE_API_KEY="${STRIPE_API_KEY}"

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

  echo "================================================================================"
  echo "OpenBao kv patch command(s) for ${TARGET_ENV} (${SECRET_PREFIX})"
  echo "================================================================================"
  echo ""
  echo "# 1. Patch Next.js Application Secrets:"
  nextjs_patch_args=()
  [ -n "$DATABASE_URL" ] && nextjs_patch_args+=("database-url=\"$DATABASE_URL\"")
  [ -n "$AUTH_GOOGLE_ID" ] && nextjs_patch_args+=("auth-google-id=\"$AUTH_GOOGLE_ID\"")
  [ -n "$AUTH_GOOGLE_SECRET" ] && nextjs_patch_args+=("auth-google-secret=\"$AUTH_GOOGLE_SECRET\"")
  [ -n "$AUTH_APPLE_ID" ] && nextjs_patch_args+=("auth-apple-id=\"$AUTH_APPLE_ID\"")
  [ -n "$AUTH_APPLE_TEAM_ID" ] && nextjs_patch_args+=("auth-apple-team-id=\"$AUTH_APPLE_TEAM_ID\"")
  [ -n "$AUTH_APPLE_KEY_ID" ] && nextjs_patch_args+=("auth-apple-key-id=\"$AUTH_APPLE_KEY_ID\"")
  [ -n "$AUTH_APPLE_PRIVATE_KEY" ] && nextjs_patch_args+=("auth-apple-private-key=\"$(escape_val "$AUTH_APPLE_PRIVATE_KEY")\"")
  [ -n "$AUTH_FACEBOOK_ID" ] && nextjs_patch_args+=("auth-facebook-id=\"$AUTH_FACEBOOK_ID\"")
  [ -n "$AUTH_FACEBOOK_SECRET" ] && nextjs_patch_args+=("auth-facebook-secret=\"$AUTH_FACEBOOK_SECRET\"")
  [ -n "$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY" ] && nextjs_patch_args+=("google-maps-api-key=\"$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY\"")
  [ -n "$NEXTAUTH_SECRET" ] && nextjs_patch_args+=("nextauth-secret=\"$NEXTAUTH_SECRET\"")
  [ -n "$SENDGRID_API_KEY" ] && nextjs_patch_args+=("sendgrid-api-key=\"$SENDGRID_API_KEY\"")
  [ -n "$TWILIO_ACCOUNT_SID" ] && nextjs_patch_args+=("twilio-account-sid=\"$TWILIO_ACCOUNT_SID\"")
  [ -n "$TWILIO_AUTH_TOKEN" ] && nextjs_patch_args+=("twilio-auth-token=\"$TWILIO_AUTH_TOKEN\"")
  [ -n "$TWILIO_PHONE_NUMBER" ] && nextjs_patch_args+=("twilio-phone-number=\"$TWILIO_PHONE_NUMBER\"")
  [ -n "$STRIPE_SECRET_KEY" ] && nextjs_patch_args+=("stripe-secret-key=\"$STRIPE_SECRET_KEY\"")
  [ -n "$STRIPE_PUBLISHABLE_KEY" ] && nextjs_patch_args+=("stripe-publishable-key=\"$STRIPE_PUBLISHABLE_KEY\"")
  [ -n "$STRIPE_WEBHOOK_SECRET" ] && nextjs_patch_args+=("stripe-webhook-secret=\"$STRIPE_WEBHOOK_SECRET\"")
  print_patch_cmd "${SECRET_PREFIX}/nextjs" "${nextjs_patch_args[@]}"

  echo ""
  echo "# 2. Patch PostgreSQL Secret:"
  print_patch_cmd "${SECRET_PREFIX}/postgres" "password=\"$PG_PASS\""

  echo ""
  echo "# 3. Patch PhotoPrism Secret:"
  print_patch_cmd "${SECRET_PREFIX}/photoprism" "admin-password=\"$PHOTOPRISM_ADMIN_PASS\""

  echo ""
  echo "================================================================================"
  echo "# To sync and restart after running the patch commands above:"
  echo "kubectl annotate externalsecret -n family-picnic-${TARGET_ENV} --all force-sync=\$(date +%s) --overwrite"
  echo "kubectl rollout restart deployment/nextjs -n family-picnic-${TARGET_ENV}"
  echo "================================================================================"
  exit 0
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
  auth-apple-id="$AUTH_APPLE_ID" \
  auth-apple-team-id="$AUTH_APPLE_TEAM_ID" \
  auth-apple-key-id="$AUTH_APPLE_KEY_ID" \
  auth-apple-private-key="$AUTH_APPLE_PRIVATE_KEY" \
  auth-facebook-id="$AUTH_FACEBOOK_ID" \
  auth-facebook-secret="$AUTH_FACEBOOK_SECRET" \
  google-maps-api-key="$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY" \
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

# --- Apple OAuth (leave empty for now) ---
AUTH_APPLE_ID="${AUTH_APPLE_ID}"
AUTH_APPLE_TEAM_ID="${AUTH_APPLE_TEAM_ID}"
AUTH_APPLE_KEY_ID="${AUTH_APPLE_KEY_ID}"
AUTH_APPLE_PRIVATE_KEY="${AUTH_APPLE_PRIVATE_KEY}"

# --- Facebook OAuth (leave empty for now) ---
AUTH_FACEBOOK_ID="${AUTH_FACEBOOK_ID}"
AUTH_FACEBOOK_SECRET="${AUTH_FACEBOOK_SECRET}"

# --- Google Maps ---
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="${NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}"

# --- Twilio (leave empty) ---
TWILIO_ACCOUNT_SID="${TWILIO_ACCOUNT_SID}"
TWILIO_AUTH_TOKEN="${TWILIO_AUTH_TOKEN}"
TWILIO_PHONE_NUMBER="${TWILIO_PHONE_NUMBER}"

# --- SendGrid (leave empty) ---
SENDGRID_API_KEY="${SENDGRID_API_KEY}"
SENDGRID_FROM_EMAIL="dev@${APP_DOMAIN}"

# --- Stripe (leave empty until you paste real test keys) ---
# STRIPE_*_KEY values are used at runtime by the Next.js app; STRIPE_API_KEY
# is bootstrap-only — it lets scripts/setup-stripe-webhook.sh register the
# webhook endpoint without re-pasting the key each run.
STRIPE_SECRET_KEY="${STRIPE_SECRET_KEY}"
STRIPE_PUBLISHABLE_KEY="${STRIPE_PUBLISHABLE_KEY}"
STRIPE_WEBHOOK_SECRET="${STRIPE_WEBHOOK_SECRET}"
STRIPE_API_KEY="${STRIPE_API_KEY}"

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
