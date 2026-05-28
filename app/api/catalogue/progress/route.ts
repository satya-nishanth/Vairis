import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getGuestUser } from '@/lib/catalogue-auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const guest = await getGuestUser()
  if (!guest) return NextResponse.json({ progress: null })

  try {
    const progress = await prisma.catalogueProgress.findUnique({
      where: { guestUserId: guest.id },
    })
    return NextResponse.json({ progress })
  } catch (err) {
    console.error('[catalogue/progress GET]', err)
    return NextResponse.json({ error: 'Failed to load progress' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const guest = await getGuestUser()
  if (!guest) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  let lastFrameIndex: unknown
  try {
    ;({ lastFrameIndex } = await req.json())
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (typeof lastFrameIndex !== 'number' || lastFrameIndex < -1) {
    return NextResponse.json({ error: 'lastFrameIndex must be >= -1' }, { status: 400 })
  }

  try {
    const existing = await prisma.catalogueProgress.findUnique({
      where: { guestUserId: guest.id },
    })
    const merged = Math.max(existing?.lastFrameIndex ?? -1, lastFrameIndex)
    const progress = await prisma.catalogueProgress.upsert({
      where: { guestUserId: guest.id },
      create: { guestUserId: guest.id, lastFrameIndex: merged },
      update: { lastFrameIndex: merged },
    })
    return NextResponse.json({ progress })
  } catch (err) {
    console.error('[catalogue/progress POST] guestId=%s', guest.id, err)
    return NextResponse.json({ error: 'Failed to save progress' }, { status: 500 })
  }
}

// Reset progress — start from image 1 on next visit
export async function DELETE() {
  const guest = await getGuestUser()
  if (!guest) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  try {
    await prisma.catalogueProgress.upsert({
      where: { guestUserId: guest.id },
      create: { guestUserId: guest.id, lastFrameIndex: -1 },
      update: { lastFrameIndex: -1 },
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[catalogue/progress DELETE]', err)
    return NextResponse.json({ error: 'Failed to reset progress' }, { status: 500 })
  }
}
