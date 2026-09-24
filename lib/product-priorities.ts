import fs from 'fs'
import path from 'path'

const PRIORITIES_FILE = path.join(process.cwd(), 'data', 'product-priorities.json')

// In-memory cache
let prioritiesCache: Record<string, number> | null = null

function loadPrioritiesFromFile(): Record<string, number> {
  try {
    if (fs.existsSync(PRIORITIES_FILE)) {
      const raw = fs.readFileSync(PRIORITIES_FILE, 'utf-8')
      return JSON.parse(raw)
    }
  } catch (err) {
    console.warn('[product-priorities] error reading product-priorities.json:', err)
  }
  return {}
}

export function getAllProductPriorities(): Record<string, number> {
  if (!prioritiesCache) {
    prioritiesCache = loadPrioritiesFromFile()
  }
  return prioritiesCache
}

export function getProductPriority(productId: string, dbPriority?: number | null): number {
  const map = getAllProductPriorities()
  if (map[productId] !== undefined) {
    return map[productId]
  }
  if (typeof dbPriority === 'number') {
    return dbPriority
  }
  return 0
}

export function setProductPriority(productId: string, priority: number): void {
  const map = getAllProductPriorities()
  map[productId] = priority
  prioritiesCache = { ...map }

  try {
    const dir = path.dirname(PRIORITIES_FILE)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(PRIORITIES_FILE, JSON.stringify(map, null, 2), 'utf-8')
  } catch (err) {
    console.warn('[product-priorities] error writing product-priorities.json:', err)
  }
}

/**
 * Sorts products so that priority 0 comes first (0, 1, 2...),
 * and secondary sort is alphabetical by product name.
 */
export function sortProductsByPriority<T extends { id: string; name: string; priority?: number | null }>(
  products: T[]
): T[] {
  const map = getAllProductPriorities()
  return [...products].sort((a, b) => {
    const priA = map[a.id] !== undefined ? map[a.id] : (a.priority ?? 0)
    const priB = map[b.id] !== undefined ? map[b.id] : (b.priority ?? 0)
    if (priA !== priB) {
      return priA - priB
    }
    return a.name.localeCompare(b.name)
  })
}
