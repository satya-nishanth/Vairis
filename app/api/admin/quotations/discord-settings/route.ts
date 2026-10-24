import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminApi } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const channelIdField = z.union([
  z.literal(''),
  z.string().trim().regex(/^\d{5,30}$/, 'Must be a numeric Discord channel ID'),
])

const patchSchema = z.object({
  threadChannelId: channelIdField.optional(),
  pingChannelId: channelIdField.optional(),
})

function normalize(id: string | null | undefined): string | null {
  if (id == null || id === '') return null
  return id
}

/** GET — Discord channel config (+ env fallbacks for display). */
export async function GET() {
  const auth = await requireAdminApi()
  if (auth.error) return auth.error

  const row = await prisma.quotationDiscordSettings.findUnique({ where: { id: 'default' } })
  return NextResponse.json({
    threadChannelId: row?.threadChannelId ?? null,
    pingChannelId: row?.pingChannelId ?? null,
    envThreadChannelId: process.env.DISCORD_QUOTE_CHANNEL_ID?.trim() || null,
  })
}

/** PUT — upsert Discord channel config. Empty string clears (falls back to env for threads). */
export async function PUT(req: NextRequest) {
  const auth = await requireAdminApi()
  if (auth.error) return auth.error

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  }
  const d = parsed.data

  const existing = await prisma.quotationDiscordSettings.findUnique({ where: { id: 'default' } })
  const data = {
    threadChannelId:
      d.threadChannelId !== undefined ? normalize(d.threadChannelId) : existing?.threadChannelId ?? null,
    pingChannelId:
      d.pingChannelId !== undefined ? normalize(d.pingChannelId) : existing?.pingChannelId ?? null,
  }

  const row = await prisma.quotationDiscordSettings.upsert({
    where: { id: 'default' },
    create: { id: 'default', ...data },
    update: data,
  })

  return NextResponse.json(row)
}
