'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  IconHeart,
  IconDislike,
  IconExternalLink,
  IconSkipToStart,
} from '@/components/catalogue/CatalogueIcons'
import type { CatalogueProduct } from '@/lib/catalogue-feed'
import { toFlatIndex, totalMediaCount } from '@/lib/catalogue-feed'
import { mediaOrigin, prefetchCatalogueMedia } from '@/lib/catalogue-prefetch'
import InlineComment from './InlineComment'
import ProductMediaCarousel from './ProductMediaCarousel'

type Props = {
  products: CatalogueProduct[]
  startProductIndex: number
  startMediaIndex: number
  startFlatIndex: number
  guestUsername: string
}

const CATEGORY_LABELS: Record<string, string> = {
  RINGS: 'Rings',
  EARRINGS: 'Earrings',
  PENDANTS: 'Pendants',
  BRACELETS: 'Bracelets',
}

function useDebounce<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

function formatCount(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

export default function CatalogueReel({
  products,
  startProductIndex,
  startMediaIndex,
  startFlatIndex,
  guestUsername,
}: Props) {
  const router = useRouter()
  const [currentProduct, setCurrentProduct] = useState(startProductIndex)
  const [mediaByProduct, setMediaByProduct] = useState<Record<number, number>>(() => ({
    [startProductIndex]: startMediaIndex,
  }))
  const [likes, setLikes] = useState<Record<string, number>>(() =>
    Object.fromEntries(products.map((p) => [p.productId, p.likes]))
  )
  const [dislikes, setDislikes] = useState<Record<string, number>>(() =>
    Object.fromEntries(products.map((p) => [p.productId, p.dislikes]))
  )
  const [myReactions, setMyReactions] = useState<Record<string, 'like' | 'dislike' | null>>(() =>
    Object.fromEntries(products.map((p) => [p.productId, p.myReaction]))
  )
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(products.map((p) => [p.productId, p.commentCount]))
  )
  const [engagementDone, setEngagementDone] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      products.map((p, i) => [p.productId, i < startProductIndex || !!p.myReaction])
    )
  )

  const containerRef = useRef<HTMLDivElement>(null)
  const preconnectDone = useRef(false)
  const slideRefs = useRef<(HTMLDivElement | null)[]>([])
  const maxViewedRef = useRef(startFlatIndex > 0 ? startFlatIndex - 1 : -1)
  const currentFlatRef = useRef(0)
  const lockedProductRef = useRef(startProductIndex)
  const currentProductRef = useRef(startProductIndex)
  const autoScrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const saveProgress = useCallback((frameIndex: number) => {
    fetch('/api/catalogue/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lastFrameIndex: frameIndex }),
      keepalive: true,
    }).catch((err) => {
      console.error('[CatalogueReel] saveProgress failed', frameIndex, err)
    })
  }, [])

  const flushProgress = useCallback(() => {
    const idx = Math.max(maxViewedRef.current, currentFlatRef.current)
    maxViewedRef.current = idx
    saveProgress(idx)
  }, [saveProgress])

  const currentMedia = mediaByProduct[currentProduct] ?? 0
  const currentFlat = toFlatIndex(products, currentProduct, currentMedia)
  currentFlatRef.current = currentFlat
  const debouncedFlat = useDebounce(currentFlat, 400)

  const totalMedia = totalMediaCount(products)
  const activeProductId = products[currentProduct]?.productId
  const canAdvance = activeProductId ? (engagementDone[activeProductId] ?? false) : true

  lockedProductRef.current = canAdvance ? currentProduct : lockedProductRef.current
  currentProductRef.current = currentProduct

  const scrollToProduct = useCallback((idx: number, mediaIdx = 0) => {
    const el = slideRefs.current[idx]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setCurrentProduct(idx)
    setMediaByProduct((s) => ({ ...s, [idx]: mediaIdx }))
  }, [])

  useEffect(() => {
    const el = slideRefs.current[startProductIndex]
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' })
    setCurrentProduct(startProductIndex)
    setMediaByProduct((s) => ({ ...s, [startProductIndex]: startMediaIndex }))
  }, [startProductIndex, startMediaIndex])

  useEffect(() => {
    if (preconnectDone.current || !products[0]?.media[0]?.url) return
    const origin = mediaOrigin(products[0].media[0].url)
    if (!origin) return
    preconnectDone.current = true
    const link = document.createElement('link')
    link.rel = 'preconnect'
    link.href = origin
    link.crossOrigin = 'anonymous'
    document.head.appendChild(link)
  }, [products])

  // Prefetch next 3 products (all their media) so scroll feels instant
  useEffect(() => {
    const indices = Array.from({ length: 5 }, (_, k) => currentProduct - 1 + k)
      .filter((i) => i >= 0 && i < products.length)
    for (const i of indices) {
      for (const item of products[i].media) {
        prefetchCatalogueMedia(item.url, item.isVideo)
      }
    }
  }, [currentProduct, products])

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          const idx = Number(e.target.getAttribute('data-product-idx'))
          if (isNaN(idx)) continue

          const leaving = lockedProductRef.current
          const leavingId = products[leaving]?.productId
          const leavingDone = leavingId ? (engagementDone[leavingId] ?? false) : true

          if (idx > leaving && !leavingDone) {
            slideRefs.current[leaving]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            return
          }
          setCurrentProduct(idx)
        }
      },
      { threshold: 0.6 }
    )
    slideRefs.current.forEach((el) => el && obs.observe(el))
    return () => obs.disconnect()
  }, [products, engagementDone])

  useEffect(() => {
    const el = containerRef.current
    if (!el || canAdvance) return

    const onScroll = () => {
      const h = el.clientHeight || window.innerHeight
      const maxTop = currentProduct * h + h * 0.15
      if (el.scrollTop > maxTop) {
        el.scrollTo({ top: currentProduct * h, behavior: 'smooth' })
      }
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [canAdvance, currentProduct])

  useEffect(() => {
    if (products.length === 0) return
    maxViewedRef.current = Math.max(maxViewedRef.current, debouncedFlat)
    saveProgress(maxViewedRef.current)
  }, [debouncedFlat, products.length, saveProgress])

  useEffect(() => {
    const onHide = () => flushProgress()
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushProgress()
    }
    window.addEventListener('pagehide', onHide)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', onHide)
      document.removeEventListener('visibilitychange', onVisibility)
      if (autoScrollTimer.current) clearTimeout(autoScrollTimer.current)
    }
  }, [flushProgress])

  const onMediaChange = useCallback((productIdx: number, mediaIdx: number) => {
    setMediaByProduct((s) => ({ ...s, [productIdx]: mediaIdx }))
  }, [])

  const goToFirst = useCallback(async () => {
    try {
      const res = await fetch('/api/catalogue/progress', { method: 'DELETE' })
      if (!res.ok) throw new Error(`status ${res.status}`)
      maxViewedRef.current = -1
      scrollToProduct(0, 0)
    } catch (err) {
      console.error('[CatalogueReel] goToFirst failed', err)
    }
  }, [scrollToProduct])

  const logout = useCallback(async () => {
    flushProgress()
    try {
      const res = await fetch('/api/catalogue/logout', { method: 'POST' })
      if (!res.ok) throw new Error(`status ${res.status}`)
      router.replace('/catalogue/login')
    } catch (err) {
      console.error('[CatalogueReel] logout failed', err)
    }
  }, [flushProgress, router])

  const progressPct = totalMedia > 0 ? ((currentFlat + 1) / totalMedia) * 100 : 0

  const react = useCallback(
    async (productId: string, reaction: 'like' | 'dislike') => {
      const prev = myReactions[productId]
      const next = prev === reaction ? null : reaction
      setMyReactions((s) => ({ ...s, [productId]: next }))

      // Like or un-tap → done immediately, auto-advance after brief pause
      // Dislike → show optional comment gate (auto-advance after comment/skip)
      const isDone = next !== 'dislike'
      setEngagementDone((s) => ({ ...s, [productId]: isDone }))
      if (isDone && next === 'like') {
        autoScrollTimer.current = setTimeout(() => {
          const nextIdx = currentProductRef.current + 1
          if (nextIdx < products.length) scrollToProduct(nextIdx)
        }, 500)
      }

      const bump = (field: 'likes' | 'dislikes', delta: number) => {
        const setter = field === 'likes' ? setLikes : setDislikes
        setter((s) => ({
          ...s,
          [productId]: Math.max(0, (s[productId] ?? 0) + delta),
        }))
      }

      if (prev === 'like') bump('likes', -1)
      if (prev === 'dislike') bump('dislikes', -1)
      if (next === 'like') bump('likes', 1)
      if (next === 'dislike') bump('dislikes', 1)

      try {
        const res = await fetch('/api/catalogue/reaction', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId, reaction: next }),
        })
        if (!res.ok) throw new Error(`status ${res.status}`)
      } catch (err) {
        console.error('[CatalogueReel] reaction failed', productId, err)
        if (autoScrollTimer.current) { clearTimeout(autoScrollTimer.current); autoScrollTimer.current = null }
        // rollback optimistic update
        setMyReactions((s) => ({ ...s, [productId]: prev ?? null }))
        if (next === 'like') bump('likes', -1)
        if (next === 'dislike') bump('dislikes', -1)
        if (prev === 'like') bump('likes', 1)
        if (prev === 'dislike') bump('dislikes', 1)
      }
    },
    [myReactions, products.length, scrollToProduct]
  )

  const completeEngagement = useCallback(
    (productId: string) => {
      setEngagementDone((s) => ({ ...s, [productId]: true }))
      flushProgress()
      setTimeout(() => {
        const nextIdx = currentProductRef.current + 1
        if (nextIdx < products.length) scrollToProduct(nextIdx)
      }, 350)
    },
    [flushProgress, products.length, scrollToProduct]
  )

  const onCommentPosted = useCallback((productId: string) => {
    setCommentCounts((s) => ({ ...s, [productId]: (s[productId] ?? 0) + 1 }))
  }, [])

  if (!products.length) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white/40">
        No catalogue items yet.
      </div>
    )
  }

  const active = products[currentProduct]

  return (
    <div className="relative">
      <div className="fixed top-0 left-0 right-0 z-40 h-0.5 bg-white/10">
        <div
          className="h-full bg-gradient-to-r from-brand-gold/80 to-brand-gold transition-all duration-300 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between gap-3 px-4 pt-3 pb-8 bg-gradient-to-b from-black/90 via-black/50 to-transparent">
        <Link href="/" className="pointer-events-auto shrink-0">
          <img src="/images/vairius_logo.png" alt="VAIRIS" className="h-7 opacity-95" />
        </Link>
        <div className="flex items-center gap-2 pointer-events-auto">
          {currentProduct > 0 && (
            <button
              type="button"
              onClick={goToFirst}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-white/90 text-[11px] font-medium tracking-wide hover:bg-brand-gold/20 hover:border-brand-gold/40 hover:text-brand-gold transition"
            >
              <IconSkipToStart className="w-4 h-4" />
              <span>1st item</span>
            </button>
          )}
          <span className="text-white/45 text-xs truncate max-w-[100px]">@{guestUsername}</span>
          <button
            type="button"
            onClick={logout}
            className="px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-white/60 text-[10px] uppercase tracking-wide hover:text-white transition touch-manipulation"
          >
            Log out
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="h-[100svh] overflow-y-scroll snap-y snap-mandatory [&::-webkit-scrollbar]:hidden overscroll-none touch-pan-y"
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        {products.map((product, idx) => (
          <ProductSlide
            key={product.productId}
            product={product}
            productIndex={idx}
            currentProduct={currentProduct}
            isActive={idx === currentProduct}
            mediaIndex={mediaByProduct[idx] ?? 0}
            initialMediaIndex={idx === startProductIndex ? startMediaIndex : 0}
            guestUsername={guestUsername}
            myReaction={myReactions[product.productId] ?? null}
            likes={likes[product.productId] ?? product.likes}
            dislikes={dislikes[product.productId] ?? product.dislikes}
            commentCount={commentCounts[product.productId] ?? product.commentCount}
            engagementDone={engagementDone[product.productId] ?? true}
            onReact={react}
            onCommentPosted={onCommentPosted}
            onEngagementComplete={completeEngagement}
            onMediaChange={(mediaIdx) => onMediaChange(idx, mediaIdx)}
            slideRef={(el) => {
              slideRefs.current[idx] = el
            }}
          />
        ))}
      </div>

      <div
        className="fixed left-1/2 -translate-x-1/2 z-30 pointer-events-none flex flex-col items-center gap-1.5"
        style={{ bottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))' }}
      >
        <div className="px-4 py-1.5 rounded-full bg-black/60 backdrop-blur-xl border border-white/10 shadow-lg text-center">
          <span className="text-white/80 text-xs font-medium tabular-nums">
            <span className="text-brand-gold font-semibold">{currentProduct + 1}</span>
            <span className="text-white/30"> / {products.length}</span>
          </span>
        </div>
        {canAdvance ? (
          <span className="flex items-center gap-1.5 text-[10px] text-white/50 tracking-widest uppercase">
            <svg className="w-3 h-3 animate-bounce" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
            </svg>
            Swipe up for next
          </span>
        ) : (
          <span className="text-[10px] text-brand-gold/60 tracking-widest uppercase">
            Rate to continue ↑
          </span>
        )}
      </div>
    </div>
  )
}

type ProductSlideProps = {
  product: CatalogueProduct
  productIndex: number
  currentProduct: number
  isActive: boolean
  mediaIndex: number
  initialMediaIndex: number
  guestUsername: string
  myReaction: 'like' | 'dislike' | null
  likes: number
  dislikes: number
  commentCount: number
  engagementDone: boolean
  onReact: (productId: string, r: 'like' | 'dislike') => void
  onCommentPosted: (productId: string) => void
  onEngagementComplete: (productId: string) => void
  onMediaChange: (mediaIdx: number) => void
  slideRef: (el: HTMLDivElement | null) => void
}

function ActionButton({
  label,
  count,
  active,
  activeClass,
  onClick,
  children,
}: {
  label: string
  count: number
  active?: boolean
  activeClass?: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className="flex flex-col items-center gap-1.5 group transition-transform active:scale-90 touch-manipulation"
    >
      <span
        className={`rounded-full flex items-center justify-center backdrop-blur-xl border-2 transition-all duration-200 shadow-lg ${
          active
            ? activeClass + ' border-transparent scale-110'
            : 'bg-black/40 border-white/10 text-white/90 group-hover:border-white/25 group-hover:bg-black/60'
        }`}
        style={{ width: 52, height: 52 }}
      >
        {children}
      </span>
      <span className={`text-[11px] font-semibold tabular-nums tracking-wide ${active ? 'text-white' : 'text-white/50'}`}>
        {formatCount(count)}
      </span>
    </button>
  )
}

function ProductSlide({
  product,
  productIndex,
  currentProduct,
  isActive,
  initialMediaIndex,
  guestUsername,
  myReaction,
  likes,
  dislikes,
  commentCount,
  engagementDone,
  onReact,
  onCommentPosted,
  onEngagementComplete,
  onMediaChange,
  slideRef,
}: ProductSlideProps) {
  const nearActive = Math.abs(productIndex - currentProduct) <= 2
  const reacted = myReaction !== null
  const showCommentInput = reacted && !engagementDone

  return (
    <div
      ref={slideRef}
      data-product-idx={productIndex}
      className="relative h-[100svh] w-full snap-start snap-always bg-black overflow-hidden"
      style={{ minHeight: '-webkit-fill-available' }}
    >
      {nearActive ? (
        <ProductMediaCarousel
          media={product.media}
          productName={product.name}
          isActive={isActive}
          initialMediaIndex={initialMediaIndex}
          onMediaIndexChange={isActive ? onMediaChange : undefined}
          allowPhotoNav={!showCommentInput}
        />
      ) : (
        <div className="absolute inset-0 bg-black" aria-hidden />
      )}

      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-black/40 pointer-events-none" />

      {/* Draft badge */}
      {!product.isActive && (
        <div className="absolute top-[72px] left-4 z-20 pointer-events-none">
          <span className="px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white/60 text-[9px] font-semibold tracking-[0.25em] uppercase">
            Preview
          </span>
        </div>
      )}

      {/* Bottom info + comment area */}
      <div
        className={`absolute bottom-0 left-0 right-0 pointer-events-none ${showCommentInput ? 'z-50' : 'z-10'}`}
        style={{
          paddingBottom: showCommentInput
            ? 'max(6rem, calc(6rem + env(safe-area-inset-bottom, 0px)))'
            : 'max(5rem, calc(5rem + env(safe-area-inset-bottom, 0px)))',
        }}
      >
        {/* Info card */}
        <div className={`mx-3 mb-3 px-4 pt-4 pb-3 rounded-2xl bg-black/50 backdrop-blur-xl border border-white/8 shadow-2xl pointer-events-none transition-all ${showCommentInput ? 'pr-3' : 'pr-[4.5rem]'}`}>
          {/* Category pill */}
          <div className="mb-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-brand-gold/15 border border-brand-gold/30 text-brand-gold text-[9px] font-semibold tracking-[0.25em] uppercase">
              {CATEGORY_LABELS[product.category] ?? product.category}
            </span>
          </div>

          <h2 className="font-display text-xl sm:text-2xl text-white leading-snug mb-0.5 line-clamp-2">
            {product.name}
          </h2>

          {product.itemCode && (
            <p className="text-white/30 text-[11px] font-mono tracking-widest mt-0.5">{product.itemCode}</p>
          )}

          {product.stoneType && product.caratWeight != null && (
            <p className="text-white/50 text-xs mt-1.5 flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-brand-gold/50 inline-block" />
              {product.caratWeight}ctw · {product.stoneType}
            </p>
          )}

          {product.description && !showCommentInput && (
            <p className="text-white/40 text-xs leading-relaxed mt-2 line-clamp-2">
              {product.description}
            </p>
          )}
        </div>

        {/* Comment input (dislike only) */}
        <div className="px-3 pointer-events-auto">
          <InlineComment
            productId={product.productId}
            guestUsername={guestUsername}
            onPosted={() => onCommentPosted(product.productId)}
            onComplete={() => onEngagementComplete(product.productId)}
            visible={showCommentInput}
            isActive={isActive}
          />
        </div>
      </div>

      {/* Action buttons */}
      <div
        className="absolute right-3 z-20 flex flex-col items-center gap-4 pointer-events-auto"
        style={{
          bottom: showCommentInput
            ? 'max(9rem, calc(9rem + env(safe-area-inset-bottom, 0px)))'
            : 'max(6.5rem, calc(6.5rem + env(safe-area-inset-bottom, 0px)))',
        }}
      >
        <ActionButton
          label="Like"
          count={likes}
          active={myReaction === 'like'}
          activeClass="bg-brand-gold/95 text-brand-dark"
          onClick={() => onReact(product.productId, 'like')}
        >
          <IconHeart filled={myReaction === 'like'} className="w-6 h-6" />
        </ActionButton>

        <ActionButton
          label="Dislike"
          count={dislikes}
          active={myReaction === 'dislike'}
          activeClass="bg-red-500/95 text-white"
          onClick={() => onReact(product.productId, 'dislike')}
        >
          <IconDislike filled={myReaction === 'dislike'} className="w-6 h-6" />
        </ActionButton>

        {product.isActive && (
          <a
            href={`/shop/product/${product.productId}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View product"
            className="flex flex-col items-center gap-1.5 group active:scale-90 transition-transform touch-manipulation"
          >
            <span className="flex items-center justify-center backdrop-blur-xl border-2 border-white/10 bg-black/40 text-white/90 group-hover:border-brand-gold/40 group-hover:text-brand-gold transition-all rounded-full shadow-lg" style={{ width: 52, height: 52 }}>
              <IconExternalLink className="w-5 h-5" />
            </span>
            <span className="text-[11px] font-semibold text-white/50 tracking-wide group-hover:text-brand-gold/80 transition">Shop</span>
          </a>
        )}

        {commentCount > 0 && (
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[12px] font-semibold text-white/50 tabular-nums">{formatCount(commentCount)}</span>
            <span className="text-[9px] text-white/25 tracking-wide uppercase">notes</span>
          </div>
        )}
      </div>
    </div>
  )
}
