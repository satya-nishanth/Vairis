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
