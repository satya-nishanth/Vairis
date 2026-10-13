import type { MetalColor, MetalType, Prisma } from '@prisma/client'
import { buildMetalSku, normalizeMetalColor } from '@/lib/metal'

export type PieceVariantInput = {
  metalType: MetalType
  metalColor?: MetalColor | string | null
  weightGrams: number
  makingChargePerGram: number
  flatMakingCharge: number
  stoneCharges: number
  miscCharges: number
  stock: number
  sku: string
  size?: string | null
}

export type PieceStoneInput = {
  diamondRateId: string
  caratWeight: number
  count: number | null
  label?: string | null
  ratePerCarat: number | null
  ratePerCaratExchange: number | null
}

export type PieceInput = {
  id?: string | null
  name: string
  vaGoldPct: number | null
  vaLabel: string | null
  variants: PieceVariantInput[]
  stones: PieceStoneInput[]
}

/** Accept either `pieces[]` or legacy flat variants/stones (+ product VA). */
export function normalizePiecesFromBody(data: {
  pieces?: PieceInput[] | null
  variants?: PieceVariantInput[]
  stones?: PieceStoneInput[]
  vaGoldPct?: number | null
  vaLabel?: string | null
}): PieceInput[] {
  if (data.pieces && data.pieces.length > 0) {
    return data.pieces.map((p, i) => ({
      id: p.id || null,
      name: (p.name || '').trim() || (i === 0 ? 'Main' : `Piece ${i + 1}`),
      vaGoldPct: p.vaGoldPct ?? null,
      vaLabel: p.vaLabel?.trim() ? p.vaLabel.trim() : null,
      variants: p.variants ?? [],
      stones: p.stones ?? [],
    }))
  }
  return [
    {
      id: null,
      name: 'Main',
      vaGoldPct: data.vaGoldPct ?? null,
      vaLabel: data.vaLabel ?? null,
      variants: data.variants ?? [],
      stones: data.stones ?? [],
    },
  ]
}

export function flattenPieceVariants(pieces: PieceInput[]): PieceVariantInput[] {
  return pieces.flatMap((p) => p.variants)
}

type Tx = Prisma.TransactionClient

/** Create pieces + nested variants/stones for a new product. */
export async function createProductPieces(
  tx: Tx,
  productId: string,
  pieces: PieceInput[],
) {
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i]
    const piece = await tx.productPiece.create({
      data: {
        productId,
        name: p.name,
        sortOrder: i,
        vaGoldPct: p.vaGoldPct,
        vaLabel: p.vaLabel,
      },
    })
    if (p.variants.length) {
      await tx.productVariant.createMany({
        data: p.variants.map((v) => ({
          productId,
          pieceId: piece.id,
          metalType: v.metalType,
          metalColor: normalizeMetalColor(v.metalColor),
          weightGrams: v.weightGrams,
          makingChargePerGram: v.makingChargePerGram,
          flatMakingCharge: v.flatMakingCharge,
          stoneCharges: v.stoneCharges,
          miscCharges: v.miscCharges,
          stock: v.stock,
          sku: v.sku,
          size: v.size || null,
        })),
      })
    }
    if (p.stones.length) {
      await tx.productStone.createMany({
        data: p.stones.map((s, si) => ({
          productId,
          pieceId: piece.id,
          diamondRateId: s.diamondRateId,
          caratWeight: s.caratWeight,
          count: s.count,
          label: s.label || null,
          ratePerCarat: s.ratePerCarat,
          ratePerCaratExchange: s.ratePerCaratExchange,
          sortOrder: si,
        })),
      })
    }
  }
}

/**
 * Replace pieces for an existing product. Variants matched by piece+purity+color+size
 * (SKU alone is unsafe for sets — necklace/earrings often shared the same SKU).
 * Stones replaced wholesale. Pieces not in payload are removed when safe.
 */
export async function syncProductPieces(tx: Tx, productId: string, pieces: PieceInput[]) {
  const existingPieces = await tx.productPiece.findMany({ where: { productId } })
  const existingVariants = await tx.productVariant.findMany({ where: { productId } })
  const bySku = new Map(existingVariants.map((v) => [v.sku, v]))
  const keepVariantIds = new Set<string>()
  const keepPieceIds = new Set<string>()
  const claimedSkus = new Set<string>()

  await tx.productStone.deleteMany({ where: { productId } })

  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i]
    let pieceId = p.id && existingPieces.some((ep) => ep.id === p.id) ? p.id : null

    if (pieceId) {
      await tx.productPiece.update({
        where: { id: pieceId },
        data: {
          name: p.name,
          sortOrder: i,
          vaGoldPct: p.vaGoldPct,
          vaLabel: p.vaLabel,
        },
      })
    } else {
      const created = await tx.productPiece.create({
        data: {
          productId,
          name: p.name,
          sortOrder: i,
          vaGoldPct: p.vaGoldPct,
          vaLabel: p.vaLabel,
        },
      })
      pieceId = created.id
    }
    keepPieceIds.add(pieceId)

    const pieceSlug =
      `${
        p.name
          .trim()
          .toUpperCase()
          .replace(/[^A-Z0-9]+/g, '')
          .slice(0, 5) || 'P'
      }${i + 1}`

    for (const v of p.variants) {
      const sizeKey = v.size || null
      const color = normalizeMetalColor(v.metalColor)
      // Prefer same piece + purity + color + size (preserves both weights in a set)
      let found =
        existingVariants.find(
          (ev) =>
            !keepVariantIds.has(ev.id) &&
            ev.pieceId === pieceId &&
            ev.metalType === v.metalType &&
            ev.metalColor === color &&
            (ev.size || null) === sizeKey,
        ) ?? null

      if (!found) {
        const bySkuHit = bySku.get(v.sku)
        // Reuse SKU match only if unclaimed and not already owned by another piece
        if (
          bySkuHit &&
          !keepVariantIds.has(bySkuHit.id) &&
          (!bySkuHit.pieceId || bySkuHit.pieceId === pieceId)
        ) {
          found = bySkuHit
        }
      }

      if (!found && pieces.length > 1) {
        // Legacy single-SKU set: reclaim unassigned / first unclaimed metal match
        found =
          existingVariants.find(
            (ev) =>
              !keepVariantIds.has(ev.id) &&
              ev.metalType === v.metalType &&
              ev.metalColor === color &&
              (ev.size || null) === sizeKey &&
              (!ev.pieceId || ev.pieceId === pieceId),
          ) ?? null
      }

      let sku = (v.sku || '').trim()
      if (!sku) {
        sku = buildMetalSku(pieceSlug, v.metalType, color, sizeKey)
      }
      // Guarantee uniqueness across pieces kept in this sync
      if (claimedSkus.has(sku) || (bySku.has(sku) && bySku.get(sku)!.id !== found?.id && keepVariantIds.has(bySku.get(sku)!.id))) {
        let n = 2
        let candidate = `${sku}-${pieceSlug}`
        while (
          claimedSkus.has(candidate) ||
          (bySku.has(candidate) && bySku.get(candidate)!.id !== found?.id && keepVariantIds.has(bySku.get(candidate)!.id))
        ) {
          candidate = `${sku}-${pieceSlug}${n}`
          n++
        }
        sku = candidate
      }

      const fields = {
        metalType: v.metalType,
        metalColor: color,
        weightGrams: v.weightGrams,
        makingChargePerGram: v.makingChargePerGram,
        flatMakingCharge: v.flatMakingCharge,
        stoneCharges: v.stoneCharges,
        miscCharges: v.miscCharges,
        stock: v.stock,
        size: sizeKey,
        pieceId,
        sku,
      }

      if (found) {
        await tx.productVariant.update({ where: { id: found.id }, data: fields })
        keepVariantIds.add(found.id)
        bySku.set(sku, found)
      } else {
        const created = await tx.productVariant.create({
          data: { productId, ...fields },
        })
        keepVariantIds.add(created.id)
        bySku.set(sku, created)
      }
      claimedSkus.add(sku)
    }

    if (p.stones.length) {
      await tx.productStone.createMany({
        data: p.stones.map((s, si) => ({
          productId,
          pieceId,
          diamondRateId: s.diamondRateId,
          caratWeight: s.caratWeight,
          count: s.count,
          label: s.label || null,
          ratePerCarat: s.ratePerCarat,
          ratePerCaratExchange: s.ratePerCaratExchange,
          sortOrder: si,
        })),
      })
    }
  }

  const toRemoveVariants = existingVariants.filter((v) => !keepVariantIds.has(v.id))
  if (toRemoveVariants.length) {
    const removeIds = toRemoveVariants.map((v) => v.id)
    const orderRefs = await tx.orderItem.count({ where: { variantId: { in: removeIds } } })
    if (orderRefs > 0) {
      throw new Error(
        'Cannot remove a variant that appears on past orders. Keep the SKU or contact support.',
      )
    }
    await tx.cartItem.deleteMany({ where: { variantId: { in: removeIds } } })
    await tx.productVariant.deleteMany({ where: { id: { in: removeIds } } })
  }

  const toRemovePieces = existingPieces.filter((p) => !keepPieceIds.has(p.id))
  if (toRemovePieces.length) {
    await tx.productPiece.deleteMany({ where: { id: { in: toRemovePieces.map((p) => p.id) } } })
  }

  // Mirror first piece VA onto product for legacy readers
  const first = pieces[0]
  await tx.product.update({
    where: { id: productId },
    data: {
      vaGoldPct: first?.vaGoldPct ?? null,
      vaLabel: first?.vaLabel ?? null,
    },
  })
}
