import Link from 'next/link'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { requireFinance } from '@/lib/finance-auth'
import { shortFinanceId, toDateInput } from '@/lib/finance'
import {
  listRecentFinanceOrdersForAllocation,
  searchFinanceOrdersForAllocation,
} from '@/lib/finance-order-search'
import { collectedByPurchaseBillIds, purchaseBillPaymentSummary } from '@/lib/finance-collections'
import { MOBILE_TXN_COOKIE, type MobileTxnDraft } from '@/lib/mobile-txn-draft'
import { saveAllocatedTxn, skipAllocatedTxn } from '@/app/m/finance/txn/allocate/actions'

export const dynamic = 'force-dynamic'

type AllocDoc = {
  id: string
  kind: 'ORDER' | 'PURCHASE_BILL'
  title: string
  contact: string
  dateLabel: string
  itemLabel: string
  total: number
  balance: number
}

function parseDraft(raw: string | undefined): MobileTxnDraft | null {
  if (!raw) return null
  try {
    const d = JSON.parse(raw) as MobileTxnDraft
    if (!d?.date || !d?.direction || !d?.amount || !d?.accountId || !d?.paidThroughAccountId) {
      return null
    }
    return d
  } catch {
    return null
  }
}

function formatDocDate(iso: string | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function inr(n: number) {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

function summaryLine(draft: MobileTxnDraft) {
  const dir =
    draft.direction === 'INFLOW' ? 'Inflow' : draft.direction === 'OUTFLOW' ? 'Outflow' : 'Transfer'
  const amt =
    draft.amountUnit === 'GRAMS'
      ? `${Number(draft.amount).toLocaleString('en-IN', { maximumFractionDigits: 3 })} g`
      : inr(Number(draft.amount))
  const parts = [
    dir,
    amt,
    draft.accountName || null,
    draft.direction === 'TRANSFER'
      ? [draft.paidThroughName, draft.transferToName].filter(Boolean).join(' → ')
      : draft.paidThroughName || null,
    draft.contactText || null,
  ].filter(Boolean)
  return parts.join(' · ')
}

function suggestAmount(balance: number, cash: number) {
  const due = Math.max(0, balance)
  if (cash > 0.009 && due > 0.009) return Math.min(due, cash)
  if (cash > 0.009) return cash
  return due > 0.009 ? due : 0
}

export default async function MobileFinanceTxnAllocatePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; error?: string; saved?: string }>
}) {
  await requireFinance()
  const sp = await searchParams
  const jar = await cookies()
  const draft = parseDraft(jar.get(MOBILE_TXN_COOKIE)?.value)
  const tab = sp.tab === 'bills' ? 'bills' : 'orders'
  const q = (sp.q ?? '').trim()
  const error = (sp.error ?? '').trim()
  const saved = sp.saved === '1'

  if (saved) {
    return (
      <div className="m-txn m-txn--alloc">
        <header className="m-txn__top">
          <h1 className="m-txn__title m-txn__title--center">Saved</h1>
        </header>
        <div className="m-txn__body">
          <div className="m-txn__success">
            <h2>Transaction saved</h2>
            <p>It appears in the finance cashbook.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Link href="/m/finance/txn" className="m-txn__btn m-txn__btn--primary">
                Add another
              </Link>
              <Link href="/admin/finance/transactions" className="m-txn__btn m-txn__btn--ghost">
                Open cashbook
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!draft) {
    return (
      <div className="m-txn m-txn--alloc">
        <header className="m-txn__top">
          <Link className="m-txn__back" href="/m/finance/txn" aria-label="Back to details">
            ‹
          </Link>
          <h1 className="m-txn__title m-txn__title--center">Allocate</h1>
        </header>
        <div className="m-txn__body">
          <p className="m-txn__error">Details missing — go back and tap Next again.</p>
          <Link href="/m/finance/txn" className="m-txn__btn m-txn__btn--primary">
            Back to details
          </Link>
        </div>
      </div>
    )
  }

  const cash = Number(draft.amount) || 0
  const isTransfer = draft.direction === 'TRANSFER'

  let docs: AllocDoc[] = []

  if (!isTransfer && tab === 'orders') {
    const orderHits =
      q.length >= 2
        ? await searchFinanceOrdersForAllocation(q)
        : await listRecentFinanceOrdersForAllocation(24)
    docs = orderHits
      .filter((o) => (q.length >= 2 ? true : o.balance > 0.009))
      .slice(0, 12)
      .map((o) => {
        const kindTag =
          o.orderKind === 'parent'
            ? o.childCount > 0
              ? `Parent · ${o.childCount} delivery`
              : 'Parent'
            : o.orderKind === 'child' && o.parentOrderId
              ? `Child of #${shortFinanceId(o.parentOrderId)}`
              : null
        return {
          id: o.id,
          kind: 'ORDER' as const,
          title: `#${shortFinanceId(o.id)}`,
          contact: o.contactName?.trim() || '—',
          dateLabel: formatDocDate(o.createdAt),
          itemLabel: [kindTag, o.itemsLabel?.trim() || null].filter(Boolean).join(' · ') || '—',
          total: o.expected,
          balance: o.balance,
        }
      })
  }

  if (!isTransfer && tab === 'bills') {
    const billRows = await prisma.purchaseBill.findMany({
      where:
        q.length >= 2
          ? {
              OR: [
                { billNumber: { contains: q, mode: 'insensitive' } },
                { supplierName: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
              ],
            }
          : undefined,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: q.length >= 2 ? 40 : 80,
      include: {
        supplierContact: { select: { id: true, name: true } },
        lines: { orderBy: { sortOrder: 'asc' }, take: 3 },
      },
    })
    const paidMap = await collectedByPurchaseBillIds(billRows.map((r) => r.id))
    for (const r of billRows) {
      if (docs.length >= 12) break
      const total = Number(r.totalAmount)
      const paid = paidMap.get(r.id) ?? 0
      const summary = purchaseBillPaymentSummary(total, paid)
      if (q.length < 2 && !(summary.balance > 0.009)) continue
      const lineSummary = r.lines
        .map((l) => l.description.trim())
        .filter(Boolean)
        .slice(0, 3)
        .join(' · ')
      docs.push({
        id: r.id,
        kind: 'PURCHASE_BILL',
        title: r.billNumber ? `#${r.billNumber}` : `Bill ${shortFinanceId(r.id)}`,
        contact: r.supplierName?.trim() || r.supplierContact?.name?.trim() || '—',
        dateLabel: toDateInput(r.date),
        itemLabel: r.description?.trim() || lineSummary || '—',
        total,
        balance: summary.balance,
      })
    }
  }

  const ordersHref = q
    ? `/m/finance/txn/allocate?tab=orders&q=${encodeURIComponent(q)}`
    : '/m/finance/txn/allocate?tab=orders'
  const billsHref = q
    ? `/m/finance/txn/allocate?tab=bills&q=${encodeURIComponent(q)}`
    : '/m/finance/txn/allocate?tab=bills'

  return (
    <div className="m-txn m-txn--alloc">
      <header className="m-txn__top">
        <Link className="m-txn__back" href="/m/finance/txn" aria-label="Back to details">
          ‹
        </Link>
        <h1 className="m-txn__title m-txn__title--center">Allocate</h1>
      </header>

      <div className="m-txn__body m-txn__body--alloc">
        <p className="m-txn__summary" title={summaryLine(draft)}>
          {summaryLine(draft)}
        </p>

        {isTransfer ? (
          <form action={skipAllocatedTxn}>
            <input type="hidden" name="tab" value={tab} />
            <p className="m-txn__hint-block">Transfers usually skip allocation. Tap Save to post.</p>
            {error ? <p className="m-txn__error">{error}</p> : null}
            <div className="m-txn__sticky-actions">
              <button type="submit" className="m-txn__btn m-txn__btn--primary">
                Save transaction
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="m-txn__underline-tabs" role="tablist">
              <Link
                href={ordersHref}
                role="tab"
                aria-selected={tab === 'orders'}
                className={`m-txn__utab${tab === 'orders' ? ' is-on' : ''}`}
              >
                Orders
              </Link>
              <Link
                href={billsHref}
                role="tab"
                aria-selected={tab === 'bills'}
                className={`m-txn__utab${tab === 'bills' ? ' is-on' : ''}`}
              >
                Purchase bills
              </Link>
            </div>

            <form method="get" action="/m/finance/txn/allocate" className="m-txn__search">
              <input type="hidden" name="tab" value={tab} />
              <span className="m-txn__search-icon" aria-hidden>
                ⌕
              </span>
              <input
                name="q"
                defaultValue={q}
                placeholder={tab === 'orders' ? 'Search orders' : 'Search bills'}
                aria-label={tab === 'orders' ? 'Search orders' : 'Search purchase bills'}
              />
            </form>

            {error ? <p className="m-txn__error">{error}</p> : null}

            <form action={saveAllocatedTxn} id="m-txn-alloc-form">
              <input type="hidden" name="tab" value={tab} />

              {docs.length === 0 ? (
                <p className="m-txn__hint-block">
                  {q.length >= 2
                    ? 'No matches'
                    : tab === 'orders'
                      ? 'No open orders'
                      : 'No open purchase bills'}
                </p>
              ) : null}

              <ul className="m-txn__docs">
                {docs.map((doc) => {
                  const suggested = suggestAmount(doc.balance, cash)
                  const sub =
                    doc.itemLabel && doc.itemLabel !== '—'
                      ? `${doc.dateLabel} · ${doc.itemLabel}`
                      : `${doc.dateLabel} · ${doc.contact}`
                  return (
                    <li key={doc.id} className="m-txn__doc">
                      <label className="m-txn__doc-main">
                        <input
                          type="checkbox"
                          className="m-txn__native-check"
                          name="doc"
                          value={doc.id}
                        />
                        <span className="m-txn__doc-text">
                          <span className="m-txn__doc-title">{doc.title}</span>
                          <span className="m-txn__doc-sub">{sub}</span>
                        </span>
                      </label>
                      <input
                        className="m-txn__doc-amt"
                        name={`amount__${doc.id}`}
                        inputMode="decimal"
                        defaultValue={suggested > 0 ? String(suggested) : ''}
                        aria-label={`Amount for ${doc.title}`}
                      />
                    </li>
                  )
                })}
              </ul>

              <div className="m-txn__alloc-total">
                <span>Allocated total</span>
                <strong>Check rows, then Save</strong>
              </div>

              <div className="m-txn__sticky-actions">
                <button
                  type="submit"
                  formAction={skipAllocatedTxn}
                  className="m-txn__btn m-txn__btn--outline"
                >
                  Skip
                </button>
                <button type="submit" className="m-txn__btn m-txn__btn--primary">
                  Save transaction
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
