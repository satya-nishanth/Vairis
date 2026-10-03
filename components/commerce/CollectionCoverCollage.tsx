import { ProductImage } from '@/components/ui/ProductImage'

/** Max tiles in a collection cover collage. */
export const COLLECTION_COLLAGE_MAX = 4

type Props = {
  images: string[]
  alt: string
  className?: string
}

/**
 * Dynamic cover collage from product front images.
 * Layout: 1 full · 2 side-by-side · 3 (1 large + 2 stack) · 4 (2×2).
 */
export function CollectionCoverCollage({ images, alt, className }: Props) {
  const tiles = images.filter(Boolean).slice(0, COLLECTION_COLLAGE_MAX)
  if (tiles.length === 0) {
    return (
      <div
        className={className}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-text-muted)',
          fontSize: '0.875rem',
          background: 'var(--color-surface-muted, #f8f8f8)',
        }}
      >
        VAIRIS Collection
      </div>
    )
  }

  if (tiles.length === 1) {
    return (
      <div className={className} style={{ position: 'relative', width: '100%', height: '100%' }}>
        <ProductImage src={tiles[0]} alt={alt} fill style={{ objectFit: 'cover' }} />
      </div>
    )
  }

  if (tiles.length === 2) {
    return (
      <div
        className={className}
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 2,
          width: '100%',
          height: '100%',
        }}
      >
        {tiles.map((src, i) => (
          <div key={`${src}-${i}`} style={{ position: 'relative', minHeight: 0 }}>
            <ProductImage src={src} alt={`${alt} ${i + 1}`} fill style={{ objectFit: 'cover' }} />
          </div>
        ))}
      </div>
    )
  }

  if (tiles.length === 3) {
    return (
      <div
        className={className}
        style={{
          display: 'grid',
          gridTemplateColumns: '1.2fr 1fr',
          gridTemplateRows: '1fr 1fr',
          gap: 2,
          width: '100%',
          height: '100%',
        }}
      >
        <div style={{ position: 'relative', gridRow: '1 / -1', minHeight: 0 }}>
          <ProductImage src={tiles[0]} alt={`${alt} 1`} fill style={{ objectFit: 'cover' }} />
        </div>
        <div style={{ position: 'relative', minHeight: 0 }}>
          <ProductImage src={tiles[1]} alt={`${alt} 2`} fill style={{ objectFit: 'cover' }} />
        </div>
        <div style={{ position: 'relative', minHeight: 0 }}>
          <ProductImage src={tiles[2]} alt={`${alt} 3`} fill style={{ objectFit: 'cover' }} />
        </div>
      </div>
    )
  }

  return (
    <div
      className={className}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: '1fr 1fr',
        gap: 2,
        width: '100%',
        height: '100%',
      }}
    >
      {tiles.map((src, i) => (
        <div key={`${src}-${i}`} style={{ position: 'relative', minHeight: 0 }}>
          <ProductImage src={src} alt={`${alt} ${i + 1}`} fill style={{ objectFit: 'cover' }} />
        </div>
      ))}
    </div>
  )
}

/** Front image of a product (images[0]), if present. */
export function productFrontImage(images: string[] | null | undefined): string | null {
  const front = images?.find((src) => Boolean(src))
  return front ?? null
}

/** Up to N front images from ordered collection products. */
export function collectionCollageImages(
  products: { images: string[] }[],
  max = COLLECTION_COLLAGE_MAX,
): string[] {
  const out: string[] = []
  for (const p of products) {
    const front = productFrontImage(p.images)
    if (front) out.push(front)
    if (out.length >= max) break
  }
  return out
}
