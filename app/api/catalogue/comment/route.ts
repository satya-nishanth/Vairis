import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getGuestUser } from '@/lib/catalogue-auth'

export const dynamic = 'force-dynamic'

// GET /api/catalogue/comment?productId=xxx
export async function GET(req: NextRequest) {
  const productId = new URL(req.url).searchParams.get('productId')
  if (!productId) return NextResponse.json({ error: 'productId required' }, { status: 400 })

  try {
    const comments = await prisma.catalogueComment.findMany({
      where: { productId },
      orderBy: { createdAt: 'asc' },
      include: { guestUser: { select: { username: true } } },
    })
    return NextResponse.json({
      comments: comments.map((c) => ({
        id: c.id,
        body: c.body,
        username: c.guestUser?.username ?? '[deleted]',
        createdAt: c.createdAt,
      })),
    })
  } catch (err) {
    console.error('[catalogue/comment GET]', err)
    return NextResponse.json({ error: 'Failed to load comments' }, { status: 500 })
  }
}

// POST /api/catalogue/comment  { productId, body }
export async function POST(req: NextRequest) {
  const guest = await getGuestUser()
  if (!guest) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  let productId: string, body: string
  try {
    ;({ productId, body } = await req.json())
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!productId || !body?.trim()) {
    return NextResponse.json({ error: 'productId and body required' }, { status: 400 })
  }
  if (body.trim().length > 1000) {
    return NextResponse.json({ error: 'Comment too long (max 1000 chars)' }, { status: 400 })
  }

  try {
    const comment = await prisma.catalogueComment.create({
      data: { guestUserId: guest.id, productId, body: body.trim() },
    })
    return NextResponse.json({
      comment: { id: comment.id, body: comment.body, username: guest.username, createdAt: comment.createdAt },
    })
  } catch (err) {
    console.error('[catalogue/comment POST]', err)
    return NextResponse.json({ error: 'Failed to save comment' }, { status: 500 })
  }
}
