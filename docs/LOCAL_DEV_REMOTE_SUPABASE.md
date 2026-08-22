# Local dev against a remote Supabase project (no Docker)

`scripts/setup-local.sh` runs `supabase start` — a full local Postgres +
Auth + Storage stack in Docker. That's the default, and what CI/most devs
should use.

`scripts/setup-local-remote.sh` is the alternative: skip Docker entirely,
point the app at an already-existing **remote** Supabase project (cloud-
hosted) instead. Use this when:
- Docker isn't available/practical on your machine, or
- you specifically need to work against real shared data (e.g. reviewing
  something that only exists in a shared dev/staging Supabase project).

## Before you run it, you need

1. **Supabase CLI + `jq`** installed (`brew install supabase/tap/supabase
   jq`) — the script installs npm deps for you but expects these two
   already on your machine.
2. **Access to the Supabase project** — ask Nishi/Anil to invite your
   Supabase account (by email) to the org/project first. Without that,
   `supabase projects list` will just come back empty.
3. **The database password** — the one thing that can't be fetched via the
   API (Supabase never exposes it after project creation). Get it from
   Nishi/Anil directly (password manager / secure channel, not chat).

That's it. The script handles login, project selection, and every API
key/URL itself.

## What the script does

1. Checks Node version, checks the Supabase CLI + `jq` are installed, runs
   `npm install`. No Docker needed for this path.
2. If you're not already logged in to the Supabase CLI, runs
   `supabase login` for you (opens a browser once).
3. Lists every Supabase project your account can see
   (`supabase projects list`) — auto-picks it if there's only one,
   otherwise asks you to pick a number.
4. Fetches the project's anon key and service-role key automatically
   (`supabase projects api-keys`) — nothing to copy-paste, no risk of
   grabbing the wrong key.
5. Prompts for **only** the database password, then builds the full
   Session-pooler connection string itself (port `5432`, region taken
   straight from the project's own metadata — never the Transaction
   pooler on port `6543`, which this project's Prisma setup is known to
   break on — see `CLAUDE.md`). The password is percent-encoded
   automatically, same gotcha `infra/main.bicep` already documents for the
   Azure side.
6. Writes `.env.local` (backs up any existing one first, same as the
   Docker script).
7. **Asks for explicit confirmation before running `prisma migrate
   deploy`** — unlike the local-Docker path, this targets a real shared
   database. Migrations are additive/safe by Prisma convention, but you
   should still know what you're pointing at before it runs.
8. Prints next steps (`npm run dev`, admin signup).

## What it does NOT do

- Does not seed sample data by default (a shared remote DB likely already
  has real/shared data — seeding could duplicate or collide with it).
- Does not touch Supabase Storage buckets or Auth settings — those already
  exist on the remote project as configured by whoever set it up.
- Does not start Mailpit — auth emails from a remote Supabase project go
  through whatever email provider that project has configured (or
  Supabase's own rate-limited default), not a local inbox. Password
  reset/signup-confirmation emails will behave like they do in a real
  deployed environment, not local dev.

## Switching back

Nothing to undo — `.env.local` just holds different values.
Re-run `scripts/setup-local.sh` to switch back to the Docker-based local
stack; it backs up whatever `.env.local` is currently there before
overwriting.
