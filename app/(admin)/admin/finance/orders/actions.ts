'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { FINANCE_LINE_KINDS } from '@/lib/finance'
import { requireFinance } from '@/lib/finance-auth'
import { upsertOrderFinanceSheet } from '@/lib/finance-order-sheet-upsert'

const ORDERS_PATH = '/admin/finance/orders'

/** Prefer last non-empty value — mobile stack is after desk when both submit. */
function formMoney(formData: FormData, key: string): number {
  const values = formData.getAll(key)
  for (let i = values.length - 1; i >= 0; i--) {
    const s = String(values[i] ?? '').trim()
    if (s === '') continue
    const n = Number(s)
    if (Number.isFinite(n)) return n
  }
  return 0
}

export async function saveOrderSheetAction(formData: FormData) {
  const session = await requireFinance()

  const orderId = String(formData.get('orderId') ?? '').trim()
  const paidToAccountId = String(formData.get('paidToAccountId') ?? '').trim()
  const purchaseFromAccountId = String(formData.get('purchaseFromAccountId') ?? '').trim() || null

  if (!orderId) {
    redirect(`${ORDERS_PATH}?error=${encodeURIComponent('Missing order')}`)
  }

  const orderQs = `orderId=${encodeURIComponent(orderId)}`

  if (!paidToAccountId) {
    redirect(`${ORDERS_PATH}?${orderQs}&error=${encodeURIComponent('Pick paid-to account')}`)
  }

  const lines = FINANCE_LINE_KINDS.map((kind) => ({
    kind,
    costPrice: formMoney(formData, `cost_${kind}`),
    sellingPrice: formMoney(formData, `sell_${kind}`),
  }))
  const roundOffEnabled =
    formData.get('roundOffEnabled') === 'on' || formData.get('roundOffEnabled') === 'true'

  try {
    await upsertOrderFinanceSheet(
      { orderId, paidToAccountId, purchaseFromAccountId, lines, roundOffEnabled },
      session,
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Save failed'
    redirect(`${ORDERS_PATH}?${orderQs}&error=${encodeURIComponent(msg)}`)
  }

  revalidatePath(ORDERS_PATH)
  redirect(`${ORDERS_PATH}?saved=1`)
}
