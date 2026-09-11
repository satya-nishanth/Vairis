import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { shortFinanceId } from '@/lib/finance'

export type FinanceAuditAction = 'CREATE' | 'UPDATE' | 'DELETE'
export type FinanceAuditEntity =
  | 'TRANSACTION'
  | 'ORDER_SHEET'
  | 'PURCHASE_BILL'
  | 'ACCOUNT'
  | 'CONTACT'
  | 'CATEGORY'
  | 'EXPENSE'

export type FinanceAuditActor = {
  actorEmail: string
  actorUserId?: string | null
}

/** Pull actor from requireFinanceApi() success result. */
export function financeActorFromSession(session: {
  user: { id: string; email?: string | null }
}): FinanceAuditActor {
  return {
    actorEmail: session.user.email?.trim().toLowerCase() || 'unknown',
    actorUserId: session.user.id,
  }
}

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined
  try {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
  } catch {
    return { note: 'unserializable' }
  }
}

export function txObjectLabel(row: {
  id: string
  contactName?: string | null
  amount?: number
  direction?: string
}): string {
  const id = shortFinanceId(row.id)
  if (row.amount != null && Number.isFinite(row.amount)) {
    return `${id} · ₹${Number(row.amount).toLocaleString('en-IN')}`
  }
  return id
}

export async function logFinanceAudit(opts: {
  actor: FinanceAuditActor
  action: FinanceAuditAction
  entityType: FinanceAuditEntity
  entityId?: string | null
  /** What was touched — shown in the Audit “Object” column. */
  objectLabel: string
  objectHref?: string | null
  summary: string
  before?: unknown
  after?: unknown
  tx?: Prisma.TransactionClient
}): Promise<void> {
  const client = opts.tx ?? prisma
  await client.financeAuditLog.create({
    data: {
      actorEmail: opts.actor.actorEmail,
      actorUserId: opts.actor.actorUserId ?? null,
      action: opts.action,
      entityType: opts.entityType,
      entityId: opts.entityId ?? null,
      objectLabel: opts.objectLabel.slice(0, 200),
      objectHref: opts.objectHref ?? null,
      summary: opts.summary.slice(0, 500),
      before: toJson(opts.before) ?? undefined,
      after: toJson(opts.after) ?? undefined,
    },
  })
}
