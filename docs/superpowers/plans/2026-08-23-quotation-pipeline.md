# Quotation Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Quotation pipeline (manual + website intake, Discord threads with reminders/escalation, Convert to order) across the Vairis Next.js app and the Vairis_Customer_Bot WhatsApp/Discord worker, per `docs/superpowers/specs/2026-08-20-quotation-pipeline-design.md`.

**Architecture:** One Prisma `Quotation` model owned by Vairis. Next.js creates Discord threads via raw REST (it holds `DISCORD_BOT_TOKEN` but has no persistent gateway connection); the bot polls `/api/internal/quotations` (Bearer `INTERNAL_API_KEY`) for reminders/escalation and handles `/quoted /reply /close` using its existing live `discordClient` gateway connection. Quote machine and order machine stay independent until Convert to order.

**Tech Stack:** Next.js 14 App Router, Prisma 5, zod, Postgres (Supabase) — Vairis repo. Node.js, discord.js v14, whatsapp-web.js, Jest — Vairis_Customer_Bot repo.

**Repos:** `Vairis` (this repo) and `Vairis_Customer_Bot` (sibling directory `../Vairis_Customer_Bot`). Both are on branch `feature/quotation-pipeline` already. Every task below is tagged `[Vairis]` or `[Bot]` — run bot-tagged commands with `cd` into the bot repo (or use its absolute path).

**Source docs:** `docs/superpowers/specs/2026-08-18-quotation-pipeline.txt` (product spec) and `docs/superpowers/specs/2026-08-20-quotation-pipeline-design.md` (technical design, hardened 2026-08-22/23). Read the design doc's "Reliability hardening" and "Env vars" sections before starting — this plan implements them as specified there.

**Two design-doc gaps resolved during this plan's grounding pass (not separately re-documented per task, noted once here):**
1. `quotationMap` needs a `threadId`-keyed index (`byThread`), not just phone-keyed — manual quotations are frequently phoneless, so `/quoted`/`/close` would never resolve them otherwise (design doc already updated for this).
2. The bot's own Discord interactions (`reminderPoll.js`, `discordQuoteThreads.js`) use the bot's **existing live `discordClient` gateway connection** (`discordClient.channels.fetch(threadId)` → `.send()` / `.setArchived()`), exactly like `tickets.js`/`discordReplyHandler.js` already do — NOT raw REST fetch. Raw REST fetch (`lib/quotations.ts`) is Next.js-only, because Next.js has no gateway connection. The design doc's architecture diagram note about "no persistent gateway connection" describes Next.js's reason, not the bot's — the bot already has one.

---

## Task 1: Prisma schema — Quotation model

**Goal:** Add the `Quotation` model, its three enums, and `Order.quotationId` to the Vairis schema, then migrate.

**Files:**
- Modify: `[Vairis] prisma/schema.prisma`

**Acceptance Criteria:**
- [ ] `Quotation` model matches the design doc's hardened schema exactly (includes `reminderCount`, `escalatedAt`, `quotedAt`; does NOT include `reminderIntervalMin` — that field was deliberately dropped as dead weight).
- [ ] `Order.quotationId` is a plain optional unique scalar, no relation (informational only, per source spec).
- [ ] Migration applies cleanly against the local dev database.

**Verify:** `npx prisma validate && npx prisma migrate dev --name add_quotation` → migration created and applied with no errors; `npx prisma generate` runs as part of `migrate dev` automatically.

**Steps:**

- [ ] **Step 1: Add the enums + model to schema.prisma**

Insert this block after the closing `}` of `model Invoice` (line ~594) and before `model HeroImage`:

```prisma
// ── Quotations ───────────────────────────────────────────────────────────────

enum QuotationSource {
  MANUAL
  WEBSITE
}

enum QuotationStatus {
  REQUESTED
  QUOTED
  CONVERTED
  CANCELLED
}

enum QuotationOrderType {
  VAIRIS
  CUSTOMISATION
}

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
  reminderCount        Int               @default(0) // pings sent while REQUESTED; drives escalation
  escalatedAt         DateTime?          // set once, when reminderCount crosses the threshold
  quotedAmount        Int?
  quotedNotes         String?
  quotedAt            DateTime?          // set on REQUESTED->QUOTED transition; staleness clock for QUOTED
  orderId             String?            @unique // set on CONVERTED
  createdAt           DateTime           @default(now())
  updatedAt           DateTime           @updatedAt

  @@index([customerMobile, status]) // dedup/attach lookups
}
```

- [ ] **Step 2: Add `quotationId` to the existing `Order` model**

In `model Order` (around line 262, near `parentOrderId`), add:

```prisma
  quotationId   String?      @unique // informational only — no FK, quote machine stays independent
```

- [ ] **Step 3: Migrate**

```bash
npx prisma validate
npx prisma migrate dev --name add_quotation
```
Expected: migration file created under `prisma/migrations/`, applies with no errors, `npx prisma generate` runs automatically as part of `migrate dev`.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add Quotation model and Order.quotationId"
```

---

## Task 2: lib/quotations.ts — transitions, displayId generator, unique-insert helper

**Goal:** Core quotation domain logic Next.js routes will import: the transition graph, the short `Q-XXXX` id generator, and a retry helper for the rare id collision.

**Files:**
- Create: `[Vairis] lib/quotations.ts`
- Test: `[Vairis] __tests__/lib/quotations.test.ts`

**Acceptance Criteria:**
- [ ] `QUOTATION_TRANSITIONS.REQUESTED` allows only `['QUOTED', 'CANCELLED']`; `QUOTED` allows only `['CONVERTED', 'CANCELLED']`; `CONVERTED`/`CANCELLED` have no outgoing transitions.
- [ ] `generateQuotationDisplayId` always returns `Q-` followed by 4 uppercase alphanumerics, even with no customer info at all (`anon`/`nophone`/`nosku` fallbacks).
- [ ] `createWithUniqueDisplayId` retries up to 5 times on a Prisma `P2002` (unique constraint) error, and rethrows immediately on any other error.

**Verify:** `npx jest __tests__/lib/quotations.test.ts -v` → all pass.

**Steps:**

- [ ] **Step 1: Write the failing tests**

```typescript
// __tests__/lib/quotations.test.ts
import { generateQuotationDisplayId, createWithUniqueDisplayId, QUOTATION_TRANSITIONS } from '@/lib/quotations'
import { Prisma } from '@prisma/client'

describe('generateQuotationDisplayId', () => {
  it('produces a Q-XXXX id even with no customer info at all', () => {
    const id = generateQuotationDisplayId({})
    expect(id).toMatch(/^Q-[0-9A-Z]{4}$/)
  })

  it('produces a different id for different seeds', () => {
    const a = generateQuotationDisplayId({ customerName: 'Asha', customerMobile: '9876543210' })
    const b = generateQuotationDisplayId({ customerName: 'Kiran', customerMobile: '9123456780' })
    expect(a).not.toBe(b)
  })
})

describe('createWithUniqueDisplayId', () => {
  function p2002() {
    return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '5.0.0',
    })
  }

  it('returns the created record on the first successful attempt', async () => {
    const create = jest.fn(async (displayId: string) => ({ id: '1', displayId }))
    const result = await createWithUniqueDisplayId({}, create)
    expect(result.id).toBe('1')
    expect(create).toHaveBeenCalledTimes(1)
  })

  it('retries with a new displayId on a unique constraint violation', async () => {
    const create = jest
      .fn()
      .mockRejectedValueOnce(p2002())
      .mockRejectedValueOnce(p2002())
      .mockResolvedValueOnce({ id: '1', displayId: 'Q-ABCD' })
    const result = await createWithUniqueDisplayId({}, create)
    expect(result.id).toBe('1')
    expect(create).toHaveBeenCalledTimes(3)
  })

  it('gives up after 5 attempts of persistent conflicts', async () => {
    const create = jest.fn().mockRejectedValue(p2002())
    await expect(createWithUniqueDisplayId({}, create)).rejects.toThrow()
    expect(create).toHaveBeenCalledTimes(5)
  })

  it('rethrows immediately on a non-conflict error', async () => {
    const create = jest.fn().mockRejectedValue(new Error('db down'))
    await expect(createWithUniqueDisplayId({}, create)).rejects.toThrow('db down')
    expect(create).toHaveBeenCalledTimes(1)
  })
})

describe('QUOTATION_TRANSITIONS', () => {
  it('allows REQUESTED to move to QUOTED or CANCELLED only', () => {
    expect(QUOTATION_TRANSITIONS.REQUESTED).toEqual(['QUOTED', 'CANCELLED'])
  })

  it('allows QUOTED to move to CONVERTED or CANCELLED only', () => {
    expect(QUOTATION_TRANSITIONS.QUOTED).toEqual(['CONVERTED', 'CANCELLED'])
  })

  it('has no transitions out of terminal states', () => {
    expect(QUOTATION_TRANSITIONS.CONVERTED).toBeUndefined()
    expect(QUOTATION_TRANSITIONS.CANCELLED).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest __tests__/lib/quotations.test.ts -v`
Expected: FAIL — `Cannot find module '@/lib/quotations'`

- [ ] **Step 3: Write the implementation**

```typescript
// lib/quotations.ts
import { Prisma, QuotationStatus } from '@prisma/client'
import { createHash, randomBytes } from 'crypto'

/** Admin/bot-driven quotation transitions. CONVERTED and CANCELLED are terminal. */
export const QUOTATION_TRANSITIONS: Partial<Record<QuotationStatus, QuotationStatus[]>> = {
  REQUESTED: ['QUOTED', 'CANCELLED'],
  QUOTED: ['CONVERTED', 'CANCELLED'],
}

function slugPart(v: string | null | undefined, fallback: string, max = 12): string {
  if (!v) return fallback
  const slug = v.trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
  return slug.slice(0, max) || fallback
}

/**
 * Seed string per the source spec (username_mobile_productId collides too often since phone is
 * frequently missing) — not stored, just entropy for the short displayId suffix below.
 */
function buildDisplayIdSeed(input: {
  customerName?: string | null
  customerMobile?: string | null
  sku?: string | null
}): string {
  const slugName = slugPart(input.customerName, 'anon')
  const last10phone = input.customerMobile
    ? input.customerMobile.replace(/\D/g, '').slice(-10) || 'nophone'
    : 'nophone'
  const sku = slugPart(input.sku, 'nosku')
  return `q_${slugName}_${last10phone}_${sku}_${randomBytes(4).toString('hex')}`
}

/** Short display id shown in the UI and Discord thread names, e.g. "Q-7K2M". */
export function generateQuotationDisplayId(input: {
  customerName?: string | null
  customerMobile?: string | null
  sku?: string | null
}): string {
  const seed = buildDisplayIdSeed(input)
  const digest = createHash('sha1').update(seed).digest()
  const suffix = digest.readUInt32BE(0).toString(36).toUpperCase().padStart(4, '0').slice(-4)
  return `Q-${suffix}`
}

/**
 * displayId has ~1.6M possible values (36^4) — collisions are rare but not impossible under
 * concurrent creation. Retries with a fresh seed on a unique constraint violation rather than
 * trusting a single generated id.
 */
export async function createWithUniqueDisplayId<T>(
  seedInput: { customerName?: string | null; customerMobile?: string | null; sku?: string | null },
  create: (displayId: string) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const displayId = generateQuotationDisplayId(seedInput)
    try {
      return await create(displayId)
    } catch (err) {
      const isUniqueViolation =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
      if (isUniqueViolation && attempt < 4) continue
      throw err
    }
  }
  throw new Error('unreachable')
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest __tests__/lib/quotations.test.ts -v`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/quotations.ts __tests__/lib/quotations.test.ts
git commit -m "feat: add quotation transitions, displayId generator, unique-insert helper"
```

---

## Task 3: lib/quotations.ts — Discord REST helpers + internal-API auth check

**Goal:** Add the raw Discord REST v10 helpers Next.js uses (it has no gateway connection) plus the shared Bearer-auth check for the bot-facing internal API.

**Files:**
- Modify: `[Vairis] lib/quotations.ts`
- Test: `[Vairis] __tests__/lib/quotations-discord.test.ts`

**Acceptance Criteria:**
- [ ] `createQuoteThread` POSTs to `/channels/{DISCORD_QUOTE_CHANNEL_ID}/threads` and returns the new thread id.
- [ ] `closeThread` posts the given message, then archives the thread (in that order).
- [ ] `mentionAssignee` returns `<@id>` when `DISCORD_QUOTE_ASSIGNEE_ID` is set, `''` otherwise (never throws).
- [ ] A non-ok Discord response throws with the status code in the message.
- [ ] `isInternalApiAuthorized` returns true only when the `Authorization` header exactly matches `Bearer ${INTERNAL_API_KEY}`.

**Verify:** `npx jest __tests__/lib/quotations-discord.test.ts -v` → all pass.

**Steps:**

- [ ] **Step 1: Write the failing tests**

```typescript
// __tests__/lib/quotations-discord.test.ts
import { NextRequest } from 'next/server'
import { createQuoteThread, postToThread, mentionAssignee, closeThread, isInternalApiAuthorized } from '@/lib/quotations'

const originalFetch = global.fetch

describe('Discord REST helpers', () => {
  beforeEach(() => {
    process.env.DISCORD_BOT_TOKEN = 'test-token'
    process.env.DISCORD_QUOTE_CHANNEL_ID = 'chan-1'
    process.env.DISCORD_QUOTE_ASSIGNEE_ID = 'user-1'
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('createQuoteThread posts to the channel and returns the new thread id', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'thread-9' }) }) as never
    const threadId = await createQuoteThread('Q-7K2M · vairis · Kurnool bracelet')
    expect(threadId).toBe('thread-9')
    expect(global.fetch).toHaveBeenCalledWith(
      'https://discord.com/api/v10/channels/chan-1/threads',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('throws with the response status on a non-ok Discord response', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 403, text: async () => 'Missing Access' }) as never
    await expect(createQuoteThread('x')).rejects.toThrow(/403/)
  })

  it('mentionAssignee returns a snowflake mention when set, empty string otherwise', () => {
    expect(mentionAssignee()).toBe('<@user-1>')
    delete process.env.DISCORD_QUOTE_ASSIGNEE_ID
    expect(mentionAssignee()).toBe('')
  })

  it('closeThread posts the message then archives the thread, in that order', async () => {
    const calls: string[] = []
    global.fetch = jest.fn(async (url: string, init: RequestInit) => {
      calls.push(`${init.method} ${url}`)
      return { ok: true, json: async () => ({}), text: async () => '' }
    }) as never
    await closeThread('thread-9', 'Cancelled')
    expect(calls).toEqual([
      'POST https://discord.com/api/v10/channels/thread-9/messages',
      'PATCH https://discord.com/api/v10/channels/thread-9',
    ])
  })
})

describe('isInternalApiAuthorized', () => {
  beforeEach(() => {
    process.env.INTERNAL_API_KEY = 'secret-key'
  })

  it('accepts the exact Bearer token', () => {
    const req = new NextRequest('http://localhost/api/internal/quotations', {
      headers: { authorization: 'Bearer secret-key' },
    })
    expect(isInternalApiAuthorized(req)).toBe(true)
  })

  it('rejects a missing or wrong header', () => {
    const noAuth = new NextRequest('http://localhost/api/internal/quotations')
    const wrongAuth = new NextRequest('http://localhost/api/internal/quotations', {
      headers: { authorization: 'Bearer wrong' },
    })
    expect(isInternalApiAuthorized(noAuth)).toBe(false)
    expect(isInternalApiAuthorized(wrongAuth)).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest __tests__/lib/quotations-discord.test.ts -v`
Expected: FAIL — the named exports don't exist yet.

- [ ] **Step 3: Append to lib/quotations.ts**

```typescript
import type { NextRequest } from 'next/server'

const DISCORD_API = 'https://discord.com/api/v10'

function discordHeaders() {
  return {
    Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
    'Content-Type': 'application/json',
  }
}

async function discordFetch(path: string, init: RequestInit) {
  const res = await fetch(`${DISCORD_API}${path}`, { ...init, headers: discordHeaders() })
  if (!res.ok) {
    throw new Error(`Discord API ${init.method ?? 'GET'} ${path} failed: ${res.status} ${await res.text()}`)
  }
  return res
}

/** Creates a public thread directly on the quote channel (no starter message needed). */
export async function createQuoteThread(name: string): Promise<string> {
  const channelId = process.env.DISCORD_QUOTE_CHANNEL_ID
  const res = await discordFetch(`/channels/${channelId}/threads`, {
    method: 'POST',
    body: JSON.stringify({ name: name.slice(0, 100), auto_archive_duration: 60, type: 11 }),
  })
  const data = await res.json()
  return data.id as string
}

export async function postToThread(threadId: string, content: string): Promise<void> {
  await discordFetch(`/channels/${threadId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  })
}

/** `<@id>` mention for DISCORD_QUOTE_ASSIGNEE_ID, or '' if unset (never crashes thread creation). */
export function mentionAssignee(): string {
  const id = process.env.DISCORD_QUOTE_ASSIGNEE_ID
  return id ? `<@${id}>` : ''
}

/** Posts a closing message and archives the thread — called on CONVERTED and CANCELLED. */
export async function closeThread(threadId: string, message: string): Promise<void> {
  await postToThread(threadId, message)
  await discordFetch(`/channels/${threadId}`, {
    method: 'PATCH',
    body: JSON.stringify({ archived: true }),
  })
}

/** Shared Bearer-auth check for every /api/internal/quotations* route (bot-only). */
export function isInternalApiAuthorized(req: NextRequest): boolean {
  return req.headers.get('authorization') === `Bearer ${process.env.INTERNAL_API_KEY}`
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest __tests__/lib/quotations-discord.test.ts -v`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/quotations.ts __tests__/lib/quotations-discord.test.ts
git commit -m "feat: add Discord REST helpers and internal-API auth check"
```

---

## Task 4: Public quotation intake route

**Goal:** `POST /api/quotations` — the PDP modal's and the bot's keyword-fallback path's shared entry point. Always writes `orderType: VAIRIS`; dedups by open (REQUESTED/QUOTED) quotation per mobile.

**Files:**
- Create: `[Vairis] app/api/quotations/route.ts`
- Test: `[Vairis] __tests__/api/quotations.test.ts`

**Acceptance Criteria:**
- [ ] Requires `customerName` + `customerMobile`; `details` optional; any client-supplied `orderType` is ignored (always `VAIRIS`).
- [ ] A repeat POST from a mobile with an existing REQUESTED/QUOTED quotation returns that same quotation (200), not a new one (201).
- [ ] Response includes `{ id, displayId, status, customerMobile, discordThreadId }` — the bot needs all of these to populate its local `quotationMap` immediately (Task 21).
- [ ] Discord thread-creation failure never blocks the 201/200 response — quotation row is created regardless.
- [ ] Route has `export const dynamic = 'force-dynamic'`.

**Verify:** `npx jest __tests__/api/quotations.test.ts -v` → all pass.

**Steps:**

- [ ] **Step 1: Write the failing tests**

```typescript
// __tests__/api/quotations.test.ts
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/quotations/route'
import { prisma } from '@/lib/prisma'
import * as quotations from '@/lib/quotations'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    quotation: { create: jest.fn(), update: jest.fn() },
    $transaction: jest.fn((cb) => cb(prisma)),
    $queryRaw: jest.fn(),
  },
}))
jest.mock('@/lib/quotations', () => ({
  ...jest.requireActual('@/lib/quotations'),
  createQuoteThread: jest.fn(),
  postToThread: jest.fn(),
  mentionAssignee: jest.fn(() => '<@assignee>'),
}))

const mockPrisma = prisma as unknown as {
  quotation: { create: jest.Mock; update: jest.Mock }
  $queryRaw: jest.Mock
}

function req(body: unknown) {
  return new NextRequest('http://localhost/api/quotations', { method: 'POST', body: JSON.stringify(body) })
}

describe('POST /api/quotations', () => {
  beforeEach(() => jest.clearAllMocks())

  it('rejects a request with no customerMobile', async () => {
    const res = await POST(req({ customerName: 'Asha' }))
    expect(res.status).toBe(400)
  })

  it('creates a REQUESTED VAIRIS quotation, ignoring a client-supplied orderType', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([])
    mockPrisma.quotation.create.mockResolvedValue({
      id: 'q1', displayId: 'Q-ABCD', status: 'REQUESTED', customerMobile: '919876543210', discordThreadId: null,
    })
    ;(quotations.createQuoteThread as jest.Mock).mockResolvedValue('thread-1')

    const res = await POST(req({
      customerName: 'Asha', customerMobile: '919876543210', orderType: 'CUSTOMISATION',
    }))
    expect(res.status).toBe(201)
    expect(mockPrisma.quotation.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ orderType: 'VAIRIS', source: 'WEBSITE' }) }),
    )
  })

  it('reuses an existing open quotation for the same mobile instead of creating a duplicate', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ id: 'existing-1' }])
    ;(prisma as any).quotation.findUniqueOrThrow = jest.fn().mockResolvedValue({
      id: 'existing-1', displayId: 'Q-EXST', status: 'REQUESTED', customerMobile: '919876543210', discordThreadId: 'thread-old',
    })

    const res = await POST(req({ customerName: 'Asha', customerMobile: '919876543210' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.id).toBe('existing-1')
    expect(mockPrisma.quotation.create).not.toHaveBeenCalled()
  })

  it('still returns 201 when Discord thread creation fails', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([])
    mockPrisma.quotation.create.mockResolvedValue({
      id: 'q2', displayId: 'Q-FAIL', status: 'REQUESTED', customerMobile: '919876543211', discordThreadId: null,
    })
    ;(quotations.createQuoteThread as jest.Mock).mockRejectedValue(new Error('Discord down'))

    const res = await POST(req({ customerName: 'Asha', customerMobile: '919876543211' }))
    expect(res.status).toBe(201)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest __tests__/api/quotations.test.ts -v`
Expected: FAIL — `Cannot find module '@/app/api/quotations/route'`

- [ ] **Step 3: Write the implementation**

```typescript
// app/api/quotations/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createWithUniqueDisplayId, createQuoteThread, postToThread, mentionAssignee } from '@/lib/quotations'

export const dynamic = 'force-dynamic'

const publicQuotationSchema = z.object({
  customerName: z.string().trim().min(1).max(100),
  customerMobile: z.string().trim().regex(/^\d{7,15}$/, 'Valid mobile number required'),
  details: z.string().trim().max(1000).optional(),
})

/**
 * POST /api/quotations — public. Used by the PDP "Enquire on WhatsApp" modal AND by the bot's
 * WhatsApp keyword-fallback path (no ref in the message). orderType is always VAIRIS here —
 * Customisation quotes only come from the admin manual-intake form.
 */
export async function POST(req: NextRequest) {
  const parsed = publicQuotationSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  }
  const d = parsed.data

  const result = await prisma.$transaction(async (tx) => {
    // Dedup: one open quotation per mobile. FOR UPDATE locks any existing open row so a burst of
    // rapid submissions from the same phone can't race past this check.
    const existingRows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Quotation"
      WHERE "customerMobile" = ${d.customerMobile} AND status IN ('REQUESTED', 'QUOTED')
      FOR UPDATE
    `
    if (existingRows.length > 0) {
      const existing = await tx.quotation.findUniqueOrThrow({ where: { id: existingRows[0].id } })
      return { quotation: existing, created: false }
    }

    const quotation = await createWithUniqueDisplayId(
      { customerName: d.customerName, customerMobile: d.customerMobile },
      (displayId) =>
        tx.quotation.create({
          data: {
            displayId,
            source: 'WEBSITE',
            orderType: 'VAIRIS',
            customerName: d.customerName,
            customerMobile: d.customerMobile,
            details: d.details,
          },
        }),
    )
    return { quotation, created: true }
  })

  if (result.created) {
    try {
      const threadId = await createQuoteThread(`${result.quotation.displayId} · vairis · ${d.customerName}`)
      const updated = await prisma.quotation.update({
        where: { id: result.quotation.id },
        data: { discordThreadId: threadId },
      })
      result.quotation = updated
      await postToThread(
        threadId,
        `${mentionAssignee()} New website quotation request\n**Customer:** ${d.customerName}\n**Mobile:** ${d.customerMobile}${d.details ? `\n**Details:** ${d.details}` : ''}`,
      )
    } catch (err) {
      // Never blocks the response — reminderPoll retries thread creation (Task 19).
      console.error('[api/quotations] Discord thread creation failed', err)
    }
  }

  return NextResponse.json(
    {
      id: result.quotation.id,
      displayId: result.quotation.displayId,
      status: result.quotation.status,
      customerMobile: result.quotation.customerMobile,
      discordThreadId: result.quotation.discordThreadId,
    },
    { status: result.created ? 201 : 200 },
  )
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest __tests__/api/quotations.test.ts -v`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/quotations __tests__/api/quotations.test.ts
git commit -m "feat: add public quotation intake route with mobile dedup"
```

---

## Task 5: Admin quotations route — manual intake (POST) + list (GET)

**Goal:** `POST /api/admin/quotations` for the dashboard manual-intake form (`orderType` required, no default); `GET /api/admin/quotations` for the list page, supporting `?status=` and `?attention=true`.

**Files:**
- Create: `[Vairis] app/api/admin/quotations/route.ts`
- Test: `[Vairis] __tests__/api/admin/quotations.test.ts`

**Acceptance Criteria:**
- [ ] POST rejects a request with no `orderType` (400) — no default value.
- [ ] POST accepts optional `customerName`, `customerMobile`, `productId`, `screenshotUrls`, and required `details`.
- [ ] GET with no query params returns everything, oldest-`createdAt`-first.
- [ ] GET `?status=QUOTED` sorts by `quotedAt` ascending instead.
- [ ] GET `?attention=true` returns only REQUESTED rows with `escalatedAt` set, or QUOTED rows older than `QUOTE_STALE_QUOTED_HOURS` hours (default 24) since `quotedAt`.
- [ ] Both routes call `requireAdmin()` first.

**Verify:** `npx jest __tests__/api/admin/quotations.test.ts -v` → all pass.

**Steps:**

- [ ] **Step 1: Write the failing tests**

```typescript
// __tests__/api/admin/quotations.test.ts
import { NextRequest } from 'next/server'
import { POST, GET } from '@/app/api/admin/quotations/route'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import * as quotations from '@/lib/quotations'

jest.mock('@/lib/prisma', () => ({
  prisma: { quotation: { create: jest.fn(), findMany: jest.fn(), update: jest.fn() } },
}))
jest.mock('@/lib/auth', () => ({ requireAdmin: jest.fn() }))
jest.mock('@/lib/quotations', () => ({
  ...jest.requireActual('@/lib/quotations'),
  createQuoteThread: jest.fn().mockResolvedValue('thread-1'),
  postToThread: jest.fn(),
  mentionAssignee: jest.fn(() => '<@assignee>'),
}))

function postReq(body: unknown) {
  return new NextRequest('http://localhost/api/admin/quotations', { method: 'POST', body: JSON.stringify(body) })
}
function getReq(query: string) {
  return new NextRequest(`http://localhost/api/admin/quotations${query}`)
}

describe('POST /api/admin/quotations', () => {
  beforeEach(() => jest.clearAllMocks())

  it('rejects a request with no orderType', async () => {
    const res = await POST(postReq({ details: 'Kurnool bracelet quotation' }))
    expect(res.status).toBe(400)
  })

  it('creates a REQUESTED MANUAL quotation with the given orderType', async () => {
    ;(prisma.quotation.create as jest.Mock).mockResolvedValue({
      id: 'q1', displayId: 'Q-ABCD', discordThreadId: null,
    })
    const res = await POST(postReq({ orderType: 'CUSTOMISATION', details: 'Kurnool bracelet quotation' }))
    expect(res.status).toBe(201)
    expect(prisma.quotation.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ source: 'MANUAL', orderType: 'CUSTOMISATION' }) }),
    )
    expect(requireAdmin).toHaveBeenCalled()
  })
})

describe('GET /api/admin/quotations', () => {
  beforeEach(() => jest.clearAllMocks())

  it('defaults to oldest-createdAt-first with no filter', async () => {
    ;(prisma.quotation.findMany as jest.Mock).mockResolvedValue([])
    await GET(getReq(''))
    expect(prisma.quotation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'asc' } }),
    )
  })

  it('sorts by quotedAt when filtering to QUOTED', async () => {
    ;(prisma.quotation.findMany as jest.Mock).mockResolvedValue([])
    await GET(getReq('?status=QUOTED'))
    expect(prisma.quotation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'QUOTED' }, orderBy: { quotedAt: 'asc' } }),
    )
  })

  it('?attention=true filters to escalated REQUESTED or stale QUOTED', async () => {
    ;(prisma.quotation.findMany as jest.Mock).mockResolvedValue([])
    await GET(getReq('?attention=true'))
    const call = (prisma.quotation.findMany as jest.Mock).mock.calls[0][0]
    expect(call.where.OR).toHaveLength(2)
    expect(call.where.OR[0]).toEqual({ status: 'REQUESTED', escalatedAt: { not: null } })
    expect(call.where.OR[1].status).toBe('QUOTED')
    expect(call.where.OR[1].quotedAt.lt).toBeInstanceOf(Date)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest __tests__/api/admin/quotations.test.ts -v`
Expected: FAIL — module doesn't exist yet.

- [ ] **Step 3: Write the implementation**

```typescript
// app/api/admin/quotations/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { QuotationStatus } from '@prisma/client'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createWithUniqueDisplayId, createQuoteThread, postToThread, mentionAssignee } from '@/lib/quotations'

export const dynamic = 'force-dynamic'

const manualQuotationSchema = z.object({
  orderType: z.enum(['VAIRIS', 'CUSTOMISATION']),
  details: z.string().trim().min(1).max(2000),
  customerName: z.string().trim().max(100).optional(),
  customerMobile: z.string().trim().regex(/^\d{7,15}$/).optional().or(z.literal('')),
  productId: z.string().trim().optional(),
  screenshotUrls: z.array(z.string().url()).max(6).optional(),
})

/** POST /api/admin/quotations — manual/dashboard intake. orderType is required, no default. */
export async function POST(req: NextRequest) {
  await requireAdmin()

  const parsed = manualQuotationSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  }
  const d = parsed.data

  const quotation = await createWithUniqueDisplayId(
    { customerName: d.customerName, customerMobile: d.customerMobile, sku: d.productId },
    (displayId) =>
      prisma.quotation.create({
        data: {
          displayId,
          source: 'MANUAL',
          orderType: d.orderType,
          details: d.details,
          customerName: d.customerName || null,
          customerMobile: d.customerMobile || null,
          productId: d.productId || null,
          screenshotUrls: d.screenshotUrls ?? [],
        },
      }),
  )

  try {
    const threadId = await createQuoteThread(
      `${quotation.displayId} · ${d.orderType.toLowerCase()} · ${d.details.slice(0, 60)}`,
    )
    await prisma.quotation.update({ where: { id: quotation.id }, data: { discordThreadId: threadId } })
    await postToThread(
      threadId,
      `${mentionAssignee()} New ${d.orderType.toLowerCase()} quotation request\n**Details:** ${d.details}${d.customerName ? `\n**Customer:** ${d.customerName}` : ''}${d.customerMobile ? `\n**Mobile:** ${d.customerMobile}` : ''}`,
    )
  } catch (err) {
    console.error('[api/admin/quotations] Discord thread creation failed', err)
  }

  return NextResponse.json({ id: quotation.id, displayId: quotation.displayId }, { status: 201 })
}

/** GET /api/admin/quotations?status=&attention=true — dashboard list. */
export async function GET(req: NextRequest) {
  await requireAdmin()

  const status = req.nextUrl.searchParams.get('status') as QuotationStatus | null
  const attention = req.nextUrl.searchParams.get('attention') === 'true'
  const staleHours = Number(process.env.QUOTE_STALE_QUOTED_HOURS ?? 24)
  const staleThreshold = new Date(Date.now() - staleHours * 60 * 60 * 1000)

  const where = attention
    ? {
        OR: [
          { status: 'REQUESTED' as const, escalatedAt: { not: null } },
          { status: 'QUOTED' as const, quotedAt: { lt: staleThreshold } },
        ],
      }
    : status
      ? { status }
      : undefined

  const quotations = await prisma.quotation.findMany({
    where,
    orderBy: status === 'QUOTED' ? { quotedAt: 'asc' } : { createdAt: 'asc' },
    take: 200,
  })
  return NextResponse.json(quotations)
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest __tests__/api/admin/quotations.test.ts -v`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/quotations/route.ts __tests__/api/admin/quotations.test.ts
git commit -m "feat: add admin quotation manual-intake and list routes"
```

---

## Task 6: Admin quotation detail route — GET + PATCH (Mark quoted / Cancel)

**Goal:** `GET /api/admin/quotations/[id]` for the detail page; `PATCH` for the dashboard's "Mark quoted" and "Cancel" actions, transition-gated by `QUOTATION_TRANSITIONS`.

**Files:**
- Create: `[Vairis] app/api/admin/quotations/[id]/route.ts`
- Test: `[Vairis] __tests__/api/admin/quotations-id.test.ts`

**Acceptance Criteria:**
- [ ] GET 404s on an unknown id.
- [ ] `action: 'mark_quoted'` is rejected with 409 unless current status is REQUESTED.
- [ ] `action: 'mark_quoted'` sets `status: QUOTED`, `quotedAt: now`, and optional `quotedAmount`/`quotedNotes` — callable again while still QUOTED to overwrite them (idempotent, per the hardening pass).
- [ ] `action: 'cancel'` sets `status: CANCELLED` and calls `closeThread` when a `discordThreadId` exists.
- [ ] `action: 'cancel'` is rejected with 409 from a terminal state (CONVERTED/CANCELLED).

**Verify:** `npx jest __tests__/api/admin/quotations-id.test.ts -v` → all pass.

**Steps:**

- [ ] **Step 1: Write the failing tests**

```typescript
// __tests__/api/admin/quotations-id.test.ts
import { NextRequest } from 'next/server'
import { GET, PATCH } from '@/app/api/admin/quotations/[id]/route'
import { prisma } from '@/lib/prisma'
import * as quotations from '@/lib/quotations'

jest.mock('@/lib/prisma', () => ({
  prisma: { quotation: { findUnique: jest.fn(), update: jest.fn() } },
}))
jest.mock('@/lib/auth', () => ({ requireAdmin: jest.fn() }))
jest.mock('@/lib/quotations', () => ({
  ...jest.requireActual('@/lib/quotations'),
  closeThread: jest.fn(),
}))

function patchReq(body: unknown) {
  return new NextRequest('http://localhost/api/admin/quotations/q1', { method: 'PATCH', body: JSON.stringify(body) })
}

describe('GET /api/admin/quotations/[id]', () => {
  it('404s on an unknown id', async () => {
    ;(prisma.quotation.findUnique as jest.Mock).mockResolvedValue(null)
    const res = await GET(new NextRequest('http://localhost/x'), { params: Promise.resolve({ id: 'missing' }) })
    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/admin/quotations/[id]', () => {
  beforeEach(() => jest.clearAllMocks())

  it('mark_quoted is rejected from a non-REQUESTED status', async () => {
    ;(prisma.quotation.findUnique as jest.Mock).mockResolvedValue({ id: 'q1', status: 'QUOTED', discordThreadId: null })
    const res = await PATCH(patchReq({ action: 'mark_quoted' }), { params: Promise.resolve({ id: 'q1' }) })
    expect(res.status).toBe(409)
    expect(prisma.quotation.update).not.toHaveBeenCalled()
  })

  it('mark_quoted sets QUOTED + quotedAt + optional amount/notes', async () => {
    ;(prisma.quotation.findUnique as jest.Mock).mockResolvedValue({ id: 'q1', status: 'REQUESTED', discordThreadId: null })
    ;(prisma.quotation.update as jest.Mock).mockResolvedValue({ id: 'q1', status: 'QUOTED', discordThreadId: null })
    const res = await PATCH(
      patchReq({ action: 'mark_quoted', quotedAmount: 45000, quotedNotes: 'Discussed at the store' }),
      { params: Promise.resolve({ id: 'q1' }) },
    )
    expect(res.status).toBe(200)
    expect(prisma.quotation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'QUOTED', quotedAmount: 45000, quotedNotes: 'Discussed at the store' }),
      }),
    )
  })

  it('mark_quoted can be called again while still QUOTED to overwrite amount/notes', async () => {
    ;(prisma.quotation.findUnique as jest.Mock).mockResolvedValue({ id: 'q1', status: 'REQUESTED', discordThreadId: null })
    ;(prisma.quotation.update as jest.Mock).mockResolvedValue({ id: 'q1', status: 'QUOTED', discordThreadId: null })
    const res = await PATCH(patchReq({ action: 'mark_quoted', quotedAmount: 50000 }), { params: Promise.resolve({ id: 'q1' }) })
    expect(res.status).toBe(200)
  })

  it('cancel closes the Discord thread when one exists', async () => {
    ;(prisma.quotation.findUnique as jest.Mock).mockResolvedValue({ id: 'q1', status: 'REQUESTED', discordThreadId: 'thread-1' })
    ;(prisma.quotation.update as jest.Mock).mockResolvedValue({ id: 'q1', status: 'CANCELLED', discordThreadId: 'thread-1' })
    const res = await PATCH(patchReq({ action: 'cancel' }), { params: Promise.resolve({ id: 'q1' }) })
    expect(res.status).toBe(200)
    expect(quotations.closeThread).toHaveBeenCalledWith('thread-1', expect.stringContaining('Cancelled'))
  })

  it('cancel is rejected from a terminal status', async () => {
    ;(prisma.quotation.findUnique as jest.Mock).mockResolvedValue({ id: 'q1', status: 'CONVERTED', discordThreadId: null })
    const res = await PATCH(patchReq({ action: 'cancel' }), { params: Promise.resolve({ id: 'q1' }) })
    expect(res.status).toBe(409)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest __tests__/api/admin/quotations-id.test.ts -v`
Expected: FAIL — module doesn't exist yet.

- [ ] **Step 3: Write the implementation**

```typescript
// app/api/admin/quotations/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { QuotationStatus } from '@prisma/client'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { QUOTATION_TRANSITIONS, closeThread } from '@/lib/quotations'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  const quotation = await prisma.quotation.findUnique({ where: { id } })
  if (!quotation) return NextResponse.json({ error: 'Quotation not found' }, { status: 404 })
  return NextResponse.json(quotation)
}

const patchSchema = z.object({
  action: z.enum(['mark_quoted', 'cancel']),
  quotedAmount: z.number().int().positive().optional(),
  quotedNotes: z.string().trim().max(500).optional(),
})

/** PATCH /api/admin/quotations/[id] — dashboard "Mark quoted" / "Cancel" actions. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  }
  const { action, quotedAmount, quotedNotes } = parsed.data

  const quotation = await prisma.quotation.findUnique({ where: { id } })
  if (!quotation) return NextResponse.json({ error: 'Quotation not found' }, { status: 404 })

  const nextStatus: QuotationStatus = action === 'mark_quoted' ? 'QUOTED' : 'CANCELLED'
  const allowed = QUOTATION_TRANSITIONS[quotation.status] ?? []
  if (!allowed.includes(nextStatus)) {
    return NextResponse.json({ error: `Cannot move ${quotation.status} → ${nextStatus}` }, { status: 409 })
  }

  const updated = await prisma.quotation.update({
    where: { id },
    data:
      nextStatus === 'QUOTED'
        ? { status: 'QUOTED', quotedAt: new Date(), quotedAmount, quotedNotes }
        : { status: 'CANCELLED' },
  })

  if (nextStatus === 'CANCELLED' && updated.discordThreadId) {
    try {
      await closeThread(updated.discordThreadId, '❌ Cancelled (via dashboard).')
    } catch (err) {
      console.error('[api/admin/quotations/[id]] Discord close failed', err)
    }
  }

  return NextResponse.json(updated)
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest __tests__/api/admin/quotations-id.test.ts -v`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/quotations/[id] __tests__/api/admin/quotations-id.test.ts
git commit -m "feat: add admin quotation detail route with Mark quoted / Cancel"
```

---

## Task 7: Internal (bot-facing) quotation API

**Goal:** `GET /api/internal/quotations` (open quotations, for the reminder poll) and `PATCH /api/internal/quotations/[id]` (reminder bookkeeping, `/quoted`, `/close`, and the `retryThread` recovery hook) — both Bearer-authed with `INTERNAL_API_KEY`.

**Files:**
- Create: `[Vairis] app/api/internal/quotations/route.ts`
- Create: `[Vairis] app/api/internal/quotations/[id]/route.ts`
- Test: `[Vairis] __tests__/api/internal/quotations.test.ts`

**Acceptance Criteria:**
- [ ] Both routes 401 without a valid `Authorization: Bearer ${INTERNAL_API_KEY}` header.
- [ ] GET returns only REQUESTED/QUOTED quotations (CONVERTED/CANCELLED simply disappear from the response — that absence is what `quotationMap`'s pruning relies on, no separate "closed" list needed).
- [ ] PATCH with `status: 'QUOTED'` is rejected 409 unless the current status allows it (same `QUOTATION_TRANSITIONS` gate as the admin route).
- [ ] PATCH with `retryThread: true` on a quotation that already has a `discordThreadId` does nothing extra (idempotent) — only actually creates a thread when one is missing.
- [ ] PATCH with `retryThread: true` on a quotation with no `discordThreadId` calls `createQuoteThread` + `postToThread` and persists the new `discordThreadId`.

**Verify:** `npx jest __tests__/api/internal/quotations.test.ts -v` → all pass.

**Steps:**

- [ ] **Step 1: Write the failing tests**

```typescript
// __tests__/api/internal/quotations.test.ts
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/internal/quotations/route'
import { PATCH } from '@/app/api/internal/quotations/[id]/route'
import { prisma } from '@/lib/prisma'
import * as quotations from '@/lib/quotations'

jest.mock('@/lib/prisma', () => ({
  prisma: { quotation: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() } },
}))
jest.mock('@/lib/quotations', () => ({
  ...jest.requireActual('@/lib/quotations'),
  createQuoteThread: jest.fn(),
  postToThread: jest.fn(),
  mentionAssignee: jest.fn(() => '<@assignee>'),
}))

function authedReq(url: string, init: RequestInit = {}) {
  return new NextRequest(url, { ...init, headers: { ...init.headers, authorization: 'Bearer test-internal-key' } })
}

beforeAll(() => {
  process.env.INTERNAL_API_KEY = 'test-internal-key'
})

describe('GET /api/internal/quotations', () => {
  it('401s without a valid Bearer token', async () => {
    const res = await GET(new NextRequest('http://localhost/api/internal/quotations'))
    expect(res.status).toBe(401)
  })

  it('returns open quotations with the fields the bot needs', async () => {
    ;(prisma.quotation.findMany as jest.Mock).mockResolvedValue([{ id: 'q1', status: 'REQUESTED' }])
    const res = await GET(authedReq('http://localhost/api/internal/quotations'))
    expect(res.status).toBe(200)
    expect(prisma.quotation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: { in: ['REQUESTED', 'QUOTED'] } } }),
    )
  })
})

describe('PATCH /api/internal/quotations/[id]', () => {
  beforeEach(() => jest.clearAllMocks())

  function patchReq(body: unknown) {
    return authedReq('http://localhost/api/internal/quotations/q1', { method: 'PATCH', body: JSON.stringify(body) })
  }

  it('401s without a valid Bearer token', async () => {
    const res = await PATCH(
      new NextRequest('http://localhost/x', { method: 'PATCH', body: '{}' }),
      { params: Promise.resolve({ id: 'q1' }) },
    )
    expect(res.status).toBe(401)
  })

  it('writes back reminder bookkeeping fields', async () => {
    ;(prisma.quotation.update as jest.Mock).mockResolvedValue({ id: 'q1' })
    const res = await PATCH(
      patchReq({ lastReminderAt: new Date().toISOString(), reminderCount: 2 }),
      { params: Promise.resolve({ id: 'q1' }) },
    )
    expect(res.status).toBe(200)
    expect(prisma.quotation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ reminderCount: 2 }) }),
    )
  })

  it('rejects status: QUOTED when the current status forbids it', async () => {
    ;(prisma.quotation.findUnique as jest.Mock).mockResolvedValue({ id: 'q1', status: 'CONVERTED', discordThreadId: null })
    const res = await PATCH(patchReq({ status: 'QUOTED' }), { params: Promise.resolve({ id: 'q1' }) })
    expect(res.status).toBe(409)
  })

  it('retryThread creates a thread when discordThreadId is missing', async () => {
    ;(prisma.quotation.findUnique as jest.Mock).mockResolvedValue({ id: 'q1', displayId: 'Q-ABCD', status: 'REQUESTED', discordThreadId: null })
    ;(quotations.createQuoteThread as jest.Mock).mockResolvedValue('thread-new')
    ;(prisma.quotation.update as jest.Mock).mockResolvedValue({ id: 'q1', discordThreadId: 'thread-new' })
    const res = await PATCH(patchReq({ retryThread: true }), { params: Promise.resolve({ id: 'q1' }) })
    expect(res.status).toBe(200)
    expect(quotations.createQuoteThread).toHaveBeenCalled()
    expect(prisma.quotation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ discordThreadId: 'thread-new' }) }),
    )
  })

  it('retryThread is a no-op when a discordThreadId already exists', async () => {
    ;(prisma.quotation.findUnique as jest.Mock).mockResolvedValue({ id: 'q1', status: 'REQUESTED', discordThreadId: 'thread-existing' })
    ;(prisma.quotation.update as jest.Mock).mockResolvedValue({ id: 'q1', discordThreadId: 'thread-existing' })
    const res = await PATCH(patchReq({ retryThread: true }), { params: Promise.resolve({ id: 'q1' }) })
    expect(res.status).toBe(200)
    expect(quotations.createQuoteThread).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest __tests__/api/internal/quotations.test.ts -v`
Expected: FAIL — modules don't exist yet.

- [ ] **Step 3: Write app/api/internal/quotations/route.ts**

```typescript
// app/api/internal/quotations/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isInternalApiAuthorized } from '@/lib/quotations'

export const dynamic = 'force-dynamic'

/** GET /api/internal/quotations — bot-only. Every open quotation; closed ones simply disappear. */
export async function GET(req: NextRequest) {
  if (!isInternalApiAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const quotations = await prisma.quotation.findMany({
    where: { status: { in: ['REQUESTED', 'QUOTED'] } },
    select: {
      id: true,
      displayId: true,
      status: true,
      customerMobile: true,
      discordThreadId: true,
      lastReminderAt: true,
      reminderCount: true,
      escalatedAt: true,
      createdAt: true,
    },
  })
  return NextResponse.json(quotations)
}
```

- [ ] **Step 4: Write app/api/internal/quotations/[id]/route.ts**

```typescript
// app/api/internal/quotations/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import {
  QUOTATION_TRANSITIONS,
  isInternalApiAuthorized,
  createQuoteThread,
  postToThread,
  mentionAssignee,
} from '@/lib/quotations'

export const dynamic = 'force-dynamic'

const internalPatchSchema = z.object({
  lastReminderAt: z.string().datetime().optional(),
  reminderCount: z.number().int().min(0).optional(),
  escalatedAt: z.string().datetime().optional(),
  status: z.enum(['QUOTED', 'CANCELLED']).optional(),
  quotedAmount: z.number().int().positive().optional(),
  quotedNotes: z.string().trim().max(500).optional(),
  retryThread: z.boolean().optional(),
})

/**
 * PATCH /api/internal/quotations/[id] — bot-only. Serves three callers: reminderPoll's
 * bookkeeping write-back, the bot's /quoted and /close Discord commands, and the retryThread
 * recovery hook for a quotation whose thread creation failed at intake time.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isInternalApiAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const parsed = internalPatchSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  }
  const d = parsed.data

  const quotation = await prisma.quotation.findUnique({ where: { id } })
  if (!quotation) return NextResponse.json({ error: 'Quotation not found' }, { status: 404 })

  if (d.status) {
    const allowed = QUOTATION_TRANSITIONS[quotation.status] ?? []
    if (!allowed.includes(d.status)) {
      return NextResponse.json({ error: `Cannot move ${quotation.status} → ${d.status}` }, { status: 409 })
    }
  }

  let newThreadId: string | undefined
  if (d.retryThread && !quotation.discordThreadId) {
    try {
      newThreadId = await createQuoteThread(`${quotation.displayId} · retry`)
      await postToThread(newThreadId, `${mentionAssignee()} (Recovered thread — original creation failed.)`)
    } catch (err) {
      console.error('[api/internal/quotations/[id]] retryThread failed', err)
    }
  }

  const updated = await prisma.quotation.update({
    where: { id },
    data: {
      ...(d.lastReminderAt ? { lastReminderAt: new Date(d.lastReminderAt) } : {}),
      ...(d.reminderCount !== undefined ? { reminderCount: d.reminderCount } : {}),
      ...(d.escalatedAt ? { escalatedAt: new Date(d.escalatedAt) } : {}),
      ...(newThreadId ? { discordThreadId: newThreadId } : {}),
      ...(d.status === 'QUOTED'
        ? { status: 'QUOTED' as const, quotedAt: new Date(), quotedAmount: d.quotedAmount, quotedNotes: d.quotedNotes }
        : {}),
      ...(d.status === 'CANCELLED' ? { status: 'CANCELLED' as const } : {}),
    },
  })

  return NextResponse.json(updated)
}
```

This route is bot-authed via the Bearer token only — it deliberately never imports or calls `requireAdmin()` (there is no admin session on an internal bot-to-store call).

- [ ] **Step 5: Run to verify it passes**

Run: `npx jest __tests__/api/internal/quotations.test.ts -v`
Expected: PASS (7 tests)

- [ ] **Step 6: Commit**

```bash
git add app/api/internal/quotations __tests__/api/internal/quotations.test.ts
git commit -m "feat: add internal bot-facing quotation API with retryThread recovery"
```

---

## Task 8: Upload route — optional `folder` param

**Goal:** Let quote screenshots land under `quotations/screenshots/...` instead of the hardcoded `products/...` prefix, without changing default behavior for existing product-image callers.

**Files:**
- Modify: `[Vairis] app/api/admin/upload/route.ts`
- Test: `[Vairis] __tests__/api/admin/upload.test.ts`

**Acceptance Criteria:**
- [ ] Omitting `folder` in the form data keeps the existing `products/images/...` / `products/videos/...` paths (no behavior change for product image uploads).
- [ ] Passing `folder=quotations/screenshots` produces a path starting with `quotations/screenshots/images/...`.

**Verify:** `npx jest __tests__/api/admin/upload.test.ts -v` → all pass.

**Steps:**

- [ ] **Step 1: Write the failing tests**

```typescript
// __tests__/api/admin/upload.test.ts
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/admin/upload/route'
import { requireAdmin } from '@/lib/auth'

jest.mock('@/lib/auth', () => ({ requireAdmin: jest.fn() }))
jest.mock('sharp', () => () => ({
  resize: () => ({ jpeg: () => ({ toBuffer: async () => Buffer.from('fake-jpeg') }) }),
}))

const mockUpload = jest.fn().mockResolvedValue({ error: null })
const mockGetPublicUrl = jest.fn().mockReturnValue({ data: { publicUrl: 'https://cdn/x.jpg' } })
const mockCreateBucket = jest.fn().mockResolvedValue({ error: null })
jest.mock('@/lib/supabase-admin', () => ({
  getSupabaseAdmin: jest.fn(() => ({
    storage: {
      createBucket: mockCreateBucket,
      from: () => ({ upload: mockUpload, getPublicUrl: mockGetPublicUrl }),
    },
  })),
}))

function uploadReq(fields: Record<string, string | File>) {
  const formData = new FormData()
  for (const [k, v] of Object.entries(fields)) formData.append(k, v)
  return new NextRequest('http://localhost/api/admin/upload', { method: 'POST', body: formData })
}

describe('POST /api/admin/upload', () => {
  beforeEach(() => jest.clearAllMocks())

  it('defaults to the products/ path when folder is omitted', async () => {
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' })
    await POST(uploadReq({ file }))
    expect(mockUpload).toHaveBeenCalledWith(
      expect.stringMatching(/^products\/images\//), expect.anything(), expect.anything(),
    )
  })

  it('uses the given folder for quote screenshots', async () => {
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' })
    await POST(uploadReq({ file, folder: 'quotations/screenshots' }))
    expect(mockUpload).toHaveBeenCalledWith(
      expect.stringMatching(/^quotations\/screenshots\/images\//), expect.anything(), expect.anything(),
    )
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest __tests__/api/admin/upload.test.ts -v`
Expected: FAIL — current route always uses `products/images/`, never reads a `folder` field.

- [ ] **Step 3: Modify the route**

In `app/api/admin/upload/route.ts`, add right after the `if (!file) return ...` line:

```typescript
  const folder = (formData.get('folder') as string) || 'products'
```

Then change the video path line from:

```typescript
    const path = `products/videos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
```
to:
```typescript
    const path = `${folder}/videos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
```

And the image path line from:

```typescript
  const path = `products/images/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
```
to:
```typescript
  const path = `${folder}/images/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
```

No other lines in the file change.

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest __tests__/api/admin/upload.test.ts -v`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/upload/route.ts __tests__/api/admin/upload.test.ts
git commit -m "feat: support an optional folder param on the admin upload route"
```

---

## Task 9: Orders route — Convert-to-order (quotationId → CONVERTED) + race guard

**Goal:** `POST /api/admin/orders` accepts an optional `quotationId`; on success it sets that quotation `CONVERTED` + `orderId` in the same transaction, guards against double-submit with a 409, and closes the Discord thread post-commit.

**Files:**
- Modify: `[Vairis] app/api/admin/orders/route.ts`
- Test: `[Vairis] __tests__/api/admin/orders-quotation-convert.test.ts`

**Acceptance Criteria:**
- [ ] `quotationId` omitted → behavior is byte-for-byte unchanged from today (existing manual-order tests, if any, still pass).
- [ ] `quotationId` present + quotation status QUOTED → order created, quotation set to CONVERTED with `orderId`, `closeThread` called post-commit with a message containing the order id.
- [ ] `quotationId` present + quotation status NOT QUOTED (already CONVERTED/CANCELLED, or still REQUESTED) → 409, no order created, no quotation mutation.
- [ ] `quotationId` pointing at a nonexistent quotation → 409 (same "not QUOTED" path — nothing to convert).

**Verify:** `npx jest __tests__/api/admin/orders-quotation-convert.test.ts -v` → all pass.

**Steps:**

- [ ] **Step 1: Write the failing tests**

```typescript
// __tests__/api/admin/orders-quotation-convert.test.ts
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/admin/orders/route'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import * as quotations from '@/lib/quotations'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    productVariant: { findMany: jest.fn() },
    order: { create: jest.fn() },
    quotation: { findUnique: jest.fn(), update: jest.fn() },
    $transaction: jest.fn((cb) => cb(prisma)),
  },
}))
jest.mock('@/lib/auth', () => ({ requireAdmin: jest.fn() }))
jest.mock('@/lib/split', () => ({ autoSplitOrder: jest.fn().mockResolvedValue([]) }))
jest.mock('@/lib/quotations', () => ({
  ...jest.requireActual('@/lib/quotations'),
  closeThread: jest.fn(),
}))

function baseBody(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'user-1',
    contactName: 'Asha',
    contactPhone: '9876543210',
    addressLine1: '1 MG Road',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560001',
    initialStatus: 'PAYMENT_PENDING',
    items: [{ variantId: 'v1', quantity: 1, unitPrice: 45000 }],
    ...overrides,
  }
}

function req(body: unknown) {
  return new NextRequest('http://localhost/api/admin/orders', { method: 'POST', body: JSON.stringify(body) })
}

describe('POST /api/admin/orders — quotation conversion', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-1' })
    ;(prisma.productVariant.findMany as jest.Mock).mockResolvedValue([
      { id: 'v1', product: { name: 'Bracelet' } },
    ])
  })

  it('converts a QUOTED quotation and closes its thread', async () => {
    ;(prisma.quotation.findUnique as jest.Mock).mockResolvedValue({
      id: 'q1', status: 'QUOTED', discordThreadId: 'thread-1',
    })
    ;(prisma.order.create as jest.Mock).mockResolvedValue({ id: 'order-123' })

    const res = await POST(req(baseBody({ quotationId: 'q1' })))
    expect(res.status).toBe(201)
    expect(prisma.quotation.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'q1' }, data: { status: 'CONVERTED', orderId: 'order-123' } }),
    )
    expect(quotations.closeThread).toHaveBeenCalledWith('thread-1', expect.stringContaining('order-123'.slice(-8)))
  })

  it('409s and creates no order when the quotation is already CONVERTED', async () => {
    ;(prisma.quotation.findUnique as jest.Mock).mockResolvedValue({ id: 'q1', status: 'CONVERTED', discordThreadId: null })
    const res = await POST(req(baseBody({ quotationId: 'q1' })))
    expect(res.status).toBe(409)
    expect(prisma.order.create).not.toHaveBeenCalled()
  })

  it('409s when the quotation is still REQUESTED (not yet QUOTED)', async () => {
    ;(prisma.quotation.findUnique as jest.Mock).mockResolvedValue({ id: 'q1', status: 'REQUESTED', discordThreadId: null })
    const res = await POST(req(baseBody({ quotationId: 'q1' })))
    expect(res.status).toBe(409)
    expect(prisma.order.create).not.toHaveBeenCalled()
  })

  it('works unchanged with no quotationId at all', async () => {
    ;(prisma.order.create as jest.Mock).mockResolvedValue({ id: 'order-456' })
    const res = await POST(req(baseBody()))
    expect(res.status).toBe(201)
    expect(prisma.quotation.findUnique).not.toHaveBeenCalled()
    expect(quotations.closeThread).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest __tests__/api/admin/orders-quotation-convert.test.ts -v`
Expected: FAIL — route doesn't accept/handle `quotationId` yet.

- [ ] **Step 3: Modify app/api/admin/orders/route.ts**

Add `quotationId` to the schema:

```typescript
const manualOrderSchema = z.object({
  userId: z.string().min(1),
  contactName: z.string().trim().min(2),
  contactPhone: z.string().trim().regex(/^\d{10}$/, '10-digit mobile required'),
  addressLine1: z.string().trim().min(5),
  addressLine2: z.string().trim().optional(),
  city: z.string().trim().min(2),
  state: z.string().trim().min(2),
  pincode: z.string().trim().regex(/^\d{6}$/, '6-digit pincode required'),
  applyDeposit: z.boolean().optional(),
  initialStatus: z.enum(['PAYMENT_PENDING', 'PAYMENT_CONFIRMED']),
  paymentNote: z.string().trim().max(300).optional(),
  quotationId: z.string().trim().optional(),
  items: z
    .array(
      z.object({
        variantId: z.string().min(1),
        quantity: z.number().int().min(1).max(20),
        unitPrice: z.number().positive().max(10000000),
      }),
    )
    .min(1),
})
```

Add this import near the top:

```typescript
import { closeThread } from '@/lib/quotations'
```

Replace the whole `export async function POST` body with:

```typescript
export async function POST(req: NextRequest) {
  await requireAdmin()

  const parsed = manualOrderSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid order' },
      { status: 400 },
    )
  }
  const d = parsed.data

  const user = await prisma.user.findUnique({ where: { id: d.userId } })
  if (!user) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })

  const variants = await prisma.productVariant.findMany({
    where: { id: { in: d.items.map((i) => i.variantId) } },
    include: { product: true },
  })
  const variantMap = new Map(variants.map((v) => [v.id, v]))
  for (const item of d.items) {
    if (!variantMap.has(item.variantId)) {
      return NextResponse.json({ error: `Variant ${item.variantId} not found` }, { status: 400 })
    }
  }

  const total = Math.round(d.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0))
  const { totalAmount, grandTotal, depositAmount } = computeOrderAmounts(total)

  let quotationThreadId: string | null = null
  let result: { order: { id: string }; childOrderIds: string[] }
  try {
    result = await prisma.$transaction(async (tx) => {
      let quotation: { id: string; discordThreadId: string | null } | null = null
      if (d.quotationId) {
        quotation = await tx.quotation.findUnique({ where: { id: d.quotationId } })
        if (!quotation || (quotation as { status: string }).status !== 'QUOTED') {
          throw new ConvertConflictError()
        }
      }

      const created = await tx.order.create({
        data: {
          userId: user.id,
          status: d.initialStatus,
          totalAmount,
          depositAmount,
          grandTotal,
          contactName: d.contactName,
          contactPhone: d.contactPhone,
          addressLine1: d.addressLine1,
          addressLine2: d.addressLine2 || null,
          city: d.city,
          state: d.state,
          pincode: d.pincode,
          quotationId: d.quotationId || null,
          items: {
            create: d.items.map((i) => ({
              variantId: i.variantId,
              quantity: i.quantity,
              price: Math.round(i.unitPrice),
              productName: variantMap.get(i.variantId)!.product.name,
            })),
          },
          events: {
            create: [
              { status: 'PAYMENT_PENDING' as const, note: 'Manual order created by admin (offline sale)' },
              ...(d.initialStatus === 'PAYMENT_CONFIRMED'
                ? [
                    {
                      status: 'PAYMENT_CONFIRMED' as const,
                      note: d.paymentNote || 'Payment received offline',
                    },
                  ]
                : []),
            ],
          },
        },
      })

      const childOrderIds = d.items.length >= 2 ? await autoSplitOrder(tx, created.id) : []

      if (quotation) {
        await tx.quotation.update({
          where: { id: quotation.id },
          data: { status: 'CONVERTED', orderId: created.id },
        })
        quotationThreadId = quotation.discordThreadId
      }

      return { order: created, childOrderIds }
    })
  } catch (err) {
    if (err instanceof ConvertConflictError) {
      return NextResponse.json({ error: 'Quotation already converted or cancelled' }, { status: 409 })
    }
    throw err
  }

  if (quotationThreadId) {
    try {
      await closeThread(quotationThreadId, `✅ Converted → Order #${result.order.id.slice(-8)}`)
    } catch (err) {
      console.error('[api/admin/orders] closeThread on convert failed', err)
    }
  }

  return NextResponse.json(
    { orderId: result.order.id, ...(result.childOrderIds.length ? { childOrderIds: result.childOrderIds } : {}) },
    { status: 201 },
  )
}
```

Add this small class near the top of the file, alongside the other declarations (after the imports, before `manualOrderSchema`):

```typescript
/** Thrown inside the transaction when a supplied quotationId isn't in a convertible state. */
class ConvertConflictError extends Error {}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest __tests__/api/admin/orders-quotation-convert.test.ts -v`
Expected: PASS (4 tests)

Also run the pre-existing order tests to confirm nothing else broke:
Run: `npx jest __tests__/api/admin/orders-international.test.ts -v`
Expected: PASS (unchanged)

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/orders/route.ts __tests__/api/admin/orders-quotation-convert.test.ts
git commit -m "feat: convert quotation to order with race guard and thread close"
```

---

## Task 10: Admin quotations list page

**Goal:** `/admin/quotations` — status chips (mirrors `orders/page.tsx`), an "Attention" chip, an age column, and a red/amber flag on rows that need attention.

**Files:**
- Create: `[Vairis] app/(admin)/admin/quotations/page.tsx`

**Acceptance Criteria:**
- [ ] Default view (no filter) lists all quotations oldest-`createdAt`-first with an age column (e.g. "2h 15m").
- [ ] Status chips: ALL, REQUESTED, QUOTED, CONVERTED, CANCELLED, plus a separate "Needs attention" chip using `?attention=true`.
- [ ] A REQUESTED row with `escalatedAt` set, or a QUOTED row older than `QUOTE_STALE_QUOTED_HOURS` since `quotedAt`, renders with a red/amber background.
- [ ] Each row links to `/admin/quotations/[id]`.
- [ ] "+ New Quotation" link to `/admin/quotations/new`.

**Steps:**

- [ ] **Step 1: Write the page**

```tsx
// app/(admin)/admin/quotations/page.tsx
import Link from 'next/link'
import type { QuotationStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { AdminGuide } from '@/components/admin/AdminGuide'

export const dynamic = 'force-dynamic'

const FILTERS: (QuotationStatus | 'ALL')[] = ['ALL', 'REQUESTED', 'QUOTED', 'CONVERTED', 'CANCELLED']
const STALE_QUOTED_HOURS = Number(process.env.QUOTE_STALE_QUOTED_HOURS ?? 24)

function formatAge(from: Date): string {
  const ms = Date.now() - from.getTime()
  const hours = Math.floor(ms / (60 * 60 * 1000))
  const mins = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000))
  if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

function isFlagged(q: { status: QuotationStatus; escalatedAt: Date | null; quotedAt: Date | null }): boolean {
  if (q.status === 'REQUESTED') return q.escalatedAt != null
  if (q.status === 'QUOTED') {
    return q.quotedAt != null && Date.now() - q.quotedAt.getTime() > STALE_QUOTED_HOURS * 60 * 60 * 1000
  }
  return false
}

async function loadQuotations(filter: QuotationStatus | null, attention: boolean) {
  const staleThreshold = new Date(Date.now() - STALE_QUOTED_HOURS * 60 * 60 * 1000)
  const where = attention
    ? {
        OR: [
          { status: 'REQUESTED' as const, escalatedAt: { not: null } },
          { status: 'QUOTED' as const, quotedAt: { lt: staleThreshold } },
        ],
      }
    : filter
      ? { status: filter }
      : undefined

  return prisma.quotation.findMany({
    where,
    orderBy: filter === 'QUOTED' ? { quotedAt: 'asc' } : { createdAt: 'asc' },
    take: 200,
  })
}

export default async function AdminQuotationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; attention?: string }>
}) {
  const { status, attention: attentionParam } = await searchParams
  const filter = FILTERS.includes(status as QuotationStatus) ? (status as QuotationStatus) : null
  const attention = attentionParam === 'true'

  const quotations = await loadQuotations(filter, attention)

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <h1 className="admin-page__title" style={{ marginBottom: 0 }}>Quotations</h1>
        <Link href="/admin/quotations/new" className="admin-btn">
          + New Quotation
        </Link>
      </div>
      <AdminGuide
        pageKey="quotations"
        title="Quotations"
        blurb="Vendor-quote pipeline for offline/WhatsApp deals. Reminders ping the assignee on Discord while REQUESTED; Convert to order once QUOTED."
        tips={['Rows flagged red/amber have been escalated (REQUESTED) or sat QUOTED too long — check the Attention filter.']}
      />

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        {FILTERS.map((f) => {
          const active = !attention && ((f === 'ALL' && !filter) || f === filter)
          return (
            <Link
              key={f}
              href={f === 'ALL' ? '/admin/quotations' : `/admin/quotations?status=${f}`}
              style={{
                fontSize: '0.6875rem',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                padding: '6px 12px',
                borderRadius: '999px',
                textDecoration: 'none',
                border: '1px solid',
                borderColor: active ? '#032b24' : '#e5e7eb',
                background: active ? '#032b24' : '#fff',
                color: active ? '#fff' : '#4b5563',
              }}
            >
              {f === 'ALL' ? 'All' : f}
            </Link>
          )
        })}
        <Link
          href="/admin/quotations?attention=true"
          style={{
            fontSize: '0.6875rem',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            padding: '6px 12px',
            borderRadius: '999px',
            textDecoration: 'none',
            border: '1px solid',
            borderColor: attention ? '#b91c1c' : '#fecaca',
            background: attention ? '#b91c1c' : '#fef2f2',
            color: attention ? '#fff' : '#b91c1c',
          }}
        >
          Needs Attention
        </Link>
      </div>

      {quotations.length === 0 ? (
        <p style={{ color: '#6b7280', padding: '2rem 0' }}>No quotations{filter ? ` in ${filter}` : ''}.</p>
      ) : (
        <div className="admin-table-wrap">
          <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse', background: '#fff', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left', color: '#6b7280' }}>
                <th style={{ padding: '10px 12px' }}>Ref</th>
                <th style={{ padding: '10px 12px' }}>Type</th>
                <th style={{ padding: '10px 12px' }}>Customer</th>
                <th style={{ padding: '10px 12px' }}>Age</th>
                <th style={{ padding: '10px 12px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {quotations.map((q) => {
                const flagged = isFlagged(q)
                const age = q.status === 'QUOTED' && q.quotedAt ? q.quotedAt : q.createdAt
                return (
                  <tr
                    key={q.id}
                    style={{
                      borderBottom: '1px solid #f3f4f6',
                      background: flagged ? '#fef2f2' : undefined,
                    }}
                  >
                    <td style={{ padding: '10px 12px' }}>
                      <Link href={`/admin/quotations/${q.id}`} style={{ color: '#032b24', fontWeight: 600 }}>
                        {q.displayId}
                      </Link>
                    </td>
                    <td style={{ padding: '10px 12px' }}>{q.orderType}</td>
                    <td style={{ padding: '10px 12px' }}>{q.customerName || '—'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      {formatAge(age)}
                      {flagged && <span style={{ marginLeft: 6, color: '#b91c1c' }}>⚠</span>}
                    </td>
                    <td style={{ padding: '10px 12px' }}>{q.status}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Manual verification (no automated test — matches `orders/page.tsx`'s own untested convention)**

Run: `npm run dev`, visit `/admin/quotations` while logged in as an admin. Confirm the filter chips, "Needs Attention" chip, and (once Task 5's route + Task 11's form exist) that a created quotation appears in the list with a correct age.

- [ ] **Step 3: Commit**

```bash
git add "app/(admin)/admin/quotations/page.tsx"
git commit -m "feat: add admin quotations list page with age/attention flagging"
```

---

## Task 11: Admin manual quotation intake — page + form

**Goal:** `/admin/quotations/new` — order type radio (required, no default), details textarea (required), optional screenshots/customer name/mobile/product picker.

**Files:**
- Create: `[Vairis] app/(admin)/admin/quotations/new/page.tsx`
- Create: `[Vairis] app/(admin)/admin/quotations/new/QuotationForm.tsx`

**Acceptance Criteria:**
- [ ] Submit with no order type selected is blocked client-side (native radio `required`) and server-side (Task 5's 400).
- [ ] Screenshot files upload via `POST /api/admin/upload` with `folder=quotations/screenshots` before the quotation itself is submitted, and their returned URLs are included in the quotation POST body.
- [ ] On success, navigates to `/admin/quotations/[id]`.

**Steps:**

- [ ] **Step 1: Write the server component page**

```tsx
// app/(admin)/admin/quotations/new/page.tsx
import { prisma } from '@/lib/prisma'
import { QuotationForm } from './QuotationForm'

export const dynamic = 'force-dynamic'

export default async function NewQuotationPage() {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: { id: true, name: true, itemCode: true },
    orderBy: { name: 'asc' },
  })

  return (
    <div className="admin-page" style={{ maxWidth: 720 }}>
      <h1 style={{ fontSize: '1.875rem', fontWeight: 400, color: '#111827', marginBottom: '0.5rem' }}>
        New Quotation
      </h1>
      <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: '1.5rem' }}>
        For an offline/WhatsApp quote request. This creates a Discord thread in
        #quote-requests-offline and starts reminding the assignee until it&apos;s marked quoted.
      </p>
      <QuotationForm products={products} />
    </div>
  )
}
```

- [ ] **Step 2: Write the client form**

```tsx
// app/(admin)/admin/quotations/new/QuotationForm.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Product = { id: string; name: string; itemCode: string | null }

const input: React.CSSProperties = {
  width: '100%',
  border: '1px solid #d1d5db',
  padding: '8px 10px',
  fontSize: '0.8125rem',
}
const label: React.CSSProperties = {
  display: 'block',
  fontSize: '0.6875rem',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#6b7280',
  margin: '12px 0 4px',
}
const card: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  padding: '1.25rem',
  marginBottom: '1rem',
}

export function QuotationForm({ products }: { products: Product[] }) {
  const router = useRouter()
  const [orderType, setOrderType] = useState<'VAIRIS' | 'CUSTOMISATION' | ''>('')
  const [details, setDetails] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerMobile, setCustomerMobile] = useState('')
  const [productId, setProductId] = useState('')
  const [screenshots, setScreenshots] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function uploadScreenshots(): Promise<string[]> {
    const urls: string[] = []
    for (const file of screenshots) {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', 'quotations/screenshots')
      const res = await fetch('/api/admin/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Screenshot upload failed')
      urls.push(data.url)
    }
    return urls
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!orderType) {
      setError('Select an order type')
      return
    }
    if (!details.trim()) {
      setError('Details are required')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const screenshotUrls = await uploadScreenshots()
      const res = await fetch('/api/admin/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderType,
          details,
          customerName: customerName || undefined,
          customerMobile: customerMobile || undefined,
          productId: productId || undefined,
          screenshotUrls,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Could not create quotation')
        return
      }
      router.push(`/admin/quotations/${data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <div style={card}>
        <strong style={{ fontSize: '0.875rem' }}>Order type</strong>
        <div style={{ display: 'flex', gap: '1.5rem', marginTop: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem' }}>
            <input
              type="radio"
              name="orderType"
              required
              checked={orderType === 'VAIRIS'}
              onChange={() => setOrderType('VAIRIS')}
            />
            Vairis
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem' }}>
            <input
              type="radio"
              name="orderType"
              required
              checked={orderType === 'CUSTOMISATION'}
              onChange={() => setOrderType('CUSTOMISATION')}
            />
            Customisation
          </label>
        </div>
      </div>

      <div style={card}>
        <strong style={{ fontSize: '0.875rem' }}>Details</strong>
        <label style={label}>What does the customer want? (required)</label>
        <textarea
          style={{ ...input, minHeight: 100 }}
          required
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="e.g. Kurnool bracelet quotation — customer wants 22K gold, ~15g, plain design"
        />

        <label style={label}>Screenshots (optional)</label>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => setScreenshots(Array.from(e.target.files ?? []))}
        />

        <label style={label}>Customer name (optional)</label>
        <input style={input} value={customerName} onChange={(e) => setCustomerName(e.target.value)} />

        <label style={label}>Mobile (optional)</label>
        <input style={input} value={customerMobile} onChange={(e) => setCustomerMobile(e.target.value)} placeholder="9876543210" />

        <label style={label}>Product reference (optional)</label>
        <select style={input} value={productId} onChange={(e) => setProductId(e.target.value)}>
          <option value="">— None —</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}{p.itemCode ? ` (${p.itemCode})` : ''}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p style={{ fontSize: '0.8125rem', color: '#b91c1c', background: '#fef2f2', padding: '8px 12px', border: '1px solid #fecaca', marginBottom: 12 }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        style={{
          padding: '10px 28px',
          fontSize: '0.75rem',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          background: '#032b24',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        {saving ? 'Creating…' : 'Create Quotation'}
      </button>
    </form>
  )
}
```

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, visit `/admin/quotations/new`. Confirm: submitting with no order type shows the browser's native "please select one of these options" validation; submitting with order type + details creates a row visible at `/admin/quotations` and redirects to the detail page (Task 12).

- [ ] **Step 4: Commit**

```bash
git add "app/(admin)/admin/quotations/new"
git commit -m "feat: add admin manual quotation intake form"
```

---
