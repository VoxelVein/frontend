#!/usr/bin/env bash
# Prepares the local Garage node for development: assigns a single-node
# layout, creates the bucket, and imports the access key from .env.local.
# Safe to run more than once.
set -euo pipefail

ENV_FILE="${ENV_FILE:-.env.local}"
COMPOSE=(docker compose -f docker-compose.yml --env-file "$ENV_FILE")

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE. Copy .env.example and fill in the storage section." >&2
  exit 1
fi

read_env() {
  grep -E "^$1=" "$ENV_FILE" | tail -n 1 | cut -d= -f2-
}

bucket="$(read_env STORAGE_BUCKET)"
key_id="$(read_env STORAGE_ACCESS_KEY_ID)"
secret="$(read_env STORAGE_SECRET_ACCESS_KEY)"

for name in STORAGE_BUCKET STORAGE_ACCESS_KEY_ID STORAGE_SECRET_ACCESS_KEY; do
  if [[ -z "$(read_env "$name")" ]]; then
    echo "$name is not set in $ENV_FILE." >&2
    exit 1
  fi
done

garage() {
  "${COMPOSE[@]}" exec -T garage /garage "$@" 2>/dev/null
}

node_id="$(garage node id -q | cut -d@ -f1)"

if garage layout show | grep -q "No nodes currently have a role"; then
  echo "Assigning single-node layout to ${node_id:0:16}"
  garage layout assign -z dev -c 10G "$node_id" >/dev/null
  garage layout apply --version 1 >/dev/null
fi

if ! garage bucket info "$bucket" >/dev/null; then
  echo "Creating bucket $bucket"
  garage bucket create "$bucket" >/dev/null
fi

if ! garage key info "$key_id" >/dev/null; then
  echo "Importing access key $key_id"
  garage key import --yes -n voxelvein-dev "$key_id" "$secret" >/dev/null
fi

garage bucket allow --read --write --owner "$bucket" --key "$key_id" >/dev/null
echo "Garage is ready: bucket $bucket, key $key_id"
