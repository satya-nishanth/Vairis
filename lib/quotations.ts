import { Prisma, QuotationStatus } from '@prisma/client'
import { createHash, randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'

/** Admin/bot-driven quotation transitions. CONVERTED and CANCELLED are terminal. */
export const QUOTATION_TRANSITIONS: Partial<Record<QuotationStatus, QuotationStatus[]>> = {
  REQUESTED: ['QUOTED', 'CANCELLED'],
  // QUOTED: re-quote, accept, or cancel. Convert requires ACCEPTED first (V1 desk).
  QUOTED: ['QUOTED', 'ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['CONVERTED', 'CANCELLED', 'QUOTED'],
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

// Discord REST helpers

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

/** DB settings with env fallback — used for thread create + ping channel. */
export async function getQuotationDiscordChannels(): Promise<{
  threadChannelId: string | null
  pingChannelId: string | null
}> {
  const envChannel = process.env.DISCORD_QUOTE_CHANNEL_ID?.trim() || null
  try {
    const row = await prisma.quotationDiscordSettings.findUnique({ where: { id: 'default' } })
    const threadChannelId = row?.threadChannelId?.trim() || envChannel
    const pingChannelId = row?.pingChannelId?.trim() || null
    return { threadChannelId, pingChannelId }
  } catch {
    return { threadChannelId: envChannel, pingChannelId: null }
  }
}

/** Creates a public thread on the configured thread channel (falls back to ping channel). */
export async function createQuoteThread(name: string): Promise<string> {
  const { threadChannelId, pingChannelId } = await getQuotationDiscordChannels()
  const channelId = threadChannelId || pingChannelId
  if (!channelId) {
    throw new Error(
      'Discord thread channel is not configured (Quotations → Settings, or DISCORD_QUOTE_CHANNEL_ID)',
    )
  }
  const res = await discordFetch(`/channels/${channelId}/threads`, {
    method: 'POST',
    body: JSON.stringify({ name: name.slice(0, 100), auto_archive_duration: 60, type: 11 }),
  })
  const data = await res.json()
  return data.id as string
}

/**
 * Ensure the quotation has a Discord thread. Creates + persists one when missing.
 * Returns thread id or null if Discord is unavailable / not configured.
 */
export async function ensureQuoteThread(quotation: {
  id: string
  displayId: string
  discordThreadId: string | null
  details?: string | null
}): Promise<string | null> {
  if (quotation.discordThreadId) return quotation.discordThreadId
  try {
    const suffix = quotation.details?.trim() ? ` · ${quotation.details.trim().slice(0, 40)}` : ''
    const threadId = await createQuoteThread(`${quotation.displayId}${suffix}`)
    await prisma.quotation.update({
      where: { id: quotation.id },
      data: { discordThreadId: threadId },
    })
    try {
      await postToThread(
        threadId,
        `${mentionAssignee()} Thread created for **${quotation.displayId}**\n${quotationDeskUrl(quotation.id)}`,
      )
    } catch {
      // non-blocking — thread exists even if starter ping fails
    }
    return threadId
  } catch (err) {
    console.error('[quotations] ensureQuoteThread failed', err)
    return null
  }
}

export async function postToThread(threadId: string, content: string): Promise<void> {
  await discordFetch(`/channels/${threadId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  })
}

/** Post a message to a regular text channel (not a thread). */
export async function postToChannel(channelId: string, content: string): Promise<void> {
  await discordFetch(`/channels/${channelId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  })
}

/** `<@id>` mention for DISCORD_QUOTE_ASSIGNEE_ID, or '' if unset (never crashes thread creation). */
export function mentionAssignee(): string {
  const id = process.env.DISCORD_QUOTE_ASSIGNEE_ID
  return id ? `<@${id}>` : ''
}

/**
 * Expand `@handle` tokens using QuotationDiscordUser rows into Discord `<@snowflake>` mentions.
 * Unknown handles are left as plain text. Returns the Discord-ready body + list of resolved handles.
 */
export function expandDiscordHandles(
  text: string,
  users: { handle: string; discordUserId: string }[],
): { discordBody: string; mentionedHandles: string[] } {
  if (!users.length) return { discordBody: text, mentionedHandles: [] }
  const byHandle = new Map(
    users.map((u) => [u.handle.trim().toLowerCase().replace(/^@/, ''), u.discordUserId]),
  )
  const mentioned = new Set<string>()
  const discordBody = text.replace(/@([a-zA-Z0-9._-]+)/g, (full, raw: string) => {
    const key = raw.toLowerCase()
    const id = byHandle.get(key)
    if (!id) return full
    mentioned.add(key)
    return `<@${id}>`
  })
  return { discordBody, mentionedHandles: [...mentioned] }
}

/** Optionally posts a closing message, then archives the thread — CONVERTED / CANCELLED. */
export async function closeThread(threadId: string, message?: string | null): Promise<void> {
  const text = message?.trim()
  if (text) {
    await postToThread(threadId, text)
  }
  await discordFetch(`/channels/${threadId}`, {
    method: 'PATCH',
    body: JSON.stringify({ archived: true }),
  })
}

/** Shared Bearer-auth check for every /api/internal/quotations* route (bot-only). */
export function isInternalApiAuthorized(req: NextRequest): boolean {
  return req.headers.get('authorization') === `Bearer ${process.env.INTERNAL_API_KEY}`
}

/** Consistent Discord milestone line for quote lifecycle (estimate / sent / accepted / …). */
export function quotationMilestone(title: string, detail?: string | null): string {
  const head = `📌 **${title}**`
  const body = detail?.trim()
  return body ? `${head}\n${body}` : head
}

/** Absolute admin desk URL for Discord notify pings. */
export function quotationDeskUrl(quotationId: string): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')
  const root = base.replace(/\/$/, '')
  return root ? `${root}/admin/quotations/${quotationId}` : `/admin/quotations/${quotationId}`
}

/**
 * Secondary Discord notify — never throws. Desk remains source of truth.
 * Creates a Discord thread on first notify if the quote has none yet, posts into the thread,
 * and also into the configured ping channel.
 */
export async function notifyQuotationUpdate(
  quotation: {
    id: string
    discordThreadId: string | null
    displayId?: string | null
    details?: string | null
  },
  message: string,
): Promise<void> {
  const body = `${message}\n${quotationDeskUrl(quotation.id)}`

  let threadId = quotation.discordThreadId
  let displayId = quotation.displayId ?? null
  let details = quotation.details ?? null
  if (!threadId) {
    // Always re-read when thread is missing — callers often pass a stale row with displayId set
    // and discordThreadId null (would otherwise create a duplicate thread via ensureQuoteThread).
    try {
      const row = await prisma.quotation.findUnique({
        where: { id: quotation.id },
        select: { displayId: true, details: true, discordThreadId: true },
      })
      if (row?.discordThreadId) threadId = row.discordThreadId
      displayId = row?.displayId ?? displayId
      details = row?.details ?? details
    } catch (err) {
      console.error('[quotations] notifyQuotationUpdate reload failed', err)
    }
    if (!threadId && displayId) {
      threadId = await ensureQuoteThread({
        id: quotation.id,
        displayId,
        discordThreadId: null,
        details,
      })
    }
  }

  try {
    if (threadId) {
      await postToThread(threadId, body)
    }
  } catch (err) {
    console.error('[quotations] Discord thread notify failed', err)
  }
  try {
    const { pingChannelId } = await getQuotationDiscordChannels()
    if (pingChannelId) {
      const prefix = quotation.displayId ? `**${quotation.displayId}** · ` : ''
      await postToChannel(pingChannelId, `${prefix}${body}`)
    }
  } catch (err) {
    console.error('[quotations] Discord ping-channel notify failed', err)
  }
}
