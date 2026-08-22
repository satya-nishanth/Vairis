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

From whoever owns the Supabase project (Nishi/Anil) — a Supabase project
that is **not** the production project unless you've been explicitly told
to use it:

1. **Project URL** — `Settings → API → Project URL`
   (`https://xxxx.supabase.co`)
2. **Anon (publishable) key** — same page,
   `Project API keys → anon public`
3. **Service role (secret) key** — same page,
   `Project API keys → service_role` — **treat this like a root password**,
   never commit it, never share it outside a password manager / secure channel
4. **Database connection string** — `Settings → Database → Connection
   string`, **Session pooler** tab (port `5432`), not "Transaction pooler"
   (port `6543`) — this project's Prisma setup breaks on the transaction
   pooler (prepared statements aren't supported there). This repo's
   `CLAUDE.md` calls this out explicitly — it's a real, previously-hit
   footgun, not a theoretical one.

## What the script does

1. Checks Node version, runs `npm install` — no Docker/Supabase-CLI checks,
   since neither is needed for this path.
2. Prompts for the four values above (or reads them from env vars if you
   prefer to export them first — see the script header).
3. Writes `.env.local` (backs up any existing one first, same as the
   Docker script).
4. **Asks for explicit confirmation before running `prisma migrate
   deploy`** — unlike the local-Docker path, this targets a real shared
   database. Migrations are additive/safe by Prisma convention, but you
   should still know what you're pointing at before it runs.
5. Prints next steps (`npm run dev`, admin signup).

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
