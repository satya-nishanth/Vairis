#!/bin/bash
# Reverses azure-stop.sh: starts Postgres, restores minReplicas to normal
# (matching infra/modules/app.bicep and gotrue.bicep — a later `azd provision`
# would reset to the same values anyway, this just gets there faster without
# a full provision run), and activates + restarts both Container Apps'
# latest revision so replicas come up immediately instead of waiting for
# the first real request.
#
# Usage: scripts/azure-start.sh staging|prod
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

if [[ "$ENV" == "prod" ]]; then
  APP_MIN=1; GOTRUE_MIN=1
else
  APP_MIN=0; GOTRUE_MIN=1
fi

echo "Starting compute for $ENV ($RG)..."

PG_STATE=$(az postgres flexible-server show -g "$RG" -n "$PG" --query state -o tsv)
if [[ "$PG_STATE" != "Ready" ]]; then
  echo "  starting $PG (can take a couple minutes)"
  az postgres flexible-server start -g "$RG" -n "$PG" -o none
else
  echo "  $PG already Ready (skipping)"
fi

echo "  minReplicas: $GOTRUE -> $GOTRUE_MIN, $APP -> $APP_MIN"
az containerapp update -g "$RG" -n "$GOTRUE" --min-replicas "$GOTRUE_MIN" -o none
az containerapp update -g "$RG" -n "$APP" --min-replicas "$APP_MIN" -o none

for CA in "$GOTRUE" "$APP"; do
  REV=$(az containerapp show -g "$RG" -n "$CA" --query properties.latestRevisionName -o tsv)
  echo "  activating + restarting $CA revision $REV"
  # activate errors (RevisionAlreadyInRequestedState) if the revision never
  # actually flipped to inactive (e.g. gotrue, whose "active" flag stays
  # true even at 0 replicas) — restart is what actually brings replicas up,
  # so activate failing here isn't fatal.
  az containerapp revision activate -g "$RG" -n "$CA" --revision "$REV" -o none || true
  az containerapp revision restart -g "$RG" -n "$CA" --revision "$REV" -o none
done

echo "Done. $ENV compute is back up."
