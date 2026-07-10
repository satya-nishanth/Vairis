import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { Category } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')
  const search = searchParams.get('search')

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      ...(category ? { category: category as Category } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { itemCode: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: {
      variants: {
        select: {
          id: true,
          metalType: true,
          weightGrams: true,
          stock: true,
          sku: true,
        },
      },
    },
  })

  return NextResponse.json(products)
}
