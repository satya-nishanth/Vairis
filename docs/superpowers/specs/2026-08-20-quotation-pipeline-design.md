# Quotation pipeline — technical design

Date: 2026-08-20 (hardening addendum: 2026-08-22)
Status: design (not implemented)
Source requirements: `2026-08-18-quotation-pipeline.txt` (product spec, pickup-ready)

This document translates the product spec into a concrete technical design, resolving the
handful of points the spec left open through a brainstorming session. Where the spec already
decided something, this doc doesn't re-litigate it — see the source spec for full product
rationale (statuses, acceptance criteria, out-of-scope, constraints).

The 2026-08-22 session hardens the parts of this design that depend on a human noticing
something (xperson answering a ping, admin noticing a stale quote) — see "Reliability
hardening" below. Everything else on this page is unchanged from 2026-08-20.

## Decisions made in this session (not in the source spec)

1. **Secret naming**: reuse the existing `INTERNAL_API_KEY` (already reserved in
   `.env.local.example`, labeled "Internal API (WhatsApp bot)", currently unused) instead of
   introducing a new `INTERNAL_API_SECRET`.
2. **Ref-match behavior**: when a WhatsApp message contains "Ref Q-...", the bot forwards that
   message (and all subsequent ones from that phone, see #3) into the existing
   `#quote-requests-offline` thread — same "relay customer messages into their thread" pattern
   already used for open support tickets, just pointed at a different channel/data source.
3. **Attachment scope**: once attached (via ref match, or via the dedup path below), a phone
   number stays routed to its quotation thread for as long as that quotation is REQUESTED or
   QUOTED. Falls back to normal ticket/menu behavior once CONVERTED or CANCELLED.
4. **Duplicate window** (website keyword-fallback, no ref): one open quotation per phone at a
   time — a repeat price-enquiry message from a phone with an existing REQUESTED/QUOTED
   quotation reuses it (same session it would attach to via #3) rather than creating a new one.
   Same rule, same mechanism as #3.
5. **Bot-side tracking**: a local in-memory `phone → quotation` map, refreshed by the existing
   reminder-poll interval (not a per-message API call) — bounded staleness (≤30 min, same
   tradeoff the reminder system itself already accepts), zero added latency on the hot path of
   every incoming WhatsApp message.
6. **Screenshot upload**: manual/dashboard intake only (the website flow doesn't collect
   screenshots per the source spec). Reuses the existing `POST /api/admin/upload` route
   (currently hardcodes a `products/images/...` path) — extended with an optional `folder` form
   field so quote screenshots land under `quotations/screenshots/...` instead. Admin-only auth on
   that route already matches: manual intake is dashboard-only, no public path needs it.

## Architecture

Two repos, three integration surfaces. Quote machine and order machine stay fully independent
per the source spec — this design doesn't change that.

```
Vairis (Next.js)                          Vairis_Customer_Bot
├── Prisma: Quotation model (owns it)      ├── src/quotes/ (new module)
├── /admin/quotations, /new, /[id]         │   ├── discordQuoteThreads.js
├── /api/quotations (public, website)      │   │   (raw fetch to Discord REST v10 —
├── /api/admin/quotations (admin)          │   │    no discord.js needed; Next.js has
├── /api/internal/quotations               │   │    no persistent gateway connection
│   (bot polls this, Bearer INTERNAL_API_KEY)  │   │    to begin with)
└── Discord REST: creates threads,         │   ├── quotationMap.js
    posts to #quote-requests-offline       │   │   (phone → {quotationId, threadId}
                                            │   │    local cache, refreshed by poll)
                                            │   └── reminderPoll.js
                                            │       (own setInterval — Discord-only,
                                            │        does NOT gate on WhatsApp-ready
                                            │        the way the 24h ticket escalation
                                            │        reminder does, since this reminder
                                            │        never needs to send a WA message)
                                            └── discord.js handles /quoted /reply /close
                                                in #quote-requests-offline — a new
                                                handler module, parallel in shape to
                                                the existing discordReplyHandler.js but
                                                a separate file: different data source
                                                (HTTP calls to Next.js, not local
                                                Postgres), shouldn't share one module.
```

### Data model (Prisma, in Vairis)

```prisma
model Quotation {
  id                  String             @id @default(cuid())
  displayId           String             @unique // "Q-7K2M"
  source              QuotationSource
  status              QuotationStatus    @default(REQUESTED)
  orderType           QuotationOrderType
  details             String?
  customerName        String?
  customerMobile      String?
  productId           String?            // optional picker link, no relation enforced
  screenshotUrls      String[]           @default([])
  discordThreadId     String?
  lastReminderAt      DateTime?
  reminderCount       Int                @default(0) // pings sent while REQUESTED; drives escalation
  escalatedAt         DateTime?          // set once, when reminderCount crosses the threshold
  quotedAmount        Int?
  quotedNotes         String?
  quotedAt            DateTime?          // set on REQUESTED->QUOTED transition; staleness clock for QUOTED
  orderId             String?            @unique // set on CONVERTED
  createdAt           DateTime           @default(now())
  updatedAt           DateTime           @updatedAt

  @@index([customerMobile, status]) // dedup/attach lookups
}

enum QuotationSource     { MANUAL WEBSITE }
enum QuotationStatus     { REQUESTED QUOTED CONVERTED CANCELLED }
enum QuotationOrderType  { VAIRIS CUSTOMISATION }
```

`Order.quotationId String?` — plain informational scalar on the existing `Order` model, no FK
enforcement (matches the source spec's "informational only").

`displayId` generation: `q_{slugName}_{last10phone}_{sku}_{4char}` (internal, with
`anon`/`nophone`/`nosku` fallbacks per the source spec) → the last 4-char segment becomes the
short display form `Q-{4char}` shown in the UI and Discord thread names.

## Components

### Next.js (Vairis)

| Path | Purpose |
|---|---|
| `app/api/quotations/route.ts` | Public POST — website PDP modal + keyword-fallback intake. Ignores any client-supplied `orderType`, always writes `VAIRIS`. Dedup: looks up an open (REQUESTED/QUOTED) quotation for the given mobile inside the same transaction as a potential insert (`SELECT ... FOR UPDATE`-style guard) — returns the existing one instead of creating a duplicate under a burst of rapid submissions. |
| `app/api/admin/quotations/route.ts` | Admin POST (manual intake, `orderType` required, no default) + GET (list, `?status=` filter) — mirrors `app/api/admin/orders/route.ts`'s `requireAdmin()` → zod `.safeParse()` → 400 on failure → `$transaction` shape exactly. |
| `app/api/admin/quotations/[id]/route.ts` | GET detail; PATCH for dashboard "Mark quoted" / "Cancel" actions. "Mark quoted" sets `status = QUOTED` + `quotedAt` (+ optional `quotedAmount`/`quotedNotes` from the form) — same idempotent overwrite semantics as the bot's `/quoted`. "Cancel" sets `status = CANCELLED` and calls `closeThread`, same as the bot's `/close`. |
| `app/api/internal/quotations/route.ts` | Bot-only. Auth: `Authorization: Bearer ${INTERNAL_API_KEY}`, 401 otherwise. GET returns all REQUESTED quotations (for the reminder poll) plus enough of QUOTED/CONVERTED/CANCELLED for map pruning. PATCH lets `reminderPoll.js` write back `lastReminderAt`/`reminderCount`/`escalatedAt` after each ping cycle, and lets the bot's `/quoted` and `/close` Discord commands update status (+ `quotedAmount`/`quotedNotes`, or CANCELLED). |
| `app/(admin)/admin/quotations/page.tsx` | List — mirrors `orders/page.tsx`: server component, direct `prisma.findMany()`, status-chip filter via `searchParams.status`, plain table (no pagination lib, `take: 200` like the orders list), wrapped in `<AdminGuide>`. Default sort oldest-first (REQUESTED by `createdAt`, QUOTED by `quotedAt`). Each row shows an age column. Row flagged (red/amber) when `escalatedAt` is set (REQUESTED) or age past `QUOTE_STALE_QUOTED_HOURS` (QUOTED) — visibility only, no pings triggered from the dashboard. `?attention=true` is a second filter alongside `?status=`, returning exactly the flagged rows from both buckets. |
| `app/(admin)/admin/quotations/new/page.tsx` | Manual intake form — mirrors `ManualOrderForm.tsx`'s inline-styled card-section structure. Required: order type radio (no default), details textarea. Optional: screenshots (via extended `/api/admin/upload`), customer name, mobile, product picker. |
| `app/(admin)/admin/quotations/[id]/page.tsx` | Detail — shows thread link, status, quoted amount/notes. "Convert to order" button visible only when QUOTED, linking to `/admin/orders/new?quotationId=...`; shows a link to the order instead once CONVERTED. |
| `lib/quotations.ts` | `QUOTATION_TRANSITIONS` map (mirrors `lib/orders.ts`'s `ADMIN_TRANSITIONS` shape), `displayId` generator, Discord REST helpers (`createQuoteThread`, `postToThread`, `mentionAssignee`, `closeThread(threadId, message)` — posts a closing message then `PATCH` archived=true) — all plain `fetch` calls to `discord.com/api/v10/...` with `Authorization: Bot ${DISCORD_BOT_TOKEN}`. `closeThread` is called on both CONVERTED (from the orders route, see below) and dashboard-triggered CANCELLED. |
| `app/(admin)/admin/orders/new/ManualOrderForm.tsx` | Extended (not replaced) to read `?quotationId=` via `useSearchParams` (new usage — none exists in this file today) and prefill customer/details fields; still fully editable, save still goes through the existing order-creation path unchanged. |
| `app/api/admin/orders/route.ts` | Extended: on successful order creation when a `quotationId` was supplied, the transaction first re-reads that quotation and checks `status === 'QUOTED'` — if it's already CONVERTED/CANCELLED (double-submit from two tabs, or two admins), aborts with 409 and creates no order. Otherwise sets `status = CONVERTED` + `orderId` inside the same transaction, then (post-commit) calls `closeThread`. No other change to existing manual-order behavior. |
| `app/api/admin/upload/route.ts` | Extended with an optional `folder` form field (defaults to current `products` behavior) so quote screenshots can specify `quotations/screenshots`. |
| `app/product/[id]/ProductPageClient.tsx` | Both "Enquire on WhatsApp" call sites change from a bare `<a href="wa.me/...">` to a button opening a small modal (name + mobile required, prefilled if logged in; optional note). On submit: POST `/api/quotations`, then navigate to the `wa.me` link with a ref-including prefilled text. |

### Vairis_Customer_Bot (`src/quotes/`)

- **`reminderPoll.js`** — its own `setInterval`, wired up in `index.js` alongside (not inside) the
  existing WhatsApp bootstrap, since it only needs Discord + the internal API, never WhatsApp.
  Runs once immediately at bot startup (fetch-on-boot), then every `QUOTE_REMINDER_INTERVAL_MIN`
  (default 30) — the immediate run closes the cold-start gap where a restart would otherwise leave
  `quotationMap` empty for up to a full interval. Each cycle: GET
  `/api/internal/quotations?status=REQUESTED`. For each row:
  - First ping fires at `QUOTE_FIRST_REMINDER_MIN` (default 10) minutes old if `lastReminderAt` is
    still null — faster than the repeat cadence, so the customer isn't waiting a full 30min for
    the first nudge. Subsequent pings fire every `QUOTE_REMINDER_INTERVAL_MIN` after that.
  - Each ping: unarchive the Discord thread if archived, ping `DISCORD_QUOTE_ASSIGNEE_ID`, PATCH
    `lastReminderAt` + increment `reminderCount`.
  - Escalation: once `reminderCount >= QUOTE_ESCALATION_AFTER_MISSES` (default 3) and
    `escalatedAt` is still null, the same ping also mentions `DISCORD_ESCALATION_ID` in the same
    thread and sets `escalatedAt` — one-time, additive. Regular pings to the assignee continue
    unchanged afterward; escalation doesn't replace them, it widens who's watching.
  The same poll response refreshes `quotationMap` (adds newly-seen REQUESTED/QUOTED entries,
  prunes anything that moved to CONVERTED/CANCELLED).
- **`quotationMap.js`** — the phone → `{quotationId, threadId}` cache described in decision #5.
  Also populated immediately (one-off resolve call, not waiting for the next poll cycle) the
  first time a ref is seen in an incoming WhatsApp message, so there's no up-to-30-minute lag on
  the very first attach.
- **`discordQuoteThreads.js`** — thin REST wrappers used by the new `/quoted` `/reply` `/close`
  handler for `#quote-requests-offline` (a new module, parallel to but separate from the existing
  `bot/discordReplyHandler.js` — different data source, shouldn't be folded into one file).
  `/quoted` is idempotent while status is QUOTED: calling it again overwrites `quotedAmount` /
  `quotedNotes` (last-write-wins) instead of erroring, so xperson can fix a typo without needing
  dashboard access. `/close` sets CANCELLED and calls `closeThread` (posts "Cancelled" + archives) —
  same closing behavior the orders route triggers on CONVERTED, just from the bot side.
- **`handleMessage.js`** (existing file, modified): one new GLOBAL check added alongside the
  existing menu/raise-ticket/price-enquiry checks — `if (quotationMap.has(sender))`, forward the
  message to that quotation's thread and return early, **before** the existing `isPriceEnquiry()`
  check runs. This is what implements decisions #2–#4: an attached or just-deduped phone's
  messages never reach the normal ticket-creation path while its quotation stays open.

## Error handling

- Discord REST calls (thread create, ping, post) are wrapped in try/catch, logged, and **never
  block the underlying DB write** — a quotation row always gets created even if Discord is
  briefly unavailable. The next reminder-poll cycle detects a quotation with no
  `discordThreadId` and retries thread creation, matching the codebase's existing
  resilience-over-perfection style (e.g. `sessionStore.js`'s `saveState`).
- Internal API auth failure → 401; the bot logs and retries on its next poll interval — never
  crashes the loop, same shape as its existing Postgres/Discord error handling.
- Duplicate-quotation race on the public endpoint (`app/api/quotations/route.ts`) is closed by
  its transaction-scoped dedup guard, not by a best-effort check-then-insert.
- All POST bodies validated with zod (matching `manualOrderSchema`) — 400 with field errors on
  failure, never silent coercion. The public endpoint's `orderType` is always server-set; client
  input for it is ignored, not merely validated (explicit acceptance criterion in the source
  spec).

## Testing

- **Vairis**: route-level tests for `/api/quotations` (dedup logic, `orderType` override
  ignored, zod rejection paths) and `/api/internal/quotations` (auth gate) — following whatever
  test-runner convention `/api/admin/orders` already uses (confirm exact tooling during
  plan-writing, not re-derived here). Additional coverage for the hardening pass: the convert-to-
  order route returns 409 and creates no order on a double-submit (quotation already
  CONVERTED/CANCELLED when the transaction re-checks status); `closeThread` is called exactly
  once on CONVERTED and once on dashboard-triggered CANCELLED; "Mark quoted" called twice
  overwrites `quotedAmount`/`quotedNotes` without erroring.
- **Bot**: extends the existing Jest suite (same test-double patterns already established, e.g.
  `makeFakeDiscordClient`) — `test/quotationMap.test.js` (attach/prune logic against a mocked
  internal-API response) and an addition to `test/handleMessage.test.js` covering the new global
  ref-check's ordering (an attached phone's message forwards to the quote thread instead of
  triggering `isPriceEnquiry()`/ticket creation). Additional coverage for the hardening pass:
  `test/reminderPoll.test.js` — first ping fires at `QUOTE_FIRST_REMINDER_MIN` not
  `QUOTE_REMINDER_INTERVAL_MIN`; escalation ping fires exactly once when `reminderCount` crosses
  `QUOTE_ESCALATION_AFTER_MISSES` and never fires again on subsequent cycles; `/quoted` called
  twice on the same quotation updates rather than errors; the poll runs once immediately at
  module load (fetch-on-boot) in addition to the interval.
- No new real-infra integration test is needed for this feature specifically — the existing real
  round-trip tests (Blob Storage, Postgres adapter) already cover those infrastructure layers;
  this feature is pure application logic layered on top of them.

## Explicitly out of scope (per source spec, restated for completeness)

Auto-creating an order when quoted; quote PDF/payment link/customer-facing quote page; historical
backfill of migrated `Enquiry: price enquiry` threads; any change to `#whatsapp-support-bot`'s
handling of non-price tickets.

## Env vars to collect before build

`DISCORD_QUOTE_CHANNEL_ID`, `DISCORD_QUOTE_ASSIGNEE_ID` (+ display username for copy),
`QUOTE_REMINDER_INTERVAL_MIN` (default 30), `QUOTE_FIRST_REMINDER_MIN` (default 10),
`DISCORD_ESCALATION_ID`, `QUOTE_ESCALATION_AFTER_MISSES` (default 3),
`QUOTE_STALE_QUOTED_HOURS` (default 24), `DISCORD_BOT_TOKEN` on Vercel (thread creation; the
bot already has its own copy for `/quoted`/`/reply`/`/close`), `INTERNAL_API_KEY` (reused, not
new — see decision #1; needs to be set on both the Vairis Vercel/Azure deployment and the bot's
Azure Container App if it isn't already).

**Stage isolation**: `DISCORD_QUOTE_CHANNEL_ID`, `DISCORD_QUOTE_ASSIGNEE_ID`, and
`DISCORD_ESCALATION_ID` take different values per environment, not one hardcoded set. Production
points at the real `#quote-requests-offline` channel, xperson, and Anil. Stage/local dev points
at a new `stage-quote-requests-offline` channel and test snowflakes (e.g. Nishi) — so test
traffic during implementation and QA never pings real staff. On the Vairis side this is Vercel's
existing Production vs. Preview env scoping; on the bot side it's `.env.prod` vs. a new
`.env.stage`/`.env.local`. No new deployment/infra required — same mechanism, different values.

## Reliability hardening (2026-08-22 session)

The 2026-08-20 design covered the happy path correctly but left every "does a human notice in
time" question implicit. This session's changes, in one place:

1. **Escalation** — a REQUESTED quotation that gets ignored past `QUOTE_ESCALATION_AFTER_MISSES`
   pings also pulls in `DISCORD_ESCALATION_ID` (Anil), once, in the same thread. Prevents a
   muted/OOO xperson from silently stalling a deal indefinitely.
2. **Faster first nudge** — first reminder at `QUOTE_FIRST_REMINDER_MIN` (10min) instead of
   waiting a full `QUOTE_REMINDER_INTERVAL_MIN` (30min) for the first ping.
3. **Dashboard staleness visibility** — age column + oldest-first default sort + flag +
   `?attention=true` filter, so the admin can triage without living in Discord. Extended to
   QUOTED (via `QUOTE_STALE_QUOTED_HOURS`) since a quoted-but-never-converted deal is just as
   easy to lose track of, even though it correctly gets no pings.
4. **Thread hygiene** — CONVERTED/CANCELLED post a closing message and archive, so
   `#quote-requests-offline` only shows live work. QUOTED threads are left alone (still mid-flow).
5. **Convert-to-order race guard** — double-submit (two tabs/two admins) on the same QUOTED
   quotation gets a 409 instead of a duplicate order.
6. **`/quoted` idempotency** — re-callable while QUOTED, so a typo'd amount doesn't require
   dashboard access to fix.
7. **Bot fetch-on-boot** — closes the up-to-30min blind spot where a bot restart would otherwise
   leave already-attached phones misrouted until the next poll cycle.
8. **Stage/prod channel + assignee separation** — test traffic never reaches real staff.

All of the above are additive to the 2026-08-20 design — no schema field or component described
there is removed or reshaped, only extended (new Quotation fields: `reminderCount`,
`escalatedAt`, `quotedAt`).
