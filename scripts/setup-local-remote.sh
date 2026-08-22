#!/usr/bin/env bash
# Local dev setup against a REMOTE/cloud Supabase project — no Docker, no
# `supabase start`. See docs/LOCAL_DEV_REMOTE_SUPABASE.md for what you need
# before running this and why (Session Pooler port, where to find keys).
#
# Usage:
#   ./scripts/setup-local-remote.sh [admin-email]
#
# Values can be pre-set via env vars to skip the prompts (e.g. for a
# scripted/CI setup): SUPABASE_URL, SUPABASE_ANON_KEY,
# SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL

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

info "Prerequisites OK (node $(node -v)) — no Docker/Supabase CLI needed for this path"

# --- 2. Install dependencies --------------------------------------------
info "Installing npm dependencies"
npm install

# --- 3. Collect remote Supabase credentials -------------------------------
info "Remote Supabase project details (see docs/LOCAL_DEV_REMOTE_SUPABASE.md)"

prompt_if_unset() {
  local varname="$1" label="$2" secret="${3:-}"
  if [ -z "${!varname:-}" ]; then
    if [ "$secret" = "secret" ]; then
      read -r -s -p "$label: " value; echo
    else
      read -r -p "$label: " value
    fi
    printf -v "$varname" '%s' "$value"
  fi
}

prompt_if_unset SUPABASE_URL "Project URL (https://xxxx.supabase.co)"
prompt_if_unset SUPABASE_ANON_KEY "Anon/publishable key"
prompt_if_unset SUPABASE_SERVICE_ROLE_KEY "Service role key" secret
prompt_if_unset SUPABASE_DB_URL "Database connection string — Session pooler, port 5432 (Settings > Database)"

[[ "$SUPABASE_DB_URL" == *:6543/* ]] && \
  fail "That connection string uses port 6543 (Transaction pooler). This project needs the Session pooler (port 5432) — Prisma's prepared statements break on the transaction pooler. Go back to Settings > Database > Session pooler tab."

# --- 4. Write .env.local --------------------------------------------------
info "Writing .env.local"

if [ -f .env.local ]; then
  BACKUP=".env.local.bak.$(date +%Y%m%d%H%M%S)"
  cp .env.local "$BACKUP"
  warn "Existing .env.local backed up to $BACKUP — merging remote values into it"
else
  cp .env.local.example .env.local
fi

if sed --version >/dev/null 2>&1; then SED_INPLACE=(-i); else SED_INPLACE=(-i ''); fi

set_env() {
  local key="$1" value="$2"
  if grep -q "^${key}=" .env.local; then
    sed "${SED_INPLACE[@]}" "s|^${key}=.*|${key}=${value}|" .env.local
  else
    printf '%s=%s\n' "$key" "$value" >> .env.local
  fi
}

set_env "NEXT_PUBLIC_SUPABASE_URL" "$SUPABASE_URL"
set_env "NEXT_PUBLIC_SUPABASE_ANON_KEY" "$SUPABASE_ANON_KEY"
set_env "SUPABASE_SERVICE_ROLE_KEY" "$SUPABASE_SERVICE_ROLE_KEY"
set_env "DATABASE_URL" "$SUPABASE_DB_URL"
set_env "DIRECT_DATABASE_URL" "$SUPABASE_DB_URL"
set_env "NEXT_PUBLIC_APP_URL" "http://localhost:3000"
set_env "ADMIN_EMAILS" "$ADMIN_EMAIL"

info ".env.local ready"

# --- 5. Apply database schema (confirm first — this is a shared remote DB) -
warn "About to run 'prisma migrate deploy' against:"
echo "    $SUPABASE_URL"
read -r -p "This targets a REMOTE database, not a local throwaway one. Continue? [y/N] " CONFIRM
[[ "$CONFIRM" =~ ^[Yy]$ ]] || fail "Aborted before touching the remote database. .env.local is already written if you want to run this manually later."

info "Applying migrations (prisma migrate deploy)"
npx prisma migrate deploy

# --- Done ------------------------------------------------------------------
cat <<EOF

Setup complete — pointed at remote Supabase project:
  $SUPABASE_URL

  npm run dev

Then:
  http://localhost:3000/auth/admin   -> sign in/up with $ADMIN_EMAIL
                                         (must already exist or be allowed
                                         to sign up on that remote project)

No local Mailpit — auth emails go through whatever this remote project's
email provider actually is. No sample seed data was inserted (remote DB
likely already has real data). Payments/shipping still mocked by default
(PAYMENT_GATEWAY=mock, SHIPPING_MOCK=true) regardless of which Supabase
backend you're using.
EOF
