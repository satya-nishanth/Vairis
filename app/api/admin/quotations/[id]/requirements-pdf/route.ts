import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildQuotationRequirementsPdf } from '@/lib/quotation-requirements-pdf'

export const dynamic = 'force-dynamic'

/** GET /api/admin/quotations/[id]/requirements-pdf — download workshop requirements sheet. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi()
  if (auth.error) return auth.error

  const { id } = await params
  const quotation = await prisma.quotation.findUnique({ where: { id } })
  if (!quotation) {
    return NextResponse.json({ error: 'Quotation not found' }, { status: 404 })
  }

  let productImageUrl: string | null = null
  if (quotation.productId) {
    const product = await prisma.product.findUnique({
      where: { id: quotation.productId },
      select: { images: true },
    })
    productImageUrl = product?.images[0] ?? null
  }

  const bytes = await buildQuotationRequirementsPdf({
    displayId: quotation.displayId,
    orderType: quotation.orderType,
    details: quotation.details,
    metalType: quotation.metalType,
    metalColor: quotation.metalColor,
    productImageUrl,
  })

  const filename = `${quotation.displayId}-requirements.pdf`
  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
