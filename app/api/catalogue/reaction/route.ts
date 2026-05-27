import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getGuestUser } from '@/lib/catalogue-auth'

export const dynamic = 'force-dynamic'

// GET /api/catalogue/reaction?productId=xxx  → returns user's reaction for that product
export async function GET(req: NextRequest) {
  const guest = await getGuestUser()
  if (!guest) return NextResponse.json({ reaction: null })

  const productId = new URL(req.url).searchParams.get('productId')
  if (!productId) return NextResponse.json({ error: 'productId required' }, { status: 400 })

  const r = await prisma.catalogueReaction.findUnique({
    where: { guestUserId_productId: { guestUserId: guest.id, productId } },
  })
  return NextResponse.json({ reaction: r?.reaction ?? null })
}

// POST /api/catalogue/reaction  { productId, reaction: "like"|"dislike"|null }
export async function POST(req: NextRequest) {
  const guest = await getGuestUser()
  if (!guest) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  const { productId, reaction } = await req.json()
  if (!productId) return NextResponse.json({ error: 'productId required' }, { status: 400 })

  if (!reaction) {
    await prisma.catalogueReaction.deleteMany({
      where: { guestUserId: guest.id, productId },
    })
    return NextResponse.json({ reaction: null })
  }

  if (reaction !== 'like' && reaction !== 'dislike') {
    return NextResponse.json({ error: 'reaction must be like or dislike' }, { status: 400 })
  }

  const r = await prisma.catalogueReaction.upsert({
    where: { guestUserId_productId: { guestUserId: guest.id, productId } },
    create: { guestUserId: guest.id, productId, reaction },
    update: { reaction },
  })

  return NextResponse.json({ reaction: r.reaction })
}
