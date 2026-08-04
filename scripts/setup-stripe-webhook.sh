#!/usr/bin/env bash
#
# setup-stripe-webhook.sh
#
# Registers the Stripe webhook endpoint for an environment and pushes
# the resulting signing secret into OpenBao so the cluster's
# ExternalSecret binding propagates it as STRIPE_WEBHOOK_SECRET.
#
# The matching ExternalSecret must already be installed in the cluster
# with a `secretKey: stripe-webhook-secret` entry pointing at the same
# path this script writes to.
#
# Usage:
#   STRIPE_API_KEY=sk_test_… \
#     ./scripts/setup-stripe-webhook.sh stage
#
#   STRIPE_API_KEY=sk_live_… \
#     ./scripts/setup-stripe-webhook.sh prod https://payments.example.com/api/stripe/webhook
#
# Args:
#   env              — dev|stage|prod (required). Controls the OpenBao
#                      path: secret/family-picnic-${env}/nextjs
#   url              — webhook URL (optional). Defaults to the stage URL.
#                      Pass an explicit URL for prod or a custom domain.
#
# Env vars:
#   STRIPE_API_KEY    — required. sk_test_… for stage/dev, sk_live_… for prod.
#   STRIPE_CLI        — default 'stripe'
#   OPENBAO_NAMESPACE — default 'security'
#   OPENBAO_POD       — default 'openbao-0'
#   SECRET_PREFIX     — overrides the OpenBao secret root
#
# Idempotency: lists existing webhook endpoints and refuses to create a
# duplicate for the same URL. To rotate the signing secret, delete the
# endpoint in the Stripe dashboard and re-run this script.

set -euo pipefail

# --- args ---------------------------------------------------------------------

ENV="${1:-}"
URL="${2:-}"

if [ -z "$ENV" ]; then
  echo "ERROR: env required (dev|stage|prod)" >&2
  echo "Usage: STRIPE_API_KEY=sk_… $0 <env> [<url>]" >&2
  exit 64
fi

case "$ENV" in
  dev|stage|prod) ;;
  *)
    echo "ERROR: env must be one of: dev, stage, prod (got '$ENV')" >&2
    exit 64
    ;;
esac

case "$ENV" in
  dev)
    echo "ERROR: dev uses 'stripe listen' which prints its own signing secret." >&2
    echo "Copy that whsec_… into .env as STRIPE_WEBHOOK_SECRET; no OpenBao push needed." >&2
    echo "Run: stripe listen --forward-to http://localhost:3000/api/stripe/webhook" >&2
    exit 64
    ;;
esac

if [ -z "$URL" ]; then
  case "$ENV" in
    stage) URL="https://family-picnic.dev.qubitquilt.dev/api/stripe/webhook" ;;
    prod) URL="https://payments.example.com/api/stripe/webhook" ;;
  esac
  echo "Using default URL for $ENV: $URL" >&2
fi

# --- preflight -----------------------------------------------------------------

if [ -z "${STRIPE_API_KEY:-}" ]; then
  echo "ERROR: STRIPE_API_KEY env var required (sk_test_… or sk_live_…)" >&2
  exit 64
fi

STRIPE_CLI="${STRIPE_CLI:-stripe}"

if ! command -v "$STRIPE_CLI" >/dev/null 2>&1; then
  echo "ERROR: '$STRIPE_CLI' not found in PATH. Install: https://stripe.com/docs/stripe-cli" >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq not found in PATH" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/openbao.sh
. "$SCRIPT_DIR/lib/openbao.sh"

# --- Stripe: list existing endpoints ------------------------------------------

EVENTS=(
  payment_intent.succeeded
  payment_intent.payment_failed
  payment_intent.canceled
  charge.refunded
  charge.updated
)

echo "==> Listing existing webhook endpoints"
existing_json="$("$STRIPE_CLI" webhook_endpoints list --format json 2>/dev/null || true)"

if [ -n "$existing_json" ]; then
  existing_id="$(
    printf '%s' "$existing_json" \
      | jq -r --arg url "$URL" '.data[] | select(.url == $url) | .id' \
      | head -n 1
  )"
  if [ -n "$existing_id" ] && [ "$existing_id" != "null" ]; then
    echo "==> Webhook endpoint already registered for $URL (id: $existing_id)" >&2
    echo "    To rotate the signing secret, delete the endpoint in the Stripe" >&2
    echo "    dashboard (https://dashboard.stripe.com/webhooks) and re-run this script." >&2
    exit 0
  fi
fi

# --- Stripe: create the endpoint ---------------------------------------------

echo "==> Creating webhook endpoint for $ENV at $URL"

# The Stripe CLI returns the signing secret in the JSON response when
# --format json is used. Capture stdout so we can parse it.
create_json="$(
  "$STRIPE_CLI" webhook_endpoints create \
    --url "$URL" \
    --enabled-events "${EVENTS[0]}","${EVENTS[1]}","${EVENTS[2]}","${EVENTS[3]}","${EVENTS[4]}" \
    --api-version 2025-08-27.basil \
    --format json \
    --connect-to-default-account
)" || {
  echo "ERROR: stripe webhook_endpoints create failed" >&2
  echo "$create_json" >&2
  exit 1
}

endpoint_id="$(printf '%s' "$create_json" | jq -r '.id // empty')"
whsec="$(printf '%s' "$create_json" | jq -r '.secret // empty')"

if [ -z "$endpoint_id" ]; then
  echo "ERROR: stripe CLI returned no endpoint id. Response:" >&2
  printf '%s\n' "$create_json" >&2
  exit 1
fi

if [ -z "$whsec" ]; then
  # Older Stripe CLI versions do not include the secret in the create
  # response. Fall back to retrieving it via the API. The endpoint's
  # signing secret is only shown at creation time on the dashboard; we
  # therefore rely on the CLI returning it.
  echo "ERROR: stripe CLI did not return the signing secret. Response:" >&2
  printf '%s\n' "$create_json" >&2
  echo "" >&2
  echo "Hint: ensure your stripe CLI version is >= 1.21.0 (the secret field" >&2
  echo "was added in 1.18.0). For older CLIs, retrieve the secret manually from" >&2
  echo "https://dashboard.stripe.com/webhooks -> click the endpoint -> Signing secret." >&2
  exit 1
fi

echo "==> Created webhook endpoint id=$endpoint_id"

# --- OpenBao: push the signing secret -----------------------------------------

SECRET_PREFIX="${SECRET_PREFIX:-secret/family-picnic-$ENV}"
SECRET_PATH="$SECRET_PREFIX/nextjs"

echo "==> Pushing STRIPE_WEBHOOK_SECRET to OpenBao at $SECRET_PATH"

# Preserve any other keys already present at the path. Read them and
# write them back together with the new stripe-webhook-secret value.
existing_kv="$(bao_get_json "$SECRET_PATH")"
declare -a kv_args
if [ -n "$existing_kv" ]; then
  while IFS=$'\t' read -r key value; do
    [ -n "$key" ] || continue
    kv_args+=("$key=$value")
  done < <(printf '%s' "$existing_kv" | jq -r '.data.data | to_entries[] | "\(.key)\t\(.value)"')
fi

# Replace the stripe-webhook-secret entry (or add it).
found=0
for i in "${!kv_args[@]}"; do
  if [[ "${kv_args[$i]}" == stripe-webhook-secret=* ]]; then
    kv_args[$i]="stripe-webhook-secret=$whsec"
    found=1
    break
  fi
done
[ "$found" -eq 0 ] && kv_args+=("stripe-webhook-secret=$whsec")

bao_put_kv "$SECRET_PATH" "${kv_args[@]}"

# --- Summary -------------------------------------------------------------------

cat <<EOF

==> Stripe webhook configured for $ENV
    URL:         $URL
    Endpoint id: $endpoint_id
    Mode:        $(case "$STRIPE_API_KEY" in sk_live_*) echo live;; *) echo test;; esac)
    Events:      ${EVENTS[*]}

==> Signing secret pushed to OpenBao at $SECRET_PATH:stripe-webhook-secret

Next steps for a fresh deployment:

  1. Annotate the ExternalSecret so the cluster pulls the new value:
       kubectl annotate externalsecret -n family-picnic-$ENV \\
         --all force-sync=\$(date +%s)

  2. Restart the deployment so envFrom re-reads the secret:
       kubectl rollout restart deployment/nextjs -n family-picnic-$ENV

  3. Smoke-test the webhook locally:
       curl -X POST https://<your-domain>/api/stripe/webhook \\
         -H "Stripe-Signature: t=\$(date +%s),v1=…" \\
         --data '{"id":"evt_smoke","type":"ping"}'

EOF