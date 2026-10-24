/**
 * Sorts products so that priority 0 comes first (0, 1, 2...),
 * and secondary sort is alphabetical by product name.
 * Priority lives in Product.priority (admin product form).
 */
export function sortProductsByPriority<T extends { name: string; priority?: number | null }>(
  products: T[]
): T[] {
  return [...products].sort((a, b) => {
    const priA = a.priority ?? 0
    const priB = b.priority ?? 0
    if (priA !== priB) {
      return priA - priB
    }
    return a.name.localeCompare(b.name)
  })
}
