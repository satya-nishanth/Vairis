import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/** Collections pinned into the storefront nav (Collection.showInNav). */
export async function GET() {
  const collections = await prisma.collection.findMany({
    where: { active: true, showInNav: true },
    orderBy: { sortOrder: 'asc' },
    select: { slug: true, title: true },
    take: 4,
  })
  return NextResponse.json(collections)
}
