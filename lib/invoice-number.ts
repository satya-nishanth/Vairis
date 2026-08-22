import { prisma } from '@/lib/prisma'

export function financialYearLabel(d = new Date()): string {
  const y = d.getFullYear()
  const month = d.getMonth() + 1
  const start = month >= 4 ? y : y - 1
  return `${String(start).slice(-2)}-${String(start + 1).slice(-2)}`
}

export function invoiceNumberPrefix(d = new Date()): string {
  return `VAI/${financialYearLabel(d)}/`
}

export async function nextInvoiceNumber(): Promise<string> {
  const prefix = invoiceNumberPrefix()
  const last = await prisma.invoice.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: 'desc' },
    select: { number: true },
  })
  const seq = last ? Number(last.number.slice(prefix.length)) + 1 : 1
  if (!Number.isFinite(seq) || seq < 1) {
    throw new Error('Could not allocate invoice number')
  }
  return `${prefix}${String(seq).padStart(4, '0')}`
}
