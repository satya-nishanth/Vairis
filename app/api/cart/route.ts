import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = "force-dynamic"

export async function GET() {
  const user = await requireUser()
  const items = await prisma.cartItem.findMany({
    where: { userId: user.id },
    include: { variant: { include: { product: true } } },
  })
  return NextResponse.json(items)
}

export async function POST(req: NextRequest) {
  const user = await requireUser()
  const { variantId, quantity } = await req.json()

  const item = await prisma.cartItem.upsert({
    where: { userId_variantId: { userId: user.id, variantId } },
    update: { quantity: { increment: quantity } },
    create: { userId: user.id, variantId, quantity },
  })
  return NextResponse.json(item, { status: 201 })
}
