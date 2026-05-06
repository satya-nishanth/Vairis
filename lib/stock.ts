import { prisma } from './prisma'

type StockItem = { variantId: string; quantity: number }

export async function decrementStock(items: StockItem[]) {
  const ids = items.map((i) => i.variantId)
  const variants = await prisma.productVariant.findMany({ where: { id: { in: ids } } })

  for (const item of items) {
    const variant = variants.find((v) => v.id === item.variantId)
    if (!variant || variant.stock < item.quantity) {
      throw new Error(`Insufficient stock for variant ${item.variantId}`)
    }
  }

  await prisma.$transaction(
    items.map((item) =>
      prisma.productVariant.update({
        where: { id: item.variantId },
        data: { stock: { decrement: item.quantity } },
      })
    )
  )
}

export async function restoreStock(items: StockItem[]) {
  await prisma.$transaction(
    items.map((item) =>
      prisma.productVariant.update({
        where: { id: item.variantId },
        data: { stock: { increment: item.quantity } },
      })
    )
  )
}
