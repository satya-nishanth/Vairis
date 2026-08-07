import { NextRequest, NextResponse } from 'next/server'
import { getAppUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const user = await getAppUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { itemId } = await params
  const { quantity } = await req.json()
  const item = await prisma.cartItem.updateMany({
    where: { id: itemId, userId: user.id },
    data: { quantity },
  })
  return NextResponse.json(item)
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const user = await getAppUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { itemId } = await params
  await prisma.cartItem.deleteMany({ where: { id: itemId, userId: user.id } })
  return new NextResponse(null, { status: 204 })
}
