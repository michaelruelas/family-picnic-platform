#!/usr/bin/env bash
#
# lib/openbao.sh
#
# Shared OpenBao helpers used by scripts/populate-openbao-secrets.sh and
# scripts/setup-stripe-webhook.sh. Source this file from another script:
#
#   . "$(dirname "$0")/lib/openbao.sh"
#

OPENBAO_NAMESPACE="${OPENBAO_NAMESPACE:-security}"
OPENBAO_POD="${OPENBAO_POD:-openbao-0}"

bao_exec() {
  local token="${BAO_TOKEN:-${VAULT_TOKEN:-}}"
  if [ -n "$token" ]; then
    kubectl -n "$OPENBAO_NAMESPACE" exec -i "$OPENBAO_POD" -- env BAO_TOKEN="$token" VAULT_TOKEN="$token" bao "$@"
  else
    kubectl -n "$OPENBAO_NAMESPACE" exec -i "$OPENBAO_POD" -- bao "$@"
  fi
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

# bao_put_kv <path> <key=value> [<key=value> ...]
# Writes the key/value pairs to the given OpenBao path. Creates the path
# if it does not exist; replaces existing values for the keys given.
bao_put_kv() {
  local path="$1"
  shift
  if [ "$#" -eq 0 ]; then
    echo "bao_put_kv: at least one key=value pair required" >&2
    return 64
  fi
  bao_exec kv put "$path" "$@"
}