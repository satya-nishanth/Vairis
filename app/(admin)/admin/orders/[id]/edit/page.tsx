import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { isFinanceEmail } from '@/lib/finance-auth'
import { calculatePrice, isOrderItemPriceSnapshot, unitSnapshotToSellingComponents } from '@/lib/pricing'
import { getPricingConfig, toStoneInputs, resolvePricingConfig } from '@/lib/pricing-data'
import { parseInternalBuild } from '@/lib/order-internal-build'
import { ManualOrderForm, type ManualOrderEditPrefill } from '../../new/ManualOrderForm'

export const dynamic = 'force-dynamic'

/** Edit customer, address, items, inventory allocations, and selling breakdown. */
export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  const isFinance = isFinanceEmail(session.user.email)
  const { id } = await params

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: true,
      attachments: { orderBy: { createdAt: 'asc' } },
      user: { select: { id: true, email: true, name: true, mobile: true } },
      children: { select: { id: true }, take: 1 },
      inventoryAllocations: {
        include: {
          inventoryItem: { select: { qtyOnHand: true } },
        },
      },
    },
  })
  if (!order) notFound()

  if (order.children.length > 0) {
    return (
      <div className="admin-page admin-page--orders">
        <p style={{ marginBottom: 12, fontSize: '0.8125rem' }}>
          <Link href={`/admin/orders/${id}`} style={{ color: '#032b24' }}>
            ← Order
          </Link>
        </p>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 400, marginBottom: 8 }}>Cannot edit split parent</h1>
        <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
          This order was split into deliveries. Open each child order and edit there.
        </p>
      </div>
    )
  }

  const orderVariantIds = order.items.map((i) => i.variantId)
  const [products, goldRates, pricingConfig, holders, diamondRates] = await Promise.all([
    prisma.product.findMany({
      where: {
        OR: [{ isActive: true }, { variants: { some: { id: { in: orderVariantIds } } } }],
      },
      include: {
        variants: { orderBy: { metalType: 'asc' } },
        stones: { include: { diamondRate: true }, orderBy: { sortOrder: 'asc' } },
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    }),
    prisma.goldRate.findMany(),
    getPricingConfig(),
    prisma.inventoryHolder.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true },
    }),
    prisma.diamondRate.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, label: true, ratePerCarat: true },
    }),
  ])

  const rateMap = Object.fromEntries(goldRates.map((r) => [r.metalType, Number(r.ratePerGram)]))

  const variantOptions = products.flatMap((p) =>
    p.variants.map((v) => {
      const rate = rateMap[v.metalType]
      const suggested = rate
        ? Math.round(
            calculatePrice(
              {
                weightGrams: v.weightGrams.toString(),
                makingChargePerGram: v.makingChargePerGram.toString(),
                flatMakingCharge: v.flatMakingCharge.toString(),
                stoneCharges: v.stoneCharges.toString(),
                miscCharges: v.miscCharges.toString(),
              },
              rate,
              { stones: toStoneInputs(p.stones), withExchange: false, config: resolvePricingConfig(pricingConfig, p) },
            ).total,
          )
        : 0
      return {
        variantId: v.id,
        productId: p.id,
        category: p.category,
        productName: p.name,
        itemCode: p.itemCode ?? '',
        sku: v.sku,
        label: `${p.name} — ${v.metalType}${v.size ? ` · ${v.size}` : ''} (${v.sku})`,
        suggestedPrice: suggested,
      }
    }),
  )

  const allocByItemId = new Map(
    order.inventoryAllocations
      .filter((a) => a.orderItemId)
      .map((a) => [a.orderItemId!, a] as const),
  )

  const lines: ManualOrderEditPrefill['lines'] = order.items.map((item) => {
    const alloc = allocByItemId.get(item.id)
    const internalBuild = parseInternalBuild(item.internalBuild) ?? undefined
    if (alloc) {
      return {
        variantId: item.variantId,
        quantity: item.quantity,
        unitPrice: Number(item.price),
        inventoryItemId: alloc.inventoryItemId,
        fromInventory: true,
        maxQty: alloc.inventoryItem.qtyOnHand + alloc.qty,
        internalBuild,
      }
    }
    return {
      variantId: item.variantId,
      quantity: item.quantity,
      unitPrice: Number(item.price),
      internalBuild,
    }
  })

  let selling: ManualOrderEditPrefill['selling'] | undefined
  const first = order.items[0]
  if (first && isOrderItemPriceSnapshot(first.priceBreakdown)) {
    selling = unitSnapshotToSellingComponents(first.priceBreakdown, first.quantity)
  }

  const editOrder: ManualOrderEditPrefill = {
    orderId: order.id,
    customer: {
      id: order.user.id,
      email: order.user.email,
      name: order.user.name,
      mobile: order.user.mobile,
    },
    address: {
      contactName: order.contactName,
      contactPhone: order.contactPhone,
      addressLine1: order.addressLine1,
      addressLine2: order.addressLine2 ?? '',
      city: order.city,
      state: order.state,
      pincode: order.pincode,
    },
    lines,
    selling,
    attachments: order.attachments.map((a) => ({
      url: a.url,
      fileName: a.fileName,
      contentType: a.contentType,
    })),
  }

  return (
    <div className="admin-page admin-page--orders">
      <p style={{ marginBottom: 12, fontSize: '0.8125rem' }}>
        <Link href={`/admin/orders/${id}`} style={{ color: '#032b24' }}>
          ← Order
        </Link>
      </p>
      <h1 style={{ fontSize: '1.875rem', fontWeight: 400, color: '#111827', marginBottom: '0.5rem' }}>
        Edit order
      </h1>
      <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: '1.5rem', wordBreak: 'break-all' }}>
        {order.id} — customer, address, items, inventory allocations, and selling breakdown.
        Saved finance order sheets are not updated automatically.
      </p>
      <ManualOrderForm
        variantOptions={variantOptions}
        holders={holders}
        diamondRates={diamondRates.map((r) => ({
          id: r.id,
          label: r.label,
          ratePerCarat: Number(r.ratePerCarat),
        }))}
        isFinance={isFinance}
        editOrder={editOrder}
      />
    </div>
  )
}
