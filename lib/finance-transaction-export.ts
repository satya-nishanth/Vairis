import * as XLSX from 'xlsx'
import { shortFinanceId, toDateInput } from '@/lib/finance'

export type FinanceTransactionExportRow = {
  id: string
  date: Date
  direction: string
  amount: number
  description: string
  accountName: string | null
  paidThroughAccountName: string | null
  transferToAccountName: string | null
  categoryName: string | null
  contactName: string | null
  autoCreated: boolean
  reviewComplete: boolean
  orderIds: string[]
  unlinkedOrderLabels?: string[]
}

export function buildTransactionsXlsx(rows: FinanceTransactionExportRow[]): Buffer {
  const data = rows
    .map((r) => {
      const isTransfer = r.direction === 'TRANSFER'
      const isOut = r.direction === 'OUTFLOW'
      const flow = isTransfer ? 'Transfer' : isOut ? 'Out' : 'In'
      const bank = isTransfer
        ? `${r.paidThroughAccountName ?? ''} → ${r.transferToAccountName ?? ''}`
        : (r.paidThroughAccountName ?? '')
      return {
        Date: toDateInput(r.date),
        Flow: flow,
        Source: r.autoCreated ? 'Auto-created' : 'Manual',
        'Handled by': r.accountName ?? '',
        Amount: r.amount,
        'Bank / transfer': bank,
        Category: r.categoryName ?? '',
        Contact: r.contactName ?? '',
        Description: r.description,
        Orders: [
          ...r.orderIds.map(shortFinanceId),
          ...(r.unlinkedOrderLabels ?? []).map((label) => `${label} (not linked)`),
        ].join(', '),
        'Review status': r.reviewComplete ? 'Reviewed' : 'For review',
        ID: r.id,
      }
    })
    .sort((a, b) => b.Date.localeCompare(a.Date) || b.ID.localeCompare(a.ID))

  const ws = XLSX.utils.json_to_sheet(data)
  ws['!cols'] = [
    { wch: 12 },
    { wch: 10 },
    { wch: 12 },
    { wch: 18 },
    { wch: 12 },
    { wch: 24 },
    { wch: 18 },
    { wch: 18 },
    { wch: 30 },
    { wch: 16 },
    { wch: 12 },
    { wch: 28 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Transactions')
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
}
