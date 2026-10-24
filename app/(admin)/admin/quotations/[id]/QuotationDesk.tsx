'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type {
  Quotation,
  QuotationComment,
  QuotationEstimate,
  QuotationEvent,
} from '@prisma/client'
import {
  CatalogueProductPicker,
  type CatalogueProductOption,
} from '@/components/admin/CatalogueProductPicker'
import {
  METAL_COLORS,
  METAL_PURITIES,
  colorMeta,
  purityMeta,
  type MetalColorValue,
  type MetalPurityValue,
} from '@/lib/metal'

type DeskQuotation = Quotation & {
  estimates: QuotationEstimate[]
  events: QuotationEvent[]
  comments: QuotationComment[]
}

type CommentKind = 'INTERNAL' | 'CUSTOMER_RESPONSE' | 'OUR_RESPONSE'

function formatInr(n: number) {
  return `₹${n.toLocaleString('en-IN')}`
}

function commentKindLabel(kind: QuotationComment['kind']) {
  if (kind === 'CUSTOMER_RESPONSE') return 'Customer Replied'
  if (kind === 'OUR_RESPONSE') return 'Our Response'
  return null
}

function formatWhen(d: Date | string) {
  return new Date(d).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function estimateLabel(est: QuotationEstimate) {
  const bare = est.name.trim()
  if (!bare || bare === `v${est.version}`) return `v${est.version}`
  return `v${est.version} · ${bare}`
}

export function QuotationDesk({
  quotation,
  threadUrl,
  products,
  discordHandles = [],
}: {
  quotation: DeskQuotation
  threadUrl: string | null
  products: CatalogueProductOption[]
  discordHandles?: { handle: string; label: string | null }[]
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [commentBody, setCommentBody] = useState('')
  const [attachUrls, setAttachUrls] = useState('')
  const [commentKind, setCommentKind] = useState<CommentKind>('INTERNAL')
  const [showResponse, setShowResponse] = useState(false)
  const [response, setResponse] = useState<'accepted' | 'declined' | 'needs_revision'>('accepted')
  const [channel, setChannel] = useState<'call' | 'whatsapp' | 'in_person' | 'other'>('call')
  const [responseNotes, setResponseNotes] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [quoteNotes, setQuoteNotes] = useState(quotation.quotedNotes ?? '')
  const [editingProduct, setEditingProduct] = useState(false)
  const [productIdDraft, setProductIdDraft] = useState(quotation.productId ?? '')
  const [editingRequirements, setEditingRequirements] = useState(false)
  const [detailsDraft, setDetailsDraft] = useState(quotation.details ?? '')
  const [customerNameDraft, setCustomerNameDraft] = useState(quotation.customerName ?? '')
  const [customerMobileDraft, setCustomerMobileDraft] = useState(quotation.customerMobile ?? '')
  const [metalTypeDraft, setMetalTypeDraft] = useState<MetalPurityValue | ''>(
    (quotation.metalType as MetalPurityValue | null) ?? '',
  )
  const [metalColorDraft, setMetalColorDraft] = useState<MetalColorValue | ''>(
    (quotation.metalColor as MetalColorValue | null) ?? '',
  )
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionIndex, setMentionIndex] = useState(0)
  const commentRef = useRef<HTMLTextAreaElement>(null)

  const latest = quotation.estimates[0] ?? null
  const history = quotation.estimates.slice(1)
  const status = quotation.status
  const linkedProduct = useMemo(
    () => products.find((p) => p.id === quotation.productId) ?? null,
    [products, quotation.productId],
  )
  const timelineEvents = useMemo(
    () => quotation.events.filter((ev) => ev.type !== 'COMMENT'),
    [quotation.events],
  )
  const mentionMatches = useMemo(() => {
    if (mentionQuery == null) return []
    const q = mentionQuery.toLowerCase()
    return discordHandles.filter((h) => {
      if (!q) return true
      return (
        h.handle.toLowerCase().includes(q) ||
        (h.label?.toLowerCase().includes(q) ?? false)
      )
    })
  }, [discordHandles, mentionQuery])

  async function patch(body: Record<string, unknown>) {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/quotations/${quotation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Action failed')
        return false
      }
      router.refresh()
      return true
    } finally {
      setSaving(false)
    }
  }

  async function postComment() {
    const body = commentBody.trim()
    if (!body) return
    setSaving(true)
    setError(null)
    try {
      const attachmentUrls = attachUrls
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
      const res = await fetch(`/api/admin/quotations/${quotation.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body,
          kind: commentKind,
          attachmentUrls: attachmentUrls.length ? attachmentUrls : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Comment failed')
        return
      }
      setCommentBody('')
      setAttachUrls('')
      setCommentKind('INTERNAL')
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  async function saveProduct() {
    const nextId = productIdDraft.trim() || null
    const ok = await patch({ action: 'set_product', productId: nextId })
    if (ok) setEditingProduct(false)
  }

  async function saveRequirements() {
    if (!detailsDraft.trim()) {
      setError('Details are required')
      return
    }
    const ok = await patch({
      action: 'update_details',
      details: detailsDraft.trim(),
      customerName: customerNameDraft.trim() || null,
      customerMobile: customerMobileDraft.trim() || null,
      metalType: metalTypeDraft || null,
      metalColor: metalColorDraft || null,
    })
    if (ok) setEditingRequirements(false)
  }

  async function downloadRequirementsPdf() {
    setDownloadingPdf(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/quotations/${quotation.id}/requirements-pdf`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Could not download PDF')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${quotation.displayId}-requirements.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not download PDF')
    } finally {
      setDownloadingPdf(false)
    }
  }

  /** Detect trailing @query at caret for mention autocomplete. */
  function syncMentionState(value: string, caret: number) {
    const before = value.slice(0, caret)
    const match = before.match(/(^|[\s([{])@([a-zA-Z0-9._-]*)$/)
    if (!match) {
      setMentionQuery(null)
      setMentionIndex(0)
      return
    }
    setMentionQuery(match[2] ?? '')
    setMentionIndex(0)
  }

  function applyMention(handle: string) {
    const el = commentRef.current
    const value = commentBody
    const caret = el?.selectionStart ?? value.length
    const before = value.slice(0, caret)
    const after = value.slice(caret)
    const replaced = before.replace(/(^|[\s([{])@([a-zA-Z0-9._-]*)$/, `$1@${handle} `)
    const next = replaced + after
    setCommentBody(next)
    setMentionQuery(null)
    setMentionIndex(0)
    requestAnimationFrame(() => {
      if (!commentRef.current) return
      const pos = replaced.length
      commentRef.current.focus()
      commentRef.current.setSelectionRange(pos, pos)
    })
  }

  function onCommentChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value
    setCommentBody(value)
    syncMentionState(value, e.target.selectionStart ?? value.length)
  }

  function onCommentKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionQuery == null || mentionMatches.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setMentionIndex((i) => (i + 1) % mentionMatches.length)
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setMentionIndex((i) => (i - 1 + mentionMatches.length) % mentionMatches.length)
      return
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      const pick = mentionMatches[mentionIndex] ?? mentionMatches[0]
      if (pick) applyMention(pick.handle)
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setMentionQuery(null)
    }
  }

  async function uploadAttachments(files: FileList | null) {
    if (!files?.length) return
    setSaving(true)
    setError(null)
    try {
      const urls: string[] = []
      for (const file of Array.from(files)) {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('folder', 'quotations/screenshots')
        const res = await fetch('/api/admin/upload', { method: 'POST', body: fd })
        const data = await res.json()
        if (!res.ok || !data.url) {
          setError(data.error ?? `Upload failed for ${file.name}`)
          return
        }
        urls.push(data.url as string)
      }
      setAttachUrls((prev) => [...prev.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean), ...urls].join('\n'))
    } finally {
      setSaving(false)
    }
  }

  const canMarkQuoted = status === 'REQUESTED' || status === 'QUOTED'
  const canRecordResponse = status === 'QUOTED' || status === 'ACCEPTED'
  const canConvert = status === 'ACCEPTED'
  const canCancel = status === 'REQUESTED' || status === 'QUOTED' || status === 'ACCEPTED'

  const estimateBlock = (
    <>
      <section style={{ background: '#fff', border: '1px solid #e5e7eb', padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
          <h2 style={{ fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b7280', margin: 0 }}>
            Current estimate
          </h2>
          {latest && (
            <span style={{ fontSize: '0.6875rem', background: '#032b24', color: '#fff', padding: '2px 8px' }}>
              Latest · v{latest.version}
            </span>
          )}
        </div>

        {!latest ? (
          <p style={{ margin: '0 0 12px', color: '#6b7280', fontSize: '0.8125rem' }}>
            No estimates yet. Open the Cost Estimator to save the first version.
          </p>
        ) : (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: '1.125rem', fontWeight: 600 }}>{estimateLabel(latest)}</div>
            <div style={{ fontSize: '1.5rem', margin: '4px 0 8px' }}>{formatInr(latest.finalTotal)}</div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
              {latest.mode} · {latest.ratesLocked ? 'Gold rate locked' : 'Gold rate unlocked'} ·{' '}
              {formatWhen(latest.createdAt)}
              {latest.createdByEmail ? ` · ${latest.createdByEmail}` : ''}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {status !== 'CONVERTED' && status !== 'CANCELLED' && (
            <Link href={`/admin/cost-estimator?quotationId=${quotation.id}`} className="admin-btn">
              {latest ? 'New estimate version' : 'Open estimator'}
            </Link>
          )}
          {canMarkQuoted && status !== 'QUOTED' && (
            <button
              type="button"
              className="admin-btn"
              disabled={saving}
              onClick={() =>
                void patch({
                  action: 'mark_quoted',
                  quotedAmount: latest?.finalTotal,
                  quotedNotes: quoteNotes || undefined,
                })
              }
            >
              Mark quoted
            </button>
          )}
          {status === 'QUOTED' && (
            <button
              type="button"
              className="admin-btn"
              disabled={saving}
              onClick={() =>
                void patch({
                  action: 'mark_quoted',
                  quotedAmount: latest?.finalTotal,
                  quotedNotes: quoteNotes || undefined,
                })
              }
            >
              Refresh quoted amount
            </button>
          )}
          {canRecordResponse && (
            <button type="button" className="admin-btn" onClick={() => setShowResponse((v) => !v)}>
              Record response
            </button>
          )}
          {canConvert && (
            <Link href={`/admin/orders/new?quotationId=${quotation.id}`} className="admin-btn">
              Convert to order
            </Link>
          )}
          {status === 'CONVERTED' && quotation.orderId && (
            <Link href={`/admin/orders/${quotation.orderId}`} className="admin-btn">
              View order
            </Link>
          )}
          {canCancel && (
            <button
              type="button"
              disabled={saving}
              onClick={() => void patch({ action: 'cancel' })}
              style={{
                border: '1px solid #b91c1c',
                color: '#b91c1c',
                background: '#fff',
                padding: '8px 16px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          )}
        </div>

        {(status === 'REQUESTED' || status === 'QUOTED') && (
          <div style={{ marginTop: 12 }}>
            <label style={{ display: 'block', fontSize: '0.6875rem', textTransform: 'uppercase', color: '#6b7280', marginBottom: 4 }}>
              Quoted notes (optional)
            </label>
            <input
              value={quoteNotes}
              onChange={(e) => setQuoteNotes(e.target.value)}
              style={{ width: '100%', border: '1px solid #d1d5db', padding: '6px 8px' }}
            />
          </div>
        )}

        {showResponse && canRecordResponse && (
          <div style={{ marginTop: 16, borderTop: '1px solid #e5e7eb', paddingTop: 12 }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 8 }}>Record customer response</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.8125rem' }}>
              {(['accepted', 'declined', 'needs_revision'] as const).map((r) => (
                <label key={r} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="radio" name="resp" checked={response === r} onChange={() => setResponse(r)} />
                  {r === 'accepted' ? 'Accepted' : r === 'declined' ? 'Declined' : 'Needs revision'}
                </label>
              ))}
              <label style={{ display: 'block' }}>
                Channel
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as typeof channel)}
                  style={{ display: 'block', width: '100%', marginTop: 4, border: '1px solid #d1d5db', padding: 6 }}
                >
                  <option value="call">Call</option>
                  <option value="whatsapp">WhatsApp (offline)</option>
                  <option value="in_person">In person</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <textarea
                value={responseNotes}
                onChange={(e) => setResponseNotes(e.target.value)}
                rows={2}
                placeholder="Notes…"
                style={{ width: '100%', border: '1px solid #d1d5db', padding: 8, fontFamily: 'inherit' }}
              />
              <button
                type="button"
                className="admin-btn"
                disabled={saving}
                onClick={async () => {
                  const ok = await patch({
                    action: 'record_response',
                    response,
                    channel,
                    notes: responseNotes || undefined,
                  })
                  if (ok) setShowResponse(false)
                }}
              >
                Save response
              </button>
            </div>
          </div>
        )}

        {error && <p style={{ color: '#b91c1c', fontSize: '0.8125rem', marginTop: 12 }}>{error}</p>}
      </section>

      <section style={{ background: '#fff', border: '1px solid #e5e7eb', padding: '1.25rem' }}>
        <button
          type="button"
          onClick={() => setShowHistory((v) => !v)}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            fontSize: '0.75rem',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#6b7280',
          }}
        >
          History ({history.length}) {showHistory ? '▾' : '▸'}
        </button>
        {showHistory && (
          history.length === 0 ? (
            <p style={{ margin: '8px 0 0', color: '#9ca3af', fontSize: '0.8125rem' }}>No prior versions.</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: '12px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {history.map((est) => (
                <li key={est.id} style={{ fontSize: '0.8125rem', borderBottom: '1px solid #f3f4f6', paddingBottom: 8 }}>
                  <strong>{estimateLabel(est)}</strong>
                  <div style={{ color: '#6b7280' }}>
                    {formatInr(est.finalTotal)} · {est.ratesLocked ? 'locked' : 'unlocked'} · {formatWhen(est.createdAt)}
                  </div>
                </li>
              ))}
            </ul>
          )
        )}
      </section>
    </>
  )

  const commentsBlock = (
    <section style={{ background: '#fff', border: '1px solid #e5e7eb', padding: '1.25rem' }}>
      <h2 style={{ fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b7280', margin: '0 0 0.75rem' }}>
        Comments
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
        {quotation.comments.map((c) => {
          const kindLabel = commentKindLabel(c.kind)
          return (
            <div key={c.id} style={{ fontSize: '0.8125rem', background: '#f9fafb', padding: '0.75rem' }}>
              <div style={{ color: '#9ca3af', fontSize: '0.6875rem', marginBottom: 4 }}>
                {kindLabel && (
                  <span
                    style={{
                      display: 'inline-block',
                      marginRight: 6,
                      padding: '1px 6px',
                      background: c.kind === 'CUSTOMER_RESPONSE' ? '#ecfdf5' : '#eff6ff',
                      color: c.kind === 'CUSTOMER_RESPONSE' ? '#065f46' : '#1e40af',
                      fontSize: '0.625rem',
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {kindLabel}
                  </span>
                )}
                {c.authorEmail} · {formatWhen(c.createdAt)}
              </div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{c.body}</div>
              {c.attachmentUrls.length > 0 && (
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  {c.attachmentUrls.map((url) => (
                    <a key={url} href={url} target="_blank" rel="noopener noreferrer" style={{ color: '#032b24', fontSize: '0.75rem' }}>
                      Attachment ↗
                    </a>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <textarea
          ref={commentRef}
          value={commentBody}
          onChange={onCommentChange}
          onKeyDown={onCommentKeyDown}
          onClick={(e) =>
            syncMentionState(e.currentTarget.value, e.currentTarget.selectionStart ?? 0)
          }
          onKeyUp={(e) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End') {
              syncMentionState(e.currentTarget.value, e.currentTarget.selectionStart ?? 0)
            }
          }}
          rows={3}
          placeholder="Internal note… type @ to mention"
          style={{ width: '100%', border: '1px solid #d1d5db', padding: 8, fontFamily: 'inherit', display: 'block' }}
        />
        {mentionQuery != null && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: '100%',
              marginTop: 4,
              zIndex: 20,
              background: '#fff',
              border: '1px solid #e5e7eb',
              boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
              maxHeight: 220,
              overflowY: 'auto',
            }}
          >
            {discordHandles.length === 0 ? (
              <p style={{ margin: 0, padding: '10px 12px', fontSize: '0.8125rem', color: '#9ca3af' }}>
                No Discord users mapped — add them in Quotation settings.
              </p>
            ) : mentionMatches.length === 0 ? (
              <p style={{ margin: 0, padding: '10px 12px', fontSize: '0.8125rem', color: '#9ca3af' }}>
                No matches for @{mentionQuery}
              </p>
            ) : (
              mentionMatches.map((h, i) => (
                <button
                  key={h.handle}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    applyMention(h.handle)
                  }}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    width: '100%',
                    textAlign: 'left',
                    padding: '9px 12px',
                    fontSize: '0.8125rem',
                    border: 'none',
                    borderBottom: '1px solid #f3f4f6',
                    cursor: 'pointer',
                    background: i === mentionIndex ? '#ecfdf5' : '#fff',
                    color: '#111827',
                  }}
                >
                  <span>
                    <strong>@{h.handle}</strong>
                    {h.label ? <span style={{ color: '#6b7280' }}> · {h.label}</span> : null}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10, fontSize: '0.8125rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={commentKind === 'CUSTOMER_RESPONSE'}
            onChange={(e) => setCommentKind(e.target.checked ? 'CUSTOMER_RESPONSE' : 'INTERNAL')}
          />
          Customer response
          <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>(timeline: Customer Replied)</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={commentKind === 'OUR_RESPONSE'}
            onChange={(e) => setCommentKind(e.target.checked ? 'OUR_RESPONSE' : 'INTERNAL')}
          />
          Replied to customer
          <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>(timeline: Our Response)</span>
        </label>
      </div>
      {attachUrls && (
        <p style={{ margin: '0 0 8px', fontSize: '0.75rem', color: '#6b7280' }}>
          {attachUrls.split(/[\n,]+/).filter(Boolean).length} file(s) ready
        </p>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
        <button
          type="button"
          className="admin-btn"
          disabled={saving || !commentBody.trim()}
          onClick={() => void postComment()}
          style={{ flex: 1, margin: 0 }}
        >
          Post comment
        </button>
        <label className="admin-btn" style={{ flex: 1, cursor: 'pointer', margin: 0, boxSizing: 'border-box' }}>
          Attach files
          <input
            type="file"
            multiple
            accept="image/*,application/pdf"
            style={{ display: 'none' }}
            onChange={(e) => void uploadAttachments(e.target.files)}
          />
        </label>
      </div>
    </section>
  )

  return (
    <div className="quotation-desk">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <section style={{ background: '#fff', border: '1px solid #e5e7eb', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b7280', margin: 0 }}>
              Requirements
            </h2>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => void downloadRequirementsPdf()}
                disabled={downloadingPdf}
                style={{
                  border: '1px solid #d1d5db',
                  background: '#fff',
                  color: '#032b24',
                  cursor: downloadingPdf ? 'wait' : 'pointer',
                  fontSize: '0.75rem',
                  padding: '4px 10px',
                }}
              >
                {downloadingPdf ? 'Preparing…' : 'Download requirements'}
              </button>
              {status !== 'CONVERTED' && status !== 'CANCELLED' && (
                <button
                  type="button"
                  onClick={() => {
                    if (!editingRequirements) {
                      setDetailsDraft(quotation.details ?? '')
                      setCustomerNameDraft(quotation.customerName ?? '')
                      setCustomerMobileDraft(quotation.customerMobile ?? '')
                      setMetalTypeDraft((quotation.metalType as MetalPurityValue | null) ?? '')
                      setMetalColorDraft((quotation.metalColor as MetalColorValue | null) ?? '')
                    }
                    setEditingRequirements((v) => !v)
                  }}
                  style={{
                    border: 'none',
                    background: 'none',
                    color: '#032b24',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    textDecoration: 'underline',
                    padding: 0,
                  }}
                >
                  {editingRequirements ? 'Cancel' : 'Edit'}
                </button>
              )}
            </div>
          </div>

          {editingRequirements ? (
            <div style={{ display: 'grid', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.6875rem', textTransform: 'uppercase', color: '#6b7280', marginBottom: 4 }}>
                  Details
                </label>
                <textarea
                  value={detailsDraft}
                  onChange={(e) => setDetailsDraft(e.target.value)}
                  rows={4}
                  style={{ width: '100%', border: '1px solid #d1d5db', padding: 8, fontFamily: 'inherit' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.6875rem', textTransform: 'uppercase', color: '#6b7280', marginBottom: 4 }}>
                    Customer name
                  </label>
                  <input
                    value={customerNameDraft}
                    onChange={(e) => setCustomerNameDraft(e.target.value)}
                    style={{ width: '100%', border: '1px solid #d1d5db', padding: '6px 8px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.6875rem', textTransform: 'uppercase', color: '#6b7280', marginBottom: 4 }}>
                    Mobile
                  </label>
                  <input
                    value={customerMobileDraft}
                    onChange={(e) => setCustomerMobileDraft(e.target.value)}
                    style={{ width: '100%', border: '1px solid #d1d5db', padding: '6px 8px' }}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.6875rem', textTransform: 'uppercase', color: '#6b7280', marginBottom: 4 }}>
                    Gold purity
                  </label>
                  <select
                    value={metalTypeDraft}
                    onChange={(e) => setMetalTypeDraft(e.target.value as MetalPurityValue | '')}
                    style={{ width: '100%', border: '1px solid #d1d5db', padding: '6px 8px' }}
                  >
                    <option value="">—</option>
                    {METAL_PURITIES.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.6875rem', textTransform: 'uppercase', color: '#6b7280', marginBottom: 4 }}>
                    Gold color
                  </label>
                  <select
                    value={metalColorDraft}
                    onChange={(e) => setMetalColorDraft(e.target.value as MetalColorValue | '')}
                    style={{ width: '100%', border: '1px solid #d1d5db', padding: '6px 8px' }}
                  >
                    <option value="">—</option>
                    {METAL_COLORS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button type="button" className="admin-btn" disabled={saving} onClick={() => void saveRequirements()}>
                Save requirements
              </button>
            </div>
          ) : (
            <>
              <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{quotation.details || '—'}</p>
              <div style={{ marginTop: 10, fontSize: '0.8125rem', color: '#4b5563', display: 'grid', gap: 4 }}>
                <div>
                  <strong>Gold purity:</strong> {purityMeta(quotation.metalType ?? '')?.label ?? '—'}
                </div>
                <div>
                  <strong>Gold color:</strong> {colorMeta(quotation.metalColor ?? '')?.label ?? '—'}
                </div>
              </div>
            </>
          )}

          <div style={{ marginTop: 12, fontSize: '0.8125rem', color: '#4b5563', display: 'grid', gap: 4 }}>
            {quotation.assigneeEmail && <div><strong>Assignee:</strong> {quotation.assigneeEmail}</div>}
            <div>
              <strong>Catalogue product:</strong>{' '}
              {linkedProduct
                ? `${linkedProduct.name}${linkedProduct.itemCode ? ` (${linkedProduct.itemCode})` : ''}`
                : quotation.productId
                  ? quotation.productId
                  : '—'}
              {status !== 'CONVERTED' && status !== 'CANCELLED' && (
                <button
                  type="button"
                  onClick={() => {
                    setProductIdDraft(quotation.productId ?? '')
                    setEditingProduct((v) => !v)
                  }}
                  style={{
                    marginLeft: 8,
                    border: 'none',
                    background: 'none',
                    color: '#032b24',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    textDecoration: 'underline',
                    padding: 0,
                  }}
                >
                  {editingProduct ? 'Cancel' : 'Edit'}
                </button>
              )}
            </div>
            {editingProduct && (
              <div style={{ marginTop: 8 }}>
                <CatalogueProductPicker
                  products={products}
                  value={productIdDraft}
                  onChange={setProductIdDraft}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button type="button" className="admin-btn" disabled={saving} onClick={() => void saveProduct()}>
                    Save product
                  </button>
                </div>
              </div>
            )}
            {threadUrl && (
              <div>
                <a href={threadUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#032b24' }}>
                  Discord thread ↗
                </a>
                <span style={{ color: '#9ca3af' }}> · secondary notify only</span>
              </div>
            )}
          </div>
          {quotation.screenshotUrls.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              {quotation.screenshotUrls.map((url) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={url} src={url} alt="Quote screenshot" style={{ width: 88, height: 88, objectFit: 'cover' }} />
              ))}
            </div>
          )}
        </section>

        <section style={{ background: '#fff', border: '1px solid #e5e7eb', padding: '1.25rem' }}>
          <h2 style={{ fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b7280', margin: '0 0 0.75rem' }}>
            Timeline
          </h2>
          {timelineEvents.length === 0 ? (
            <p style={{ margin: 0, color: '#9ca3af', fontSize: '0.8125rem' }}>No events yet.</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {timelineEvents.map((ev) => (
                <li key={ev.id} style={{ fontSize: '0.8125rem', borderLeft: '2px solid #e5e7eb', paddingLeft: 10 }}>
                  <div style={{ color: '#9ca3af', fontSize: '0.6875rem' }}>
                    {formatWhen(ev.createdAt)} · {ev.type}
                    {ev.actorEmail ? ` · ${ev.actorEmail}` : ''}
                  </div>
                  <div style={{ color: '#111827' }}>{ev.message || '—'}</div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {estimateBlock}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {commentsBlock}
      </div>
    </div>
  )
}
