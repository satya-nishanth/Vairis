import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { PageShell } from '@/components/layout/PageShell'
import { CartModalProvider } from '@/components/commerce/CartModal'
import { ProductCard } from '@/components/commerce/ProductCard'
import { prismaToProduct } from '@/lib/prisma-to-product'
import { getPricingConfig, getShowPricesGlobal } from '@/lib/pricing-data'
import { SLUG_TO_PRISMA, type PrismaCategory } from '@/lib/categories'
import { sortProductsByPriority } from '@/lib/product-priorities'
import { pageLayouts } from '@/lib/layout-config'
import { SearchBar } from './SearchBar'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams: Promise<{ q?: string }>
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { q } = await searchParams
  const query = (q ?? '').trim()
  return {
    title: query ? `Search: "${query}" | VAIRIS` : 'Search Fine Jewellery | VAIRIS',
    description: query
      ? `Explore fine jewellery pieces matching "${query}" at VAIRIS — minimal diamond jewellery crafted for everyday elegance.`
      : 'Search our curated collection of everyday fine diamond jewellery.',
  }
}

export default async function SearchPage({ searchParams }: PageProps) {
  const { q } = await searchParams
  const query = (q ?? '').trim()

  let products: ReturnType<typeof prismaToProduct>[] = []

  if (query.length >= 2) {
    const qLower = query.toLowerCase()

    // Match category enum by query keywords
    const matchingCategories: PrismaCategory[] = []
    for (const [slug, prismaCat] of Object.entries(SLUG_TO_PRISMA)) {
      const singular = slug.replace(/s$/, '')
      if (slug.includes(qLower) || qLower.includes(slug) || qLower.includes(singular)) {
        matchingCategories.push(prismaCat)
      }
    }

    // Match products tagged with a filter label (e.g. "Studs", "Solitaire", "Office")
    const taggedProducts = await prisma.productTag
      .findMany({
        where: { value: { contains: query, mode: 'insensitive' } },
        select: { productId: true },
      })
      .catch(() => [])
    const matchedProductIdsFromLabels = new Set(taggedProducts.map((t) => t.productId))

    const orConditions: any[] = [
      { name: { contains: query, mode: 'insensitive' } },
      { itemCode: { contains: query, mode: 'insensitive' } },
      { designStyle: { contains: query, mode: 'insensitive' } },
      { description: { contains: query, mode: 'insensitive' } },
    ]

    if (matchingCategories.length > 0) {
      orConditions.push({ category: { in: matchingCategories } })
    }
    if (matchedProductIdsFromLabels.size > 0) {
      orConditions.push({ id: { in: Array.from(matchedProductIdsFromLabels) } })
    }

    try {
      const [dbProducts, goldRates, pricingConfig, showPricesGlobal] = await Promise.all([
        prisma.product.findMany({
          where: {
            isActive: true,
            status: 'LIVE',
            OR: orConditions,
          },
          include: {
            variants: true,
            stones: { include: { diamondRate: true }, orderBy: { sortOrder: 'asc' } },
          },
          orderBy: { name: 'asc' },
        }),
        prisma.goldRate.findMany(),
        getPricingConfig(),
        getShowPricesGlobal(),
      ])

      const sorted = sortProductsByPriority(dbProducts)
      products = sorted.map((p) => prismaToProduct(p, goldRates, pricingConfig, showPricesGlobal))
    } catch (err) {
      console.error('[search] query failed:', err)
      products = []
    }
  }

  const categoryChips = [
    { label: 'Rings', href: '/all-products/rings' },
    { label: 'Earrings', href: '/all-products/earrings' },
    { label: 'Pendants', href: '/all-products/pendants' },
    { label: 'Bracelets', href: '/all-products/bracelets' },
    { label: 'Necklaces', href: '/all-products/necklaces' },
  ]

  return (
    <CartModalProvider>
      <PageShell
        {...pageLayouts.plp}
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Search' },
        ]}
      >
        <main className="container page-main" style={{ padding: '36px 16px 80px', maxWidth: 1240, margin: '0 auto' }}>
          {/* Header & Search Bar */}
          <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto 40px' }}>
            <h1
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 'clamp(1.75rem, 3vw, 2.5rem)',
                fontWeight: 600,
                color: 'var(--color-text, #111827)',
                margin: '0 0 10px',
              }}
            >
              {query ? `Search Results` : `Search Our Collection`}
            </h1>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted, #6b7280)', margin: '0 0 24px' }}>
              {query
                ? `Showing ${products.length} piece${products.length === 1 ? '' : 's'} matching "${query}"`
                : 'Explore minimal fine diamond jewellery designed for everyday wear.'}
            </p>

            <SearchBar initialQuery={query} />
          </div>

          {/* Results Grid */}
          {products.length > 0 ? (
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '20px',
                  paddingBottom: '12px',
                  borderBottom: '1px solid var(--color-border-light, #f3f4f6)',
                }}
              >
                <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted, #6b7280)' }}>
                  {products.length} {products.length === 1 ? 'piece' : 'pieces'} found
                </span>
                <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted, #6b7280)' }}>
                  Sorted by priority
                </span>
              </div>

              <div className="plp-grid">
                {products.map((p, i) => (
                  <ProductCard key={p.catalogueId || p.slug} product={p} showActions={i < 4} />
                ))}
              </div>
            </div>
          ) : query ? (
            /* Empty State for Query */
            <div
              style={{
                textAlign: 'center',
                padding: '48px 20px',
                background: 'var(--bg-card, #ffffff)',
                borderRadius: '12px',
                border: '1px solid var(--color-border-light, #e5e7eb)',
                maxWidth: '600px',
                margin: '0 auto',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              }}
            >
              <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🔍</div>
              <h2
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '1.375rem',
                  fontWeight: 600,
                  color: 'var(--color-text, #111827)',
                  margin: '0 0 8px',
                }}
              >
                No pieces match &ldquo;{query}&rdquo;
              </h2>
              <p
                style={{
                  fontSize: '0.875rem',
                  color: 'var(--color-text-muted, #6b7280)',
                  margin: '0 0 24px',
                  lineHeight: 1.5,
                }}
              >
                Try searching for specific styles (e.g. Solitaire, Studs, Everyday), check your spelling, or explore our categories below.
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '8px' }}>
                {categoryChips.map((c) => (
                  <Link
                    key={c.href}
                    href={c.href}
                    style={{
                      padding: '7px 16px',
                      borderRadius: '20px',
                      fontSize: '0.8125rem',
                      fontWeight: 500,
                      background: 'var(--color-surface, #f9fafb)',
                      color: 'var(--color-text, #374151)',
                      border: '1px solid var(--color-border, #d1d5db)',
                      textDecoration: 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    Shop {c.label} →
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            /* Default Browse State when query is empty */
            <div
              style={{
                textAlign: 'center',
                padding: '36px 20px',
                maxWidth: '680px',
                margin: '0 auto',
              }}
            >
              <p style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted, #6b7280)', marginBottom: '16px' }}>
                Explore by Category
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '10px' }}>
                {categoryChips.map((c) => (
                  <Link
                    key={c.href}
                    href={c.href}
                    style={{
                      padding: '10px 20px',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      background: 'var(--bg-card, #ffffff)',
                      color: 'var(--color-text, #111827)',
                      border: '1px solid var(--color-border, #d1d5db)',
                      textDecoration: 'none',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                    }}
                  >
                    {c.label} →
                  </Link>
                ))}
              </div>
            </div>
          )}
        </main>
      </PageShell>
    </CartModalProvider>
  )
}
