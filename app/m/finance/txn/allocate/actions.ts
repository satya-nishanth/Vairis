'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireFinance } from '@/lib/finance-auth'
import { dateInputToIstDate } from '@/lib/finance'
import { allocationCreateNested, prepareAllocations } from '@/lib/finance-allocations'
import { financeActorFromSession, logFinanceAudit, txObjectLabel } from '@/lib/finance-audit'
import {
  financeTransactionInclude,
  serializeFinanceTransaction,
} from '@/lib/finance-transaction-serialize'
import { MOBILE_TXN_COOKIE, type MobileTxnDraft } from '@/lib/mobile-txn-draft'

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

function failAllocate(message: string, tab: string): never {
  redirect(
    `/m/finance/txn/allocate?tab=${encodeURIComponent(tab)}&error=${encodeURIComponent(message)}`,
  )
}

async function readDraftOrBounce(): Promise<MobileTxnDraft> {
  await requireFinance()
  const jar = await cookies()
  const draft = parseDraft(jar.get(MOBILE_TXN_COOKIE)?.value)
  if (!draft) redirect('/m/finance/txn?error=' + encodeURIComponent('Details missing — fill page 1 again'))
  return draft
}

async function createFromDraft(
  draft: MobileTxnDraft,
  allocations: { amount: number; orderId: string | null; purchaseBillId: string | null }[],
) {
  const session = await requireFinance()

  const amount = Number(draft.amount)
  const isTransfer = draft.direction === 'TRANSFER'
  const prepared = await prepareAllocations(allocations, amount)
  if ('error' in prepared) return { error: prepared.error }

  const orderIds = prepared.orderIds

  const row = await prisma.financeTransaction.create({
    data: {
      date: dateInputToIstDate(draft.date),
      direction: draft.direction,
      amount,
      gstAmount: 0,
      description: draft.description ?? '',
      accountId: draft.accountId,
      paidThroughAccountId: draft.paidThroughAccountId,
      transferToAccountId: isTransfer ? draft.transferToAccountId || null : null,
      categoryId: isTransfer ? null : draft.categoryId || null,
      contactId: isTransfer ? null : draft.contactId || null,
      contactName: isTransfer ? '' : draft.contactText,
      autoCreated: false,
      reviewComplete: true,
      unlinkedOrderLabels: [],
      unlinkedInventoryLabels: [],
      orders: orderIds.length ? { create: orderIds.map((orderId) => ({ orderId })) } : undefined,
      allocations: prepared.rows.length
        ? { create: allocationCreateNested(prepared.rows) }
        : undefined,
    },
    include: financeTransactionInclude,
  })

  const after = serializeFinanceTransaction(row)
  await logFinanceAudit({
    actor: financeActorFromSession(session),
    action: 'CREATE',
    entityType: 'TRANSACTION',
    entityId: row.id,
    objectLabel: txObjectLabel(after),
    objectHref: `/admin/finance/transactions?edit=${row.id}`,
    summary: `Created ${draft.direction.toLowerCase()} ₹${after.amount.toLocaleString('en-IN')}${after.contactName ? ` — ${after.contactName}` : ''}`,
    after,
  })

  const jar = await cookies()
  jar.delete(MOBILE_TXN_COOKIE)
  return { ok: true as const }
}

function tabFromForm(formData: FormData) {
  const t = String(formData.get('tab') ?? 'orders')
  return t === 'bills' ? 'bills' : 'orders'
}

function kindFromTab(tab: string): 'ORDER' | 'PURCHASE_BILL' {
  return tab === 'bills' ? 'PURCHASE_BILL' : 'ORDER'
}

function parseAllocationsFromForm(formData: FormData, tab: string) {
  const kind = kindFromTab(tab)
  const selected = formData.getAll('doc').map((v) => String(v))
  const allocations: { amount: number; orderId: string | null; purchaseBillId: string | null }[] = []
  for (const id of selected) {
    const raw = String(formData.get(`amount__${id}`) ?? '').replace(/,/g, '')
    const amount = Number(raw)
    if (!(amount > 0)) continue
    allocations.push({
      amount,
      orderId: kind === 'ORDER' ? id : null,
      purchaseBillId: kind === 'PURCHASE_BILL' ? id : null,
    })
  }
  return allocations
}

/** Save with allocations from checked rows. */
export async function saveAllocatedTxn(formData: FormData) {
  const draft = await readDraftOrBounce()
  const tab = tabFromForm(formData)

  if (draft.direction === 'TRANSFER') {
    const result = await createFromDraft(draft, [])
    if ('error' in result) failAllocate(result.error!, tab)
    redirect('/m/finance/txn/allocate?saved=1')
  }

  const allocations = parseAllocationsFromForm(formData, tab)
  const result = await createFromDraft(draft, allocations)
  if ('error' in result) failAllocate(result.error!, tab)
  redirect('/m/finance/txn/allocate?saved=1')
}

/** Save with no allocations. */
export async function skipAllocatedTxn(formData: FormData) {
  const draft = await readDraftOrBounce()
  const tab = tabFromForm(formData)
  const result = await createFromDraft(draft, [])
  if ('error' in result) failAllocate(result.error!, tab)
  redirect('/m/finance/txn/allocate?saved=1')
}
