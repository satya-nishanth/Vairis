#!/usr/bin/env bash
# Local dev setup against a REMOTE/cloud Supabase project — no Docker.
# Auto-fetches project URL + API keys via the Supabase CLI (once logged in)
# instead of copy-pasting them from the dashboard. Only the DB password
# can't be fetched this way (Supabase never exposes it after creation) —
# that's the one thing you need handed to you separately.
#
# Usage:
#   ./scripts/setup-local-remote.sh [admin-email]
#
# First time: this will prompt you to run `supabase login` if you aren't
# already authenticated — that opens a browser once, nothing to copy-paste.

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
command -v jq >/dev/null 2>&1 || fail "jq not found: brew install jq"

info "Prerequisites OK (node $(node -v)) — no Docker needed for this path"

# --- 2. Install dependencies --------------------------------------------
info "Installing npm dependencies"
npm install

# --- 3. Supabase login ----------------------------------------------------
if ! supabase projects list >/dev/null 2>&1; then
  info "Not logged in to Supabase CLI — opening browser login"
  supabase login
fi

# --- 4. Pick the project ---------------------------------------------------
info "Fetching your Supabase projects"
PROJECTS_JSON=$(supabase projects list -o json 2>/dev/null)
COUNT=$(echo "$PROJECTS_JSON" | jq 'length')

[ "$COUNT" -gt 0 ] || fail "No Supabase projects visible on this account. Ask Nishi/Anil to invite you to the project, then re-run this script."

if [ "$COUNT" -eq 1 ]; then
  PROJECT_REF=$(echo "$PROJECTS_JSON" | jq -r '.[0].ref')
  PROJECT_NAME=$(echo "$PROJECTS_JSON" | jq -r '.[0].name')
  PROJECT_REGION=$(echo "$PROJECTS_JSON" | jq -r '.[0].region')
  info "Using project: $PROJECT_NAME ($PROJECT_REF)"
else
  echo "$PROJECTS_JSON" | jq -r 'to_entries[] | "\(.key+1)) \(.value.name)  [\(.value.ref)]  \(.value.region)"'
  read -r -p "Pick a project number: " PICK
  IDX=$((PICK - 1))
  PROJECT_REF=$(echo "$PROJECTS_JSON" | jq -r ".[$IDX].ref")
  PROJECT_NAME=$(echo "$PROJECTS_JSON" | jq -r ".[$IDX].name")
  PROJECT_REGION=$(echo "$PROJECTS_JSON" | jq -r ".[$IDX].region")
fi

[ "$PROJECT_REF" != "null" ] || fail "Invalid selection."

# --- 5. Fetch API keys ------------------------------------------------------
info "Fetching API keys for $PROJECT_NAME"
KEYS_JSON=$(supabase projects api-keys --project-ref "$PROJECT_REF" -o json 2>/dev/null)
SUPABASE_ANON_KEY=$(echo "$KEYS_JSON" | jq -r '.[] | select(.name=="anon") | .api_key')
SUPABASE_SERVICE_ROLE_KEY=$(echo "$KEYS_JSON" | jq -r '.[] | select(.name=="service_role") | .api_key')
SUPABASE_URL="https://${PROJECT_REF}.supabase.co"

[ -n "$SUPABASE_ANON_KEY" ] && [ "$SUPABASE_ANON_KEY" != "null" ] || \
  fail "Couldn't fetch the anon key — you may not have owner/admin access on this project."

# --- 6. DB password (the one thing that can't be fetched) ------------------
info "Everything else is automatic. One manual step left:"
echo "  DB password — get it from Nishi/Anil (or Settings > Database in the"
echo "  dashboard if you set the project up yourself)."
read -r -s -p "Database password: " DB_PASSWORD; echo

# Percent-encode — the password can contain characters (/, +, =) that break
# a raw connection string otherwise (same gotcha documented in infra/main.bicep).
DB_PASSWORD_ENCODED=$(node -e "console.log(encodeURIComponent(process.argv[1]))" "$DB_PASSWORD")

# Session pooler, port 5432 — NOT the transaction pooler (6543). This
# project's Prisma setup breaks on the transaction pooler (prepared
# statements aren't supported there). Region comes straight from the
# project metadata, so this is never guessed.
SUPABASE_DB_URL="postgresql://postgres.${PROJECT_REF}:${DB_PASSWORD_ENCODED}@aws-1-${PROJECT_REGION}.pooler.supabase.com:5432/postgres"

# --- 7. Write .env.local --------------------------------------------------
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

# --- 8. Apply database schema (confirm first — this is a shared remote DB) -
warn "About to run 'prisma migrate deploy' against:"
echo "    $PROJECT_NAME ($SUPABASE_URL)"
read -r -p "This targets a REMOTE database, not a local throwaway one. Continue? [y/N] " CONFIRM
[[ "$CONFIRM" =~ ^[Yy]$ ]] || fail "Aborted before touching the remote database. .env.local is already written if you want to run this manually later."

info "Applying migrations (prisma migrate deploy)"
npx prisma migrate deploy

# --- Done ------------------------------------------------------------------
cat <<EOF

Setup complete — pointed at remote Supabase project:
  $PROJECT_NAME ($SUPABASE_URL)

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
