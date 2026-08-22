import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function createPrisma() {
  return new PrismaClient({ log: process.env.NODE_ENV === 'development' ? ['error'] : [] })
}

function isCurrentClient(client: PrismaClient | undefined): client is PrismaClient {
  // After `prisma generate` adds models, a long-lived global client can miss
  // new delegates (e.g. invoice) until the process restarts.
  return !!client && typeof (client as PrismaClient & { invoice?: { findMany?: unknown } }).invoice?.findMany === 'function'
}

export const prisma = isCurrentClient(globalForPrisma.prisma) ? globalForPrisma.prisma : createPrisma()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
