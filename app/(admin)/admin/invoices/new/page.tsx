import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getPricingConfig } from '@/lib/pricing-data'
import { blankPayload, payloadFromOrder, totalsFromPayload, type PrefillOrder } from '@/lib/invoice-document'
import { InvoiceComposer } from '@/components/admin/InvoiceComposer'

export const dynamic = 'force-dynamic'

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>
}) {
  const { orderId } = await searchParams

  let payload = blankPayload()
  if (orderId) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { name: true, email: true } },
        payment: true,
        items: {
          include: {
            variant: {
              include: {
                product: {
                  include: {
                    stones: { include: { diamondRate: true }, orderBy: { sortOrder: 'asc' } },
                  },
                },
              },
            },
          },
        },
        children: {
          include: {
            user: { select: { name: true, email: true } },
            payment: true,
            items: {
              include: {
                variant: {
                  include: {
                    product: {
                      include: {
                        stones: { include: { diamondRate: true }, orderBy: { sortOrder: 'asc' } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    })
    if (order) {
      const [goldRates, config] = await Promise.all([prisma.goldRate.findMany(), getPricingConfig()])
      const rates = Object.fromEntries(goldRates.map((r) => [r.metalType, Number(r.ratePerGram)]))
      payload = payloadFromOrder(order as unknown as PrefillOrder, rates, config)
      payload = { ...payload, lines: totalsFromPayload(payload).lines }
    }
  }

  const recentOrders = await prisma.order.findMany({
    where: { parentOrderId: null },
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: { id: true, contactName: true, status: true, grandTotal: true, createdAt: true },
  })

  return (
    <div className="admin-page" style={{ maxWidth: 1100 }}>
      <p style={{ marginBottom: 12, fontSize: '0.8125rem' }}>
        <Link href="/admin/invoices" style={{ color: '#032b24' }}>
          ← Invoices
        </Link>
      </p>
      <h1 className="admin-page__title">New invoice</h1>

      {!orderId && (
        <div className="inv-composer__line" style={{ marginBottom: 16 }}>
          <p style={{ marginTop: 0, fontSize: '0.875rem' }}>Start from a recent order, or fill a blank invoice below.</p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.875rem' }}>
            {recentOrders.map((o) => (
              <li key={o.id} style={{ marginBottom: 6 }}>
                <Link href={`/admin/invoices/new?orderId=${o.id}`}>
                  {o.contactName || o.id} · {o.status} · ₹{Number(o.grandTotal).toLocaleString('en-IN')}
                </Link>
              </li>
            ))}
            {recentOrders.length === 0 && <li>No orders yet — use the blank form.</li>}
          </ul>
        </div>
      )}

      <InvoiceComposer initial={payload} orderId={orderId ?? null} />
    </div>
  )
}
