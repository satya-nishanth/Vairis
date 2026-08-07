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

  const saveProgress = useCallback((frameIndex: number) => {
    fetch('/api/catalogue/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lastFrameIndex: frameIndex }),
      keepalive: true,
    }).catch(() => {})
  }, [])

  const flushProgress = useCallback(() => {
    const idx = Math.max(maxViewedRef.current, currentFlatRef.current)
    maxViewedRef.current = idx
    saveProgress(idx)
  }, [saveProgress])

  const currentMedia = mediaByProduct[currentProduct] ?? 0
  const currentFlat = toFlatIndex(products, currentProduct, currentMedia)
  const debouncedFlat = useDebounce(currentFlat, 400)

  const totalMedia = totalMediaCount(products)
  const activeProductId = products[currentProduct]?.productId
  const canAdvance = activeProductId ? (engagementDone[activeProductId] ?? false) : true

  // Bookkeeping refs — read only from callbacks/effects, never during
  // render, so writing them here (post-render) rather than inline keeps
  // the component pure.
  useEffect(() => {
    currentFlatRef.current = currentFlat
    if (canAdvance) lockedProductRef.current = currentProduct
  }, [currentFlat, canAdvance, currentProduct])

  const scrollToProduct = useCallback((idx: number, mediaIdx = 0) => {
    const el = slideRefs.current[idx]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setCurrentProduct(idx)
    setMediaByProduct((s) => ({ ...s, [idx]: mediaIdx }))
  }, [])

  useEffect(() => {
    const el = slideRefs.current[startProductIndex]
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' })
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs scroll position to the deep-link start index on mount/param change
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

  // Prefetch current and adjacent products so scroll feels instant
  useEffect(() => {
    const indices = [currentProduct - 1, currentProduct, currentProduct + 1].filter(
      (i) => i >= 0 && i < products.length
    )
    for (const i of indices) {
      const p = products[i]
      const mIdx = i === currentProduct ? (mediaByProduct[i] ?? 0) : 0
      const item = p.media[mIdx] ?? p.media[0]
      if (item) prefetchCatalogueMedia(item.url, item.isVideo)
      if (i !== currentProduct && p.media[0] && p.media[0] !== item) {
        prefetchCatalogueMedia(p.media[0].url, p.media[0].isVideo)
      }
    }
  }, [currentProduct, mediaByProduct, products])

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
    window.addEventListener('pagehide', onHide)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushProgress()
    })
    return () => window.removeEventListener('pagehide', onHide)
  }, [flushProgress])

  const onMediaChange = useCallback((productIdx: number, mediaIdx: number) => {
    setMediaByProduct((s) => ({ ...s, [productIdx]: mediaIdx }))
  }, [])

  const goToFirst = useCallback(async () => {
    maxViewedRef.current = -1
    await fetch('/api/catalogue/progress', { method: 'DELETE' }).catch(() => {})
    scrollToProduct(0, 0)
  }, [scrollToProduct])

  const logout = useCallback(async () => {
    flushProgress()
    await fetch('/api/catalogue/logout', { method: 'POST' }).catch(() => {})
    router.replace('/catalogue/login')
  }, [flushProgress, router])

  const progressPct = totalMedia > 0 ? ((currentFlat + 1) / totalMedia) * 100 : 0

  const react = useCallback(
    async (productId: string, reaction: 'like' | 'dislike') => {
      const prev = myReactions[productId]
      const next = prev === reaction ? null : reaction
      setMyReactions((s) => ({ ...s, [productId]: next }))

      // any like/dislike tap (even un-tap) opens the comment gate
      setEngagementDone((s) => ({ ...s, [productId]: false }))

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

      await fetch('/api/catalogue/reaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, reaction: next }),
      })
    },
    [myReactions]
  )

  const completeEngagement = useCallback(
    (productId: string) => {
      setEngagementDone((s) => ({ ...s, [productId]: true }))
      flushProgress()
    },
    [flushProgress]
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
        className="fixed left-1/2 -translate-x-1/2 z-30 pointer-events-none flex flex-col items-center gap-1"
        style={{ bottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))' }}
      >
        <div className="px-4 py-1.5 rounded-full bg-black/55 backdrop-blur-xl border border-white/10 shadow-lg text-center">
          <span className="text-white/90 text-xs font-medium tabular-nums block">
            Product <span className="text-brand-gold">{currentProduct + 1}</span>
            <span className="text-white/35"> / {products.length}</span>
          </span>
          {active && active.media.length > 1 && (
            <span className="text-white/45 text-[10px] tabular-nums mt-0.5 block">
              {active.media[currentMedia]?.isVideo ? 'Video' : 'Photo'} {currentMedia + 1}/
              {active.media.length} · tap sides to switch
            </span>
          )}
        </div>
        <span className="text-[10px] text-white/30 tracking-widest uppercase">Swipe up · next piece</span>
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
      className="flex flex-col items-center gap-1 group transition-transform active:scale-90 touch-manipulation"
    >
      <span
        className={`w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-md border transition-all ${
          active
            ? activeClass + ' border-transparent shadow-lg scale-105'
            : 'bg-black/35 border-white/15 text-white group-hover:bg-black/50 group-hover:border-white/25'
        }`}
      >
        {children}
      </span>
      <span className={`text-[11px] font-medium tabular-nums ${active ? 'text-white' : 'text-white/55'}`}>
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
  const nearActive = Math.abs(productIndex - currentProduct) <= 1
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

      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/30 pointer-events-none" />

      <div
        className={`absolute bottom-0 left-0 right-0 px-4 pt-16 bg-gradient-to-t from-black via-black/95 to-transparent ${
          showCommentInput ? 'z-50' : 'z-10'
        } pointer-events-none`}
        style={{
          paddingBottom: showCommentInput
            ? 'max(6.5rem, calc(6.5rem + env(safe-area-inset-bottom, 0px)))'
            : 'max(5.5rem, calc(5.5rem + env(safe-area-inset-bottom, 0px)))',
        }}
      >
        <div className={`pointer-events-none transition-all ${showCommentInput ? 'pr-2' : 'pr-16'}`}>
          <p className="text-[10px] text-brand-gold tracking-[0.3em] uppercase font-medium mb-1">
            {CATEGORY_LABELS[product.category] ?? product.category}
          </p>
          <h2 className="font-display text-2xl text-white leading-tight mb-0.5">{product.name}</h2>
          {product.itemCode && (
            <p className="text-white/35 text-xs font-mono tracking-wide">{product.itemCode}</p>
          )}
          {product.stoneType && product.caratWeight != null && (
            <p className="text-white/50 text-xs mt-1">
              {product.caratWeight}ctw · {product.stoneType}
            </p>
          )}
          <p
            className={`text-white/45 text-xs leading-relaxed mt-2 max-w-[92%] transition-all ${
              showCommentInput ? 'line-clamp-1' : 'line-clamp-2 max-w-[85%]'
            }`}
          >
            {product.description}
          </p>
        </div>

        <InlineComment
          productId={product.productId}
          guestUsername={guestUsername}
          onPosted={() => onCommentPosted(product.productId)}
          onComplete={() => onEngagementComplete(product.productId)}
          visible={showCommentInput}
          isActive={isActive}
        />
      </div>

      <div
        className="absolute right-3 z-20 flex flex-col items-center gap-3 transition-all pointer-events-auto"
        style={{
          bottom: showCommentInput
            ? 'max(9.5rem, calc(9.5rem + env(safe-area-inset-bottom, 0px)))'
            : 'max(7rem, calc(7rem + env(safe-area-inset-bottom, 0px)))',
        }}
      >
        <ActionButton
          label="Like"
          count={likes}
          active={myReaction === 'like'}
          activeClass="bg-brand-gold/90 text-brand-dark"
          onClick={() => onReact(product.productId, 'like')}
        >
          <IconHeart filled={myReaction === 'like'} className="w-6 h-6" />
        </ActionButton>

        <ActionButton
          label="Dislike"
          count={dislikes}
          active={myReaction === 'dislike'}
          activeClass="bg-red-500/90 text-white"
          onClick={() => onReact(product.productId, 'dislike')}
        >
          <IconDislike filled={myReaction === 'dislike'} className="w-6 h-6" />
        </ActionButton>

        <a
          href={`/shop/product/${product.productId}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="View product"
          className="flex flex-col items-center gap-1.5 group active:scale-90 transition-transform"
        >
          <span className="w-12 h-12 rounded-full flex items-center justify-center bg-black/35 backdrop-blur-md border border-white/15 text-white group-hover:border-brand-gold/40 group-hover:text-brand-gold transition-all">
            <IconExternalLink className="w-5 h-5" />
          </span>
          <span className="text-[10px] text-white/45 group-hover:text-brand-gold/80 transition">Shop</span>
        </a>

        {commentCount > 0 && (
          <span className="text-[10px] text-white/40 tabular-nums text-center leading-tight">
            {formatCount(commentCount)}
            <br />
            <span className="text-white/25">comments</span>
          </span>
        )}
      </div>
    </div>
  )
}
