#!/bin/bash
# Cost-control: stop compute for an environment, immediately. Data persists —
# only Container Apps (revision deactivated) and Postgres (stopped, storage
# billing continues but compute billing stops) are touched. Storage account,
# Key Vault, VNet, ACR are untouched (cheap, no reason to tear down).
#
# Container Apps' own scale-to-zero (minReplicas:0, staging's app) is not
# instant — it waits out a cooldown after the last request. Deactivating the
# active revision directly stops all replicas right now, and GoTrue always
# has minReplicas:1 (both envs) so it never scales to zero on its own at all.
#
# Usage: scripts/azure-stop.sh staging|prod
set -euo pipefail

ENV="${1:-}"
if [[ "$ENV" != "staging" && "$ENV" != "prod" ]]; then
  echo "Usage: $0 staging|prod" >&2
  exit 1
fi

RG="rg-vairis-$ENV"
APP="vairis-app-$ENV"
GOTRUE="gotrue-vairis-$ENV"
PG="psql-vairis-$ENV"

echo "Stopping compute for $ENV ($RG)..."

# Both apps default to minReplicas:1 on prod (gotrue always, app via
# isProd ? 1 : 0 in app.bicep) — a revision can't be deactivated while
# minReplicas > 0 without Container Apps immediately recreating an active
# one to satisfy that minimum. Zero it first, on both apps, on both envs
# (harmless where it's already 0, i.e. staging's app).
echo "  minReplicas -> 0 on $GOTRUE and $APP"
az containerapp update -g "$RG" -n "$GOTRUE" --min-replicas 0 -o none
az containerapp update -g "$RG" -n "$APP" --min-replicas 0 -o none

# Deactivating forces replicas down right now instead of waiting out the
# scale-to-zero cooldown.
for CA in "$APP" "$GOTRUE"; do
  REV=$(az containerapp revision list -g "$RG" -n "$CA" --query "[?properties.active].name | [0]" -o tsv)
  if [[ -n "$REV" ]]; then
    echo "  deactivating $CA revision $REV"
    az containerapp revision deactivate -g "$RG" -n "$CA" --revision "$REV" -o none
  fi
done

PG_STATE=$(az postgres flexible-server show -g "$RG" -n "$PG" --query state -o tsv)
if [[ "$PG_STATE" == "Ready" ]]; then
  echo "  stopping $PG"
  az postgres flexible-server stop -g "$RG" -n "$PG" -o none
else
  echo "  $PG already in state: $PG_STATE (skipping)"
fi

echo "Done. $ENV compute is stopped, data persists. Run scripts/azure-start.sh $ENV to bring it back."
