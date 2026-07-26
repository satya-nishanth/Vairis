import { prisma } from '@/lib/prisma'
import { ContactStatusButtons } from './ContactStatusButtons'

export const dynamic = 'force-dynamic'

export default async function AdminContactsPage() {
  const requests = await prisma.contactRequest.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  return (
    <div className="admin-page" style={{ maxWidth: 960 }}>
      <h1 style={{ fontSize: '1.875rem', fontWeight: 400, color: '#111827', marginBottom: '1.5rem' }}>
        Contact Requests
      </h1>
      <div style={{ display: 'grid', gap: 12 }}>
        {requests.length === 0 && (
          <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>No contact requests yet.</p>
        )}
        {requests.map((r) => (
          <div
            key={r.id}
            style={{
              background: '#fff',
              border: '1px solid #f3f4f6',
              borderRadius: 8,
              padding: 16,
              display: 'grid',
              gap: 6,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <strong style={{ fontSize: '0.875rem' }}>
                {r.subject || r.name}
                <span
                  className={
                    r.status === 'NEW'
                      ? 'admin-products__badge is-active'
                      : 'admin-products__badge'
                  }
                  style={{ marginLeft: 8 }}
                >
                  {r.status}
                </span>
              </strong>
              <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                {r.createdAt.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
              </span>
            </div>
            <p style={{ fontSize: '0.8125rem', color: '#374151', whiteSpace: 'pre-wrap' }}>{r.message}</p>
            <p style={{ fontSize: '0.75rem', color: '#6b7280' }}>
              {r.name}
              {r.email ? ` · ${r.email}` : ''}
              {r.phone ? ` · ${r.phone}` : ''}
            </p>
            <ContactStatusButtons id={r.id} status={r.status} />
          </div>
        ))}
      </div>
    </div>
  )
}
