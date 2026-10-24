import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { QuotationDesk } from './QuotationDesk'

export const dynamic = 'force-dynamic'

const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID

/** Admin quotation desk — estimates, timeline, comments, lifecycle actions. */
export default async function QuotationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [quotation, products, discordUsers] = await Promise.all([
    prisma.quotation.findUnique({
      where: { id },
      include: {
        estimates: { orderBy: { version: 'desc' } },
        events: { orderBy: { createdAt: 'desc' }, take: 100 },
        comments: { orderBy: { createdAt: 'asc' } },
      },
    }),
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        itemCode: true,
        category: true,
        variants: { select: { sku: true }, take: 8 },
      },
    }),
    prisma.quotationDiscordUser.findMany({
      where: { active: true },
      orderBy: { handle: 'asc' },
      select: { handle: true, label: true },
    }),
  ])
  if (!quotation) notFound()

  const threadUrl =
    quotation.discordThreadId && DISCORD_GUILD_ID
      ? `https://discord.com/channels/${DISCORD_GUILD_ID}/${quotation.discordThreadId}`
      : null

  const catalogueProducts = products.map((p) => ({
    id: p.id,
    name: p.name,
    itemCode: p.itemCode,
    category: p.category,
    skus: p.variants.map((v) => v.sku),
  }))

  const customerBits = [quotation.customerName, quotation.customerMobile].filter(Boolean)

  return (
    <div className="admin-page admin-page--quotations">
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: '0.75rem 1.5rem',
          marginBottom: '0.35rem',
        }}
      >
        <h1 style={{ fontSize: '1.875rem', fontWeight: 400, color: '#111827', margin: 0 }}>
          {quotation.displayId}
        </h1>
        {customerBits.length > 0 && (
          <p style={{ margin: 0, fontSize: '0.9375rem', color: '#111827' }}>
            {quotation.customerName && <strong>{quotation.customerName}</strong>}
            {quotation.customerName && quotation.customerMobile ? ' · ' : ''}
            {quotation.customerMobile && (
              <span style={{ color: '#4b5563' }}>{quotation.customerMobile}</span>
            )}
          </p>
        )}
      </div>
      <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: '1.5rem' }}>
        {quotation.orderType} · {quotation.source} · <strong style={{ color: '#111827' }}>{quotation.status}</strong>
        {quotation.quotedAmount != null ? ` · ₹${quotation.quotedAmount.toLocaleString('en-IN')}` : ''}
      </p>

      <QuotationDesk
        quotation={quotation}
        threadUrl={threadUrl}
        products={catalogueProducts}
        discordHandles={discordUsers}
      />
    </div>
  )
}
