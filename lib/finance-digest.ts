import { prisma } from '@/lib/prisma'
import {
  findSheetInflowMismatches,
  isOrderReceiptDirection,
  sheetTotals,
  shortFinanceId,
  type SheetInflowMismatch,
} from '@/lib/finance'
import { countPendingOrderSheets } from '@/lib/finance-order-search'

const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

function baseAppUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')
}

export type FinanceDigestAlerts = {
  pendingSheetsCount: number
  forReviewCount: number
  mismatches: SheetInflowMismatch[]
}

/** Same three warnings as `/admin/finance` banners. */
export async function loadFinanceDigestAlerts(): Promise<FinanceDigestAlerts> {
  const [sheets, transactions, forReviewCount, pendingSheetsCount] = await Promise.all([
    prisma.orderFinance.findMany({
      include: {
        order: { select: { id: true, createdAt: true, contactName: true } },
        lines: true,
      },
    }),
    prisma.financeTransaction.findMany({
      select: {
        date: true,
        direction: true,
        amount: true,
        orders: { select: { orderId: true } },
        allocations: {
          select: { amount: true, orderId: true },
        },
        transferToAccount: { select: { type: true } },
      },
    }),
    prisma.financeTransaction.count({ where: { reviewComplete: false } }),
    countPendingOrderSheets(),
  ])

  const sheetRows = sheets.map((s) => {
    const totals = sheetTotals(
      s.lines.map((l) => ({
        kind: l.kind,
        costPrice: Number(l.costPrice),
        sellingPrice: Number(l.sellingPrice),
      })),
      { roundOffEnabled: s.roundOffEnabled },
    )
    return {
      orderId: s.orderId,
      orderLabel: s.orderId,
      orderCreatedAt: s.order.createdAt,
      cost: totals.cost,
      sellingPrice: totals.selling,
      paidToAccountId: s.paidToAccountId,
    }
  })

  const mismatches = findSheetInflowMismatches(
    sheetRows,
    transactions
      .filter(
        (t) =>
          isOrderReceiptDirection(t.direction) &&
          (t.orders.length > 0 || t.allocations.some((a) => a.orderId)),
      )
      .map((t) => {
        const orderAllocs = t.allocations
          .filter((a) => a.orderId)
          .map((a) => ({ orderId: a.orderId!, amount: Number(a.amount) }))
        const direction = t.direction as 'INFLOW' | 'TRANSFER'
        return {
          date: t.date,
          amount: Number(t.amount),
          orderIds: [
            ...new Set([
              ...t.orders.map((o) => o.orderId),
              ...orderAllocs.map((a) => a.orderId),
            ]),
          ],
          allocations: orderAllocs.length ? orderAllocs : undefined,
          direction,
          transferToCompanyBank:
            direction === 'TRANSFER' && t.transferToAccount?.type === 'COMPANY_BANK',
        }
      }),
  )

  return { pendingSheetsCount, forReviewCount, mismatches }
}

function formatIstDate(d: Date): string {
  return d.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** Discord message body (under 2000 chars). Always includes a header so cron health is visible. */
export function formatFinanceDigestMessage(
  alerts: FinanceDigestAlerts,
  opts?: { baseUrl?: string; now?: Date },
): string {
  const base = (opts?.baseUrl ?? baseAppUrl()).replace(/\/$/, '')
  const now = opts?.now ?? new Date()
  const lines: string[] = [`📊 Finance daily digest — ${formatIstDate(now)}`, '']

  const hasAny =
    alerts.pendingSheetsCount > 0 || alerts.mismatches.length > 0 || alerts.forReviewCount > 0

  if (!hasAny) {
    lines.push('✅ Finance dashboard — no open warnings today.')
    return lines.join('\n')
  }

  if (alerts.pendingSheetsCount > 0) {
    const n = alerts.pendingSheetsCount
    lines.push(
      `⚠️ Incomplete order sheets: ${n}`,
      `→ ${base}/admin/finance/orders`,
      '',
    )
  }

  if (alerts.mismatches.length > 0) {
    const n = alerts.mismatches.length
    lines.push(
      `⚠️ SP ↔ inflow mismatches: ${n} order${n === 1 ? '' : 's'}`,
    )
    for (const m of alerts.mismatches.slice(0, 8)) {
      lines.push(
        `• ${shortFinanceId(m.orderId)} · Sheet SP ${inr(m.sheetSelling)} · Inflows ${inr(m.inflowTotal)}`,
      )
    }
    if (alerts.mismatches.length > 8) {
      lines.push(`• …and ${alerts.mismatches.length - 8} more`)
    }
    lines.push(`→ ${base}/admin/finance/transactions?compose=1`, '')
  }

  if (alerts.forReviewCount > 0) {
    const n = alerts.forReviewCount
    lines.push(
      `⚠️ Transactions needing review: ${n}`,
      `→ ${base}/admin/finance/transactions`,
      '',
    )
  }

  let content = lines.join('\n').trimEnd()
  if (content.length > 1900) {
    content = `${content.slice(0, 1890)}\n…(truncated)`
  }
  return content
}

export async function postDiscordWebhook(webhookUrl: string, content: string): Promise<void> {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Discord webhook failed: ${res.status} ${body}`)
  }
}

export async function runFinanceDigest(): Promise<{
  posted: boolean
  content: string
  alerts: FinanceDigestAlerts
}> {
  const webhookUrl = process.env.DISCORD_FINANCE_WEBHOOK_URL?.trim()
  if (!webhookUrl) {
    throw new Error('DISCORD_FINANCE_WEBHOOK_URL is not set')
  }

  const alerts = await loadFinanceDigestAlerts()
  const content = formatFinanceDigestMessage(alerts)
  await postDiscordWebhook(webhookUrl, content)
  return { posted: true, content, alerts }
}
