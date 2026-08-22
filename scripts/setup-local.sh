#!/usr/bin/env bash
# One-shot local dev setup: installs deps, starts Supabase, writes .env.local,
# applies migrations. Safe to re-run — idempotent at every step.
#
# Usage: ./scripts/setup-local.sh [admin-email]
#   admin-email  optional — email to whitelist in ADMIN_EMAILS (default: you@example.com)

set -euo pipefail
cd "$(dirname "$0")/.."

ADMIN_EMAIL="${1:-you@example.com}"

info()  { printf '\033[1;34m==>\033[0m %s\n' "$1"; }
warn()  { printf '\033[1;33m!!\033[0m %s\n' "$1"; }
fail()  { printf '\033[1;31mERROR:\033[0m %s\n' "$1"; exit 1; }

# --- 1. Prerequisites ---------------------------------------------------
info "Checking prerequisites"

command -v node >/dev/null 2>&1 || fail "Node.js not found. Install 20.9+ (nvm install 20.9.0)."
NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
NODE_MINOR=$(node -p "process.versions.node.split('.')[1]")
if [ "$NODE_MAJOR" -lt 20 ] || { [ "$NODE_MAJOR" -eq 20 ] && [ "$NODE_MINOR" -lt 9 ]; }; then
  fail "Node $(node -v) too old. Need 20.9+: nvm install 20.9.0 && nvm use 20.9.0"
fi

command -v supabase >/dev/null 2>&1 || fail "Supabase CLI not found: brew install supabase/tap/supabase"

docker info >/dev/null 2>&1 || fail "Docker Desktop isn't running. Start it, then re-run this script."

info "Prerequisites OK (node $(node -v))"

# --- 2. Install dependencies --------------------------------------------
info "Installing npm dependencies"
npm install

# --- 3. Start Supabase ---------------------------------------------------
info "Starting local Supabase (first run downloads ~500MB, takes a few minutes)"
supabase start

# --- 4. Write .env.local --------------------------------------------------
info "Writing .env.local"

if [ -f .env.local ]; then
  BACKUP=".env.local.bak.$(date +%Y%m%d%H%M%S)"
  cp .env.local "$BACKUP"
  warn "Existing .env.local backed up to $BACKUP — merging Supabase/DB values into it"
else
  cp .env.local.example .env.local
fi

# macOS/BSD sed needs -i '' ; GNU sed needs -i (no arg). Detect once.
if sed --version >/dev/null 2>&1; then SED_INPLACE=(-i); else SED_INPLACE=(-i ''); fi

set_env() {
  local key="$1" value="$2"
  if grep -q "^${key}=" .env.local; then
    sed "${SED_INPLACE[@]}" "s|^${key}=.*|${key}=${value}|" .env.local
  else
    printf '%s=%s\n' "$key" "$value" >> .env.local
  fi
}

# Pull real local credentials straight from the running instance.
eval "$(supabase status -o env 2>/dev/null | grep -E '^(API_URL|PUBLISHABLE_KEY|SECRET_KEY|DB_URL)=')"

set_env "NEXT_PUBLIC_SUPABASE_URL" "$API_URL"
set_env "NEXT_PUBLIC_SUPABASE_ANON_KEY" "$PUBLISHABLE_KEY"
set_env "SUPABASE_SERVICE_ROLE_KEY" "$SECRET_KEY"
set_env "DATABASE_URL" "$DB_URL"
set_env "DIRECT_DATABASE_URL" "$DB_URL"
set_env "NEXT_PUBLIC_APP_URL" "http://localhost:3000"
set_env "ADMIN_EMAILS" "$ADMIN_EMAIL"

info ".env.local ready (Supabase/DB values filled in; payments+shipping stay mocked by default)"

# --- 5. Apply database schema ---------------------------------------------
info "Applying migrations (prisma migrate deploy)"
npx prisma migrate deploy

# --- 6. Optional seed ------------------------------------------------------
read -r -p "Seed sample data now? [y/N] " SEED_ANSWER || true
if [[ "$SEED_ANSWER" =~ ^[Yy]$ ]]; then
  npm run seed
fi

# --- Done ------------------------------------------------------------------
cat <<EOF

Setup complete.

  npm run dev

Then:
  http://localhost:3000/auth/admin   -> create an account with $ADMIN_EMAIL
  http://127.0.0.1:54323             -> Supabase Studio (DB browser)
  http://127.0.0.1:54324             -> Mailpit (local auth emails)

Payments and shipping are mocked by default (PAYMENT_GATEWAY=mock,
SHIPPING_MOCK=true) — full checkout->order->shipment flow works with no
real credentials. Fill in real keys in .env.local only if you need to test
against a real gateway/courier.
EOF
