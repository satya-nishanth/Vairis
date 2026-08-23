import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { QuotationActions } from './QuotationActions'

export const dynamic = 'force-dynamic'

const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID

/** Admin quotation detail — thread link, quoted amount/notes, lifecycle actions. */
export default async function QuotationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const quotation = await prisma.quotation.findUnique({ where: { id } })
  if (!quotation) notFound()

  const threadUrl =
    quotation.discordThreadId && DISCORD_GUILD_ID
      ? `https://discord.com/channels/${DISCORD_GUILD_ID}/${quotation.discordThreadId}`
      : null

  return (
    <div className="admin-page" style={{ maxWidth: 720 }}>
      <h1 style={{ fontSize: '1.875rem', fontWeight: 400, color: '#111827', marginBottom: '0.25rem' }}>
        {quotation.displayId}
      </h1>
      <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: '1.5rem' }}>
        {quotation.orderType} · {quotation.source} · {quotation.status}
      </p>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', padding: '1.25rem', marginBottom: '1rem' }}>
        <p><strong>Details:</strong> {quotation.details || '—'}</p>
        {quotation.customerName && <p><strong>Customer:</strong> {quotation.customerName}</p>}
        {quotation.customerMobile && <p><strong>Mobile:</strong> {quotation.customerMobile}</p>}
        {quotation.quotedAmount != null && (
          <p><strong>Quoted amount:</strong> ₹{quotation.quotedAmount.toLocaleString('en-IN')}</p>
        )}
        {quotation.quotedNotes && <p><strong>Quoted notes:</strong> {quotation.quotedNotes}</p>}
        {quotation.screenshotUrls.length > 0 && (
          <div>
            <strong>Screenshots:</strong>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              {quotation.screenshotUrls.map((url) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={url} src={url} alt="Quote screenshot" style={{ width: 100, height: 100, objectFit: 'cover' }} />
              ))}
            </div>
          </div>
        )}
        {threadUrl && (
          <p>
            <a href={threadUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#032b24' }}>
              View Discord thread ↗
            </a>
          </p>
        )}
      </div>

      {quotation.status === 'CONVERTED' && quotation.orderId ? (
        <Link href={`/admin/orders/${quotation.orderId}`} className="admin-btn">
          View Order
        </Link>
      ) : (
        <QuotationActions id={quotation.id} status={quotation.status} />
      )}
    </div>
  )
}
