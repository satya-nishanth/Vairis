FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-bookworm-slim AS builder
WORKDIR /app
# bookworm-slim has no OpenSSL — Prisma's query engine needs libssl to run
# ("Prisma cannot find the required libssl system library"), both to generate
# the right engine binary here and to run it in the runner stage below.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* vars are baked into the client bundle at build time — must be
# build-args, not just runtime env vars, or the browser bundle ships with
# empty/undefined values. azd passes these automatically from azd env values.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_RAZORPAY_KEY_ID
ARG NEXT_PUBLIC_CHECKOUT_ENABLED
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_SITE_THEME
ARG NEXT_PUBLIC_GA_ID
ARG NEXT_PUBLIC_GTM_ID
ARG NEXT_PUBLIC_SENTRY_DSN
# Not a NEXT_PUBLIC_ var (server-only, used by next.config.mjs's rewrite), but still needs to be
# a build-arg: Next.js resolves rewrites()/redirects()/headers() ONCE during `next build` into a
# static routes manifest — a production/standalone server does not re-invoke next.config.mjs at
# startup, so a runtime-only env var here would be silently ignored forever.
ARG GOTRUE_INTERNAL_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_RAZORPAY_KEY_ID=$NEXT_PUBLIC_RAZORPAY_KEY_ID \
    NEXT_PUBLIC_CHECKOUT_ENABLED=$NEXT_PUBLIC_CHECKOUT_ENABLED \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_SITE_THEME=$NEXT_PUBLIC_SITE_THEME \
    NEXT_PUBLIC_GA_ID=$NEXT_PUBLIC_GA_ID \
    NEXT_PUBLIC_GTM_ID=$NEXT_PUBLIC_GTM_ID \
    NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN \
    GOTRUE_INTERNAL_URL=$GOTRUE_INTERNAL_URL
RUN npx prisma generate
# NODE_OPTIONS= clears a --no-opt flag Rosetta injects into amd64-emulated
# containers on Apple Silicon hosts — Turbopack's worker_threads reject it
# (ERR_WORKER_INVALID_EXEC_ARGV). No-op on native amd64 builders (CI).
RUN NODE_OPTIONS= npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
# Next.js standalone binds to 127.0.0.1 by default — Container Apps sends traffic
# from outside the loopback interface, so this must be 0.0.0.0 or every request
# silently fails with no obvious error in the logs.
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
# Next's standalone output only traces runtime deps actually imported by app
# code (@prisma/client) — the `prisma` CLI itself (a devDependency, invoked
# by name via npx, never imported) is pruned out. Install it directly so
# `migrate deploy` below has something to run.
RUN npm install --no-save prisma@5.22.0
EXPOSE 3000
# Applying pending migrations here — not as a separate manual/CI step — is
# the fix for a real incident: this target database went a full session
# without ever having `prisma migrate deploy` run against it, so tables
# added by later migrations (e.g. AnalyticsEvent) simply didn't exist and
# any route touching them 500'd. Running it on every boot makes that
# structurally impossible to forget again. If it fails, the container
# should crash-loop rather than silently serve against a stale schema.
CMD ["sh", "-c", "npx prisma migrate deploy --schema=./prisma/schema.prisma && node server.js"]
