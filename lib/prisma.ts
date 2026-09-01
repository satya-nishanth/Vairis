import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

/** Models added after a long-lived dev server starts — keep in sync with schema. */
const REQUIRED_DELEGATES = ['invoice', 'inventoryHolder', 'inventoryAuditLog'] as const

function createPrisma() {
  return new PrismaClient({ log: process.env.NODE_ENV === 'development' ? ['error'] : [] })
}

function isCurrentClient(client: PrismaClient | undefined): client is PrismaClient {
  if (!client) return false
  const c = client as PrismaClient & Record<string, { findMany?: unknown; create?: unknown } | undefined>
  return REQUIRED_DELEGATES.every((name) => {
    const delegate = c[name]
    return typeof delegate?.findMany === 'function' || typeof delegate?.create === 'function'
  })
}

function getPrisma(): PrismaClient {
  if (!isCurrentClient(globalForPrisma.prisma)) {
    globalForPrisma.prisma = createPrisma()
  }
  return globalForPrisma.prisma
}

export const prisma = getPrisma()
