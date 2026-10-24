import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminApi } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const upsertSchema = z.object({
  id: z.string().trim().optional(),
  handle: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[a-zA-Z0-9._-]+$/, 'Handle: letters, numbers, . _ - only (no @)'),
  discordUserId: z
    .string()
    .trim()
    .regex(/^\d{5,30}$/, 'Discord user ID must be a numeric snowflake'),
  email: z.string().trim().email().optional().nullable().or(z.literal('')),
  label: z.string().trim().max(80).optional().nullable().or(z.literal('')),
  active: z.boolean().optional(),
})

/** GET — list Discord @handle mappings for quote desk. */
export async function GET() {
  const auth = await requireAdminApi()
  if (auth.error) return auth.error

  const users = await prisma.quotationDiscordUser.findMany({
    orderBy: [{ active: 'desc' }, { handle: 'asc' }],
  })
  return NextResponse.json(users)
}

/** POST — create or update a Discord user mapping. */
export async function POST(req: NextRequest) {
  const auth = await requireAdminApi()
  if (auth.error) return auth.error

  const parsed = upsertSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  }
  const d = parsed.data
  const handle = d.handle.replace(/^@/, '').toLowerCase()
  const email = d.email ? d.email.toLowerCase() : null
  const label = d.label || null

  try {
    if (d.id) {
      const updated = await prisma.quotationDiscordUser.update({
        where: { id: d.id },
        data: {
          handle,
          discordUserId: d.discordUserId,
          email,
          label,
          active: d.active ?? true,
        },
      })
      return NextResponse.json(updated)
    }
    const created = await prisma.quotationDiscordUser.create({
      data: {
        handle,
        discordUserId: d.discordUserId,
        email,
        label,
        active: d.active ?? true,
      },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Save failed'
    if (msg.includes('Unique constraint') || msg.includes('QuotationDiscordUser_handle')) {
      return NextResponse.json({ error: `Handle @${handle} already exists` }, { status: 409 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/** DELETE — remove a mapping by id (?id=). */
export async function DELETE(req: NextRequest) {
  const auth = await requireAdminApi()
  if (auth.error) return auth.error

  const id = req.nextUrl.searchParams.get('id')?.trim()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  try {
    await prisma.quotationDiscordUser.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
