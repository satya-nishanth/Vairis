import { Prisma, QuotationStatus } from '@prisma/client'
import { createHash, randomBytes } from 'crypto'

/** Admin/bot-driven quotation transitions. CONVERTED and CANCELLED are terminal. */
export const QUOTATION_TRANSITIONS: Partial<Record<QuotationStatus, QuotationStatus[]>> = {
  REQUESTED: ['QUOTED', 'CANCELLED'],
  QUOTED: ['CONVERTED', 'CANCELLED'],
}

function slugPart(v: string | null | undefined, fallback: string, max = 12): string {
  if (!v) return fallback
  const slug = v.trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
  return slug.slice(0, max) || fallback
}

/**
 * Seed string per the source spec (username_mobile_productId collides too often since phone is
 * frequently missing) — not stored, just entropy for the short displayId suffix below.
 */
function buildDisplayIdSeed(input: {
  customerName?: string | null
  customerMobile?: string | null
  sku?: string | null
}): string {
  const slugName = slugPart(input.customerName, 'anon')
  const last10phone = input.customerMobile
    ? input.customerMobile.replace(/\D/g, '').slice(-10) || 'nophone'
    : 'nophone'
  const sku = slugPart(input.sku, 'nosku')
  return `q_${slugName}_${last10phone}_${sku}_${randomBytes(4).toString('hex')}`
}

/** Short display id shown in the UI and Discord thread names, e.g. "Q-7K2M". */
export function generateQuotationDisplayId(input: {
  customerName?: string | null
  customerMobile?: string | null
  sku?: string | null
}): string {
  const seed = buildDisplayIdSeed(input)
  const digest = createHash('sha1').update(seed).digest()
  const suffix = digest.readUInt32BE(0).toString(36).toUpperCase().padStart(4, '0').slice(-4)
  return `Q-${suffix}`
}

/**
 * displayId has ~1.6M possible values (36^4) — collisions are rare but not impossible under
 * concurrent creation. Retries with a fresh seed on a unique constraint violation rather than
 * trusting a single generated id.
 */
export async function createWithUniqueDisplayId<T>(
  seedInput: { customerName?: string | null; customerMobile?: string | null; sku?: string | null },
  create: (displayId: string) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const displayId = generateQuotationDisplayId(seedInput)
    try {
      return await create(displayId)
    } catch (err) {
      const isUniqueViolation =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
      if (isUniqueViolation && attempt < 4) continue
      throw err
    }
  }
  throw new Error('unreachable')
}
