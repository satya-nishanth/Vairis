'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ImageUploader from './ImageUploader'
import { AdminProductGalleryPreview } from './AdminProductGalleryPreview'
import { ProductFilterLabelsEditor } from './ProductFilterLabelsEditor'
import AdminProductBuildPrice from './AdminProductBuildPrice'
import { calculatePrice, resolvePricingConfig, type PricingConfig, type StoneInput } from '@/lib/pricing'
import { parseInvoiceReturnTo, invoiceReturnWithVariant } from '@/lib/invoice-return'

export type CategoryOption = { slug: string; name: string }

const DEFAULT_CATEGORIES: CategoryOption[] = [
  { slug: 'rings', name: 'Rings' },
  { slug: 'earrings', name: 'Earrings' },
  { slug: 'pendants', name: 'Pendants' },
  { slug: 'bracelets', name: 'Bracelets' },
  { slug: 'mangalsutra', name: 'Mangalsutra' },
  { slug: 'necklaces', name: 'Necklaces' },
]

const METAL_TYPES = [
  { value: 'GOLD_18K', label: '18kt Gold', skuSuffix: 'G18K', badgeColor: '#fef08a', badgeText: '#854d0e', badgeBorder: '#fde047' },
  { value: 'GOLD_14K', label: '14kt Gold', skuSuffix: 'G14K', badgeColor: '#fef9c3', badgeText: '#a16207', badgeBorder: '#fef08a' },
  { value: 'ROSE_GOLD', label: 'Rose Gold 18kt', skuSuffix: 'RG', badgeColor: '#ffe4e6', badgeText: '#be123c', badgeBorder: '#fecdd3' },
]

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Draft', hint: 'Not visible on store. Only title is required.' },
  { value: 'AI_DRAFT', label: 'AI Draft', hint: 'Machine-generated draft — review before going live.' },
  { value: 'LIVE', label: 'Live', hint: 'Visible & purchasable on storefront. Needs ≥1 variant.' },
] as const

const PRICE_VISIBILITY_OPTIONS = [
  { value: 'INHERIT', label: 'Use global default', hint: 'Follows storefront-wide setting in Pricing Settings.' },
  { value: 'SHOW', label: 'Always show price', hint: 'Shows the computed price regardless of global setting.' },
  { value: 'HIDE', label: 'Always hide (Price on Request)', hint: 'No checkout price shown — WhatsApp enquiry only.' },
] as const

const FALLBACK_RATES: Record<string, number> = {
  GOLD_18K: 5100,
  GOLD_14K: 3967,
  ROSE_GOLD: 5100,
}

/** Always unique within a product: NECKL1, EARRI2, P3, … */
function pieceSkuSlug(name: string, index: number): string {
  const cleaned = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, 5)
  return `${cleaned || 'P'}${index + 1}`
}

/**
 * Auto SKU format:
 * - one piece:  ITEM-18K
 * - multi-piece: ITEM-NECKL1-18K / ITEM-EARRI2-18K (unique per piece)
 */
function buildSku(
  itemCode: string,
  metalType: string,
  size?: string,
  pieceSlug?: string,
): string {
  if (!itemCode) return ''
  const suffix = METAL_TYPES.find((m) => m.value === metalType)?.skuSuffix ?? metalType
  const sizePart = size?.trim() ? `-${size.trim().toUpperCase().replace(/\s+/g, '')}` : ''
  const piecePart = pieceSlug ? `-${pieceSlug}` : ''
  return `${itemCode.toUpperCase()}${piecePart}-${suffix}${sizePart}`
}

type Variant = {
  metalType: string
  size: string
  weightGrams: string
  makingChargePerGram: string
  flatMakingCharge: string
  stoneCharges: string
  miscCharges: string
  stock: string
  sku: string
}

type FormStone = {
  diamondRateId: string
  caratWeight: string
  count: string
  label: string
  /** When true, use DiamondRate store defaults (persist null overrides). */
  useStoreRates: boolean
  ratePerCarat: string
  ratePerCaratExchange: string
}

export type DiamondRateOption = {
  id: string
  label: string
  ratePerCarat: number
  ratePerCaratExchange: number
}

type FormPiece = {
  key: string
  id?: string
  name: string
  variants: Variant[]
  stones: FormStone[]
  inheritWastage: boolean
  vaGoldPct: string
  vaLabel: string
}

type FormData = {
  name: string
  description: string
  category: string
  itemCode: string
  designStyle: string
  totalLengthMm: string
  motifSizeMm: string
  thicknessMm: string
  stoneType: string
  stoneShape: string
  stoneDimMm: string
  gemCount: string
  caratWeight: string
  images: string[]
  pieces: FormPiece[]
  isActive: boolean
  comingSoon: boolean
  status: 'DRAFT' | 'AI_DRAFT' | 'LIVE'
  priority: string | number
  priceVisibility: 'INHERIT' | 'SHOW' | 'HIDE'
  labels?: string[]
}

type Props = {
  initialData?: Partial<FormData> & {
    id?: string
    labels?: string[]
    /** Legacy flat fields — wrapped into Main when pieces absent */
    variants?: Variant[]
    stones?: FormStone[]
    inheritWastage?: boolean
    vaGoldPct?: string
    vaLabel?: string
  }
  mode: 'create' | 'edit'
  diamondRates: DiamondRateOption[]
  goldRates?: Record<string, number>
  pricingConfig?: PricingConfig
  categories?: CategoryOption[]
  allCategoryFilters?: Record<string, any>
  returnTo?: string
}

function emptyVariant(): Variant {
  return {
    metalType: 'GOLD_18K',
    size: '',
    weightGrams: '',
    makingChargePerGram: '',
    flatMakingCharge: '0',
    stoneCharges: '0',
    miscCharges: '45',
    stock: '0',
    sku: '',
  }
}

function emptyStone(diamondRates: DiamondRateOption[]): FormStone {
  const first = diamondRates[0]
  return {
    diamondRateId: first?.id ?? '',
    caratWeight: '',
    count: '',
    label: '',
    useStoreRates: true,
    ratePerCarat: first ? String(first.ratePerCarat) : '',
    ratePerCaratExchange: first ? String(first.ratePerCaratExchange) : '',
  }
}

function emptyPiece(
  store: PricingConfig,
  name = 'Main',
  variants?: Variant[],
  stones?: FormStone[],
  va?: { inheritWastage: boolean; vaGoldPct: string; vaLabel: string },
): FormPiece {
  return {
    key: `piece-${Math.random().toString(36).slice(2, 10)}`,
    name,
    variants: variants?.length ? variants : [emptyVariant()],
    stones: stones ?? [],
    inheritWastage: va?.inheritWastage ?? true,
    vaGoldPct: va?.vaGoldPct ?? String(store.vaGoldPct),
    vaLabel: va?.vaLabel ?? (store.vaLabel || 'Value Addition'),
  }
}

function initialForm(
  data?: Props['initialData'],
  storePricing?: PricingConfig,
): FormData {
  const store = storePricing ?? { vaGoldPct: 10, vaStonePct: 0, vaLabel: 'Value Addition' }

  let pieces: FormPiece[]
  if (data?.pieces?.length) {
    pieces = data.pieces.map((p, i) => ({
      key: p.key || p.id || `piece-${i}`,
      id: p.id,
      name: p.name || (i === 0 ? 'Main' : `Piece ${i + 1}`),
      variants: p.variants?.length ? p.variants : [emptyVariant()],
      stones: p.stones ?? [],
      inheritWastage: p.inheritWastage ?? true,
      vaGoldPct: p.vaGoldPct ?? String(store.vaGoldPct),
      vaLabel: p.vaLabel || store.vaLabel || 'Value Addition',
    }))
  } else {
    const hasOverride =
      data?.inheritWastage === false ||
      (data?.vaGoldPct !== undefined && data?.vaGoldPct !== null && String(data.vaGoldPct) !== '') ||
      (data?.vaLabel !== undefined && data?.vaLabel !== null && String(data.vaLabel) !== '')
    const inherit = data?.inheritWastage !== undefined ? data.inheritWastage : !hasOverride
    pieces = [
      emptyPiece(
        store,
        'Main',
        data?.variants as Variant[] | undefined,
        data?.stones as FormStone[] | undefined,
        {
          inheritWastage: inherit,
          vaGoldPct:
            data?.vaGoldPct !== undefined && data?.vaGoldPct !== null && String(data.vaGoldPct) !== ''
              ? String(data.vaGoldPct)
              : String(store.vaGoldPct),
          vaLabel:
            data?.vaLabel !== undefined && data?.vaLabel !== null && String(data.vaLabel) !== ''
              ? String(data.vaLabel)
              : store.vaLabel || 'Value Addition',
        },
      ),
    ]
  }

  return {
    name: data?.name ?? '',
    description: data?.description ?? '',
    category: data?.category ?? 'RINGS',
    itemCode: data?.itemCode ?? '',
    designStyle: data?.designStyle ?? '',
    totalLengthMm: data?.totalLengthMm ?? '',
    motifSizeMm: data?.motifSizeMm ?? '',
    thicknessMm: data?.thicknessMm ?? '',
    stoneType: data?.stoneType ?? '',
    stoneShape: data?.stoneShape ?? '',
    stoneDimMm: data?.stoneDimMm ?? '',
    gemCount: data?.gemCount ?? '',
    caratWeight: data?.caratWeight ?? '',
    images: data?.images ?? [],
    pieces,
    isActive: data?.isActive ?? true,
    comingSoon: data?.comingSoon ?? false,
    status: data?.status ?? 'DRAFT',
    priority: data?.priority !== undefined ? String(data.priority) : '0',
    priceVisibility: data?.priceVisibility ?? 'INHERIT',
    labels: data?.labels ?? [],
  }
}

type TabKey = 'all' | 'general' | 'media' | 'labels' | 'pricing'

export default function ProductForm({
  initialData,
  mode,
  diamondRates,
  goldRates,
  pricingConfig,
  categories: initialCategories,
  allCategoryFilters,
  returnTo,
}: Props) {
  const router = useRouter()
  const storePricing = pricingConfig ?? { vaGoldPct: 10, vaStonePct: 0, vaLabel: 'Value Addition' }
  const [form, setForm] = useState<FormData>(() => initialForm(initialData, storePricing))
  const [activePieceIdx, setActivePieceIdx] = useState(0)
  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const [filtersMap, setFiltersMap] = useState<Record<string, any>>(allCategoryFilters ?? {})
  const [categoryList, setCategoryList] = useState<CategoryOption[]>(
    initialCategories && initialCategories.length > 0 ? initialCategories : DEFAULT_CATEGORIES
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!allCategoryFilters || Object.keys(allCategoryFilters).length === 0) {
      fetch('/api/admin/filters')
        .then((res) => (res.ok ? res.json() : null))
        .then((res) => {
          if (res?.data) setFiltersMap(res.data)
        })
        .catch(() => {})
    }
  }, [allCategoryFilters])

  useEffect(() => {
    fetch('/api/admin/categories')
      .then((res) => (res.ok ? res.json() : []))
      .then((data: any[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setCategoryList(data.map((c) => ({ slug: c.slug, name: c.name })))
        }
      })
      .catch(() => {})
  }, [])

  const categoryOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of categoryList) {
      map.set(c.slug.toUpperCase(), c.name)
    }
    if (form.category && !map.has(form.category.toUpperCase())) {
      const raw = form.category
      const label = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase().replace(/_/g, ' ')
      map.set(raw.toUpperCase(), label)
    }
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }))
  }, [categoryList, form.category])

  const currentCategorySlug = (form.category || '').toLowerCase().trim()
  const currentCategoryConfig =
    filtersMap[currentCategorySlug] ||
    filtersMap[currentCategorySlug.replace(/s$/, '')] ||
    filtersMap[`${currentCategorySlug}s`]
  const availableLabels: string[] = currentCategoryConfig?.labels || []
  const currentCategoryName =
    categoryOptions.find((c) => c.value === form.category)?.label ||
    form.category.replace(/_/g, ' ')

  const rates = goldRates && Object.keys(goldRates).length ? goldRates : FALLBACK_RATES
  const isDraft = form.status !== 'LIVE'
  const activePiece = form.pieces[Math.min(activePieceIdx, form.pieces.length - 1)] ?? form.pieces[0]

  const effectivePricing = resolvePricingConfig(
    storePricing,
    activePiece?.inheritWastage
      ? null
      : { vaGoldPct: activePiece?.vaGoldPct, vaLabel: activePiece?.vaLabel },
  )

  const stoneInputs = (activePiece?.stones ?? []).flatMap((s): StoneInput[] => {
    const rate = diamondRates.find((r) => r.id === s.diamondRateId)
    const carat = parseFloat(s.caratWeight)
    if (!rate || !carat || carat <= 0) return []
    const std = s.useStoreRates
      ? rate.ratePerCarat
      : parseFloat(s.ratePerCarat) || rate.ratePerCarat
    const exch = s.useStoreRates
      ? rate.ratePerCaratExchange
      : parseFloat(s.ratePerCaratExchange) || rate.ratePerCaratExchange
    return [
      {
        caratWeight: carat,
        ratePerCarat: std,
        ratePerCaratExchange: exch,
        typeLabel: rate.label,
      },
    ]
  })

  function calcEstimatedBreakdown(v: Variant, withExchange: boolean) {
    const weight = parseFloat(v.weightGrams)
    if (!weight || weight <= 0) return null
    return calculatePrice(
      {
        weightGrams: weight,
        makingChargePerGram: parseFloat(v.makingChargePerGram) || 0,
        flatMakingCharge: parseFloat(v.flatMakingCharge) || 0,
        stoneCharges: parseFloat(v.stoneCharges) || 0,
        miscCharges: parseFloat(v.miscCharges) || 0,
      },
      rates[v.metalType] ?? 0,
      { stones: stoneInputs, withExchange, config: effectivePricing },
    )
  }

  const totalStock = useMemo(() => {
    return form.pieces.reduce(
      (acc, p) => acc + p.variants.reduce((a, v) => a + (parseInt(v.stock, 10) || 0), 0),
      0,
    )
  }, [form.pieces])

  const minEstimatedPrice = useMemo(() => {
    let sum = 0
    let any = false
    for (const piece of form.pieces) {
      const cfg = resolvePricingConfig(
        storePricing,
        piece.inheritWastage ? null : { vaGoldPct: piece.vaGoldPct, vaLabel: piece.vaLabel },
      )
      const stones = piece.stones.flatMap((s): StoneInput[] => {
        const rate = diamondRates.find((r) => r.id === s.diamondRateId)
        const carat = parseFloat(s.caratWeight)
        if (!rate || !carat || carat <= 0) return []
        return [
          {
            caratWeight: carat,
            ratePerCarat: s.useStoreRates ? rate.ratePerCarat : parseFloat(s.ratePerCarat) || rate.ratePerCarat,
            ratePerCaratExchange: s.useStoreRates
              ? rate.ratePerCaratExchange
              : parseFloat(s.ratePerCaratExchange) || rate.ratePerCaratExchange,
            typeLabel: rate.label,
          },
        ]
      })
      let pieceMin: number | null = null
      for (const v of piece.variants) {
        const weight = parseFloat(v.weightGrams)
        if (!weight || weight <= 0) continue
        const total = Math.round(
          calculatePrice(
            {
              weightGrams: weight,
              makingChargePerGram: parseFloat(v.makingChargePerGram) || 0,
              flatMakingCharge: parseFloat(v.flatMakingCharge) || 0,
              stoneCharges: parseFloat(v.stoneCharges) || 0,
              miscCharges: parseFloat(v.miscCharges) || 0,
            },
            rates[v.metalType] ?? 0,
            { stones, withExchange: false, config: cfg },
          ).total,
        )
        if (pieceMin === null || total < pieceMin) pieceMin = total
      }
      if (pieceMin != null) {
        sum += pieceMin
        any = true
      }
    }
    return any ? sum : null
  }, [form.pieces, diamondRates, rates, storePricing])

  function skuFor(piece: FormPiece, pieceIndex: number, metalType: string, size?: string) {
    const slug =
      form.pieces.length > 1 ? pieceSkuSlug(piece.name, pieceIndex) : undefined
    return buildSku(form.itemCode, metalType, size, slug)
  }

  /** Rewrite auto SKUs; multi-piece embeds a unique per-piece slug (NECKL1, EARRI2, …). */
  function withAutoSkus(pieces: FormPiece[], itemCode: string): FormPiece[] {
    const multi = pieces.length > 1
    const slugs = pieces.map((p, pi) => (multi ? pieceSkuSlug(p.name, pi) : undefined))
    return pieces.map((p, pi) => {
      const slug = slugs[pi]
      return {
        ...p,
        variants: p.variants.map((v) => {
          const auto = buildSku(itemCode, v.metalType, v.size, slug)
          const knownAutos = [
            buildSku(itemCode, v.metalType, v.size),
            auto,
            ...slugs
              .filter((s): s is string => Boolean(s))
              .map((s) => buildSku(itemCode, v.metalType, v.size, s)),
          ]
          const looksAuto = !v.sku.trim() || knownAutos.includes(v.sku)
          return looksAuto ? { ...v, sku: auto } : v
        }),
      }
    })
  }

  function set<K extends keyof FormData>(field: K, value: FormData[K]) {
    setForm((f) => {
      const next = { ...f, [field]: value }
      if (field === 'itemCode') {
        next.pieces = withAutoSkus(f.pieces, value as string)
      }
      return next
    })
  }

  function setVariant(idx: number, field: keyof Variant, value: string) {
    setForm((f) => {
      const pieces = [...f.pieces]
      const pi = Math.min(activePieceIdx, pieces.length - 1)
      const piece = pieces[pi]
      const variants = [...piece.variants]
      const prev = variants[idx]
      variants[idx] = { ...prev, [field]: value }
      if ((field === 'metalType' || field === 'size') && f.itemCode) {
        const multi = f.pieces.length > 1
        const slug = multi ? pieceSkuSlug(piece.name, pi) : undefined
        const prevAuto = buildSku(f.itemCode, prev.metalType, prev.size, slug)
        const prevLegacy = buildSku(f.itemCode, prev.metalType, prev.size)
        const wasAuto = !prev.sku || prev.sku === prevLegacy || prev.sku === prevAuto
        if (wasAuto) {
          variants[idx].sku = buildSku(
            f.itemCode,
            variants[idx].metalType,
            variants[idx].size,
            slug,
          )
        }
      }
      pieces[pi] = { ...piece, variants }
      return { ...f, pieces }
    })
  }

  function addVariant() {
    const pi = Math.min(activePieceIdx, form.pieces.length - 1)
    const piece = form.pieces[pi]
    const nv = emptyVariant()
    nv.sku = skuFor(piece, pi, nv.metalType)
    setForm((f) => {
      const pieces = [...f.pieces]
      const idx = Math.min(activePieceIdx, pieces.length - 1)
      pieces[idx] = { ...pieces[idx], variants: [...pieces[idx].variants, nv] }
      return { ...f, pieces }
    })
  }

  function removeVariant(idx: number) {
    setForm((f) => {
      const pieces = [...f.pieces]
      const pi = Math.min(activePieceIdx, pieces.length - 1)
      pieces[pi] = { ...pieces[pi], variants: pieces[pi].variants.filter((_, i) => i !== idx) }
      return { ...f, pieces }
    })
  }

  function setStone(idx: number, field: keyof FormStone, value: string | boolean) {
    setForm((f) => {
      const pieces = [...f.pieces]
      const pi = Math.min(activePieceIdx, pieces.length - 1)
      const stones = [...pieces[pi].stones]
      const prev = stones[idx]
      const next = { ...prev, [field]: value } as FormStone
      if (field === 'diamondRateId') {
        const rate = diamondRates.find((r) => r.id === value)
        if (rate && next.useStoreRates) {
          next.ratePerCarat = String(rate.ratePerCarat)
          next.ratePerCaratExchange = String(rate.ratePerCaratExchange)
        }
      }
      if (field === 'useStoreRates' && value === true) {
        const rate = diamondRates.find((r) => r.id === next.diamondRateId)
        if (rate) {
          next.ratePerCarat = String(rate.ratePerCarat)
          next.ratePerCaratExchange = String(rate.ratePerCaratExchange)
        }
      }
      stones[idx] = next
      pieces[pi] = { ...pieces[pi], stones }
      return { ...f, pieces }
    })
  }

  function addStone() {
    setForm((f) => {
      const pieces = [...f.pieces]
      const pi = Math.min(activePieceIdx, pieces.length - 1)
      pieces[pi] = { ...pieces[pi], stones: [...pieces[pi].stones, emptyStone(diamondRates)] }
      return { ...f, pieces }
    })
  }

  function removeStone(idx: number) {
    setForm((f) => {
      const pieces = [...f.pieces]
      const pi = Math.min(activePieceIdx, pieces.length - 1)
      pieces[pi] = { ...pieces[pi], stones: pieces[pi].stones.filter((_, i) => i !== idx) }
      return { ...f, pieces }
    })
  }

  function addPiece() {
    const n = form.pieces.length + 1
    const piece = emptyPiece(storePricing, n === 2 ? 'Earrings' : `Piece ${n}`)
    setForm((f) => {
      const pieces = withAutoSkus([...f.pieces, piece], f.itemCode)
      return { ...f, pieces }
    })
    setActivePieceIdx(form.pieces.length)
  }

  function removePiece(idx: number) {
    if (form.pieces.length <= 1) return
    setForm((f) => {
      const next = f.pieces.filter((_, i) => i !== idx)
      return { ...f, pieces: withAutoSkus(next, f.itemCode) }
    })
    setActivePieceIdx((i) => Math.max(0, i >= idx ? i - 1 : i))
  }

  function renamePiece(idx: number, name: string) {
    setForm((f) => {
      const pieces = [...f.pieces]
      pieces[idx] = { ...pieces[idx], name }
      return { ...f, pieces: withAutoSkus(pieces, f.itemCode) }
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    for (const piece of form.pieces) {
      for (const v of piece.variants) {
        if (v.makingChargePerGram !== '' && parseFloat(v.makingChargePerGram) < 0) {
          setError('Making Charge cannot be negative.')
          return
        }
      }
    }

    setSaving(true)
    setError('')

    const pieces = withAutoSkus(form.pieces, form.itemCode).map((p, i) => ({
      id: p.id || null,
      name: p.name.trim() || (i === 0 ? 'Main' : `Piece ${i + 1}`),
      vaGoldPct: p.inheritWastage ? null : parseFloat(p.vaGoldPct),
      vaLabel: p.inheritWastage ? null : p.vaLabel.trim() || null,
      variants: (isDraft
        ? p.variants.filter((v) => v.sku.trim() || parseFloat(v.weightGrams) > 0)
        : p.variants
      ).map((v) => ({ ...v })),
      stones: p.stones
        .filter((s) => parseFloat(s.caratWeight) > 0 && s.diamondRateId)
        .map((s) => ({
          diamondRateId: s.diamondRateId,
          caratWeight: s.caratWeight,
          count: s.count || null,
          label: s.label || null,
          ratePerCarat: s.useStoreRates ? null : parseFloat(s.ratePerCarat) || null,
          ratePerCaratExchange: s.useStoreRates ? null : parseFloat(s.ratePerCaratExchange) || null,
        })),
    }))

    const payload = {
      name: form.name,
      description: form.description,
      category: form.category,
      itemCode: form.itemCode,
      designStyle: form.designStyle,
      totalLengthMm: form.totalLengthMm,
      motifSizeMm: form.motifSizeMm,
      thicknessMm: form.thicknessMm,
      stoneType: form.stoneType,
      stoneShape: form.stoneShape,
      stoneDimMm: form.stoneDimMm,
      gemCount: form.gemCount,
      caratWeight: form.caratWeight,
      images: form.images.filter(Boolean),
      isActive: form.isActive,
      comingSoon: form.comingSoon,
      status: form.status,
      priority: parseInt(String(form.priority), 10) || 0,
      priceVisibility: form.priceVisibility,
      labels: form.labels,
      pieces,
    }

    const url = mode === 'create' ? '/api/admin/products' : `/api/admin/products/${initialData?.id}`
    const res = await fetch(url, {
      method: mode === 'create' ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    setSaving(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(j.error ?? 'Save failed')
      return
    }

    const created = await res.json().catch(() => ({}))
    const safeReturn = parseInvoiceReturnTo(returnTo)
    const variantId = created?.variants?.[0]?.id as string | undefined
    if (mode === 'create' && safeReturn && variantId) {
      router.push(invoiceReturnWithVariant(safeReturn, variantId))
    } else if (mode === 'create' && safeReturn) {
      router.push(safeReturn)
    } else {
      router.push('/admin/products')
    }
    router.refresh()
  }


  const primaryImage = form.images.find(Boolean)

  const TABS = [
    { id: 'all' as TabKey, label: 'All Sections', icon: '📌' },
    { id: 'general' as TabKey, label: 'Basic Info', icon: '📝' },
    { id: 'media' as TabKey, label: 'Images', icon: '🖼️', count: form.images.filter(Boolean).length },
    { id: 'labels' as TabKey, label: 'Filter Labels', icon: '🏷️', count: (form.labels ?? []).length },
    {
      id: 'pricing' as TabKey,
      label: 'Build & Price',
      icon: '💍',
      count: form.pieces.reduce((n, p) => n + p.variants.length + p.stones.length, 0),
    },
  ]

  return (
    <form onSubmit={handleSubmit} className="pform" style={{ maxWidth: '100%' }}>
      {/* ─── STICKY HERO ACTION BAR ─── */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 35,
          background: 'rgba(255, 255, 255, 0.96)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid #e5e7eb',
          padding: '12px 16px',
          margin: '-1rem -1rem 1.25rem -1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <Link
            href={returnTo ?? '/admin/products'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              fontSize: '0.8125rem',
              color: '#6b7280',
              textDecoration: 'none',
              padding: '4px 8px',
              borderRadius: '4px',
              background: '#f3f4f6',
            }}
          >
            ← {returnTo ? 'Invoice' : 'Products'}
          </Link>

          {primaryImage ? (
            <img
              src={primaryImage}
              alt=""
              style={{
                width: 34,
                height: 34,
                borderRadius: 6,
                objectFit: 'cover',
                border: '1px solid #e5e7eb',
                flexShrink: 0,
              }}
            />
          ) : (
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 6,
                background: '#f3f4f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                border: '1px solid #e5e7eb',
                flexShrink: 0,
              }}
            >
              💍
            </div>
          )}

          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: '1.0625rem',
                  fontWeight: 600,
                  color: '#111827',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '340px',
                }}
              >
                {form.name || (mode === 'create' ? 'New Product' : 'Untitled Product')}
              </span>

              {/* Status Badge */}
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  background:
                    form.status === 'LIVE'
                      ? '#ecfdf5'
                      : form.status === 'DRAFT'
                      ? '#fefce8'
                      : '#f5f3ff',
                  color:
                    form.status === 'LIVE'
                      ? '#065f46'
                      : form.status === 'DRAFT'
                      ? '#854d0e'
                      : '#5b21b6',
                  border: `1px solid ${
                    form.status === 'LIVE'
                      ? '#a7f3d0'
                      : form.status === 'DRAFT'
                      ? '#fef08a'
                      : '#ddd6fe'
                  }`,
                }}
              >
                {form.status}
              </span>

              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  background: '#eff6ff',
                  color: '#1d4ed8',
                  border: '1px solid #bfdbfe',
                }}
              >
                {currentCategoryName}
              </span>

              {form.itemCode && (
                <span
                  style={{
                    fontSize: '0.6875rem',
                    color: '#4b5563',
                    background: '#f3f4f6',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                  }}
                >
                  {form.itemCode}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right side actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {mode === 'edit' && initialData?.id && (
            <Link
              href={`/product/${initialData.id}`}
              target="_blank"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '7px 12px',
                fontSize: '0.8125rem',
                fontWeight: 500,
                color: '#374151',
                background: '#ffffff',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                textDecoration: 'none',
              }}
            >
              View in Store ↗
            </Link>
          )}

          <button
            type="submit"
            disabled={saving}
            className="pform__submit"
            style={{
              padding: '7px 18px',
              fontSize: '0.8125rem',
              fontWeight: 600,
              borderRadius: 6,
              background: saving ? '#9ca3af' : '#111827',
              color: '#ffffff',
              border: 'none',
              cursor: saving ? 'not-allowed' : 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
            }}
          >
            {saving ? 'Saving…' : mode === 'create' ? 'Create Product' : 'Save Changes'}
          </button>

          <button
            type="button"
            onClick={() => {
              const back = parseInvoiceReturnTo(returnTo)
              if (back) router.push(back)
              else router.back()
            }}
            className="pform__cancel"
            style={{
              padding: '7px 12px',
              fontSize: '0.8125rem',
              color: '#6b7280',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>

      {/* ─── EXECUTIVE KPI / STATS BAR ─── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
          marginBottom: '1rem',
        }}
      >
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '12px 14px',
          }}
        >
          <div style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280' }}>
            Store Publishing
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: '#111827', marginTop: '2px' }}>
            {form.status === 'LIVE' ? '🟢 Live on Store' : form.status === 'DRAFT' ? '🟡 Hidden (Draft)' : '🟣 AI Draft'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '2px' }}>
            {form.priceVisibility === 'SHOW'
              ? 'Always show price'
              : form.priceVisibility === 'HIDE'
              ? 'WhatsApp Enquiry only'
              : 'Inherits global pricing setting'}
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '12px 14px',
          }}
        >
          <div style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280' }}>
            Category &amp; Priority
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: '#111827', marginTop: '2px' }}>
            {currentCategoryName}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '2px' }}>
            Display Priority: #{form.priority || 0} · {(form.labels ?? []).length} filter labels
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '12px 14px',
          }}
        >
          <div style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280' }}>
            Variants &amp; Stock
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: '#111827', marginTop: '2px' }}>
            {form.pieces.reduce((n, p) => n + p.variants.length, 0)} Metal Options
          </div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '2px' }}>
            {totalStock} units available across sizes
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '12px 14px',
          }}
        >
          <div style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280' }}>
            Est. Starting Retail
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: '#111827', marginTop: '2px' }}>
            {minEstimatedPrice ? `₹${minEstimatedPrice.toLocaleString('en-IN')}` : 'Price on Request'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '2px' }}>
            {form.pieces.some((p) => p.stones.length > 0)
              ? `${form.pieces.reduce((n, p) => n + p.stones.length, 0)} diamond entries included`
              : 'Pure gold jewellery item'}
          </div>
        </div>
      </div>

      {/* ─── SEGMENTED SECTION TABS (ELIMINATES LENGTHY SCROLLING) ─── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          overflowX: 'auto',
          paddingBottom: '8px',
          marginBottom: '1rem',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '6px',
                fontSize: '0.8125rem',
                fontWeight: isActive ? 600 : 500,
                background: isActive ? '#111827' : '#ffffff',
                color: isActive ? '#ffffff' : '#374151',
                border: isActive ? '1px solid #111827' : '1px solid #e5e7eb',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && tab.count > 0 && (
                <span
                  style={{
                    fontSize: '0.6875rem',
                    padding: '1px 5px',
                    borderRadius: '9999px',
                    background: isActive ? 'rgba(255,255,255,0.2)' : '#f3f4f6',
                    color: isActive ? '#ffffff' : '#6b7280',
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {error && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '6px',
            fontSize: '0.8125rem',
            background: '#fef2f2',
            color: '#991b1b',
            border: '1px solid #fecaca',
            marginBottom: '1rem',
          }}
        >
          {error}
        </div>
      )}

      {/* ─── SECTION 1: BASIC INFORMATION ─── */}
      {(activeTab === 'all' || activeTab === 'general') && (
        <section
          className="pform__section"
          style={{
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '20px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <h2 style={{ fontSize: '1.0625rem', fontWeight: 600, color: '#111827', margin: 0 }}>
              📝 Basic Information
            </h2>
            <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Core title, item code, category and publishing rules</span>
          </div>

          <div className="pform__grid pform__grid--2">
            <div className="pform__field">
              <label htmlFor="pf-name">Product Name *</label>
              <input
                id="pf-name"
                required
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                className="pform__input"
                placeholder="e.g. Heart Diamond Bracelet"
              />
            </div>
            <div className="pform__field">
              <label htmlFor="pf-itemcode">Item Code</label>
              <input
                id="pf-itemcode"
                value={form.itemCode}
                onChange={(e) => set('itemCode', e.target.value)}
                className="pform__input"
                placeholder="e.g. AJBR-74"
              />
            </div>
          </div>

          <div className="pform__grid pform__grid--2">
            <div className="pform__field">
              <label htmlFor="pf-category">Category *</label>
              <select
                id="pf-category"
                required
                value={form.category.toUpperCase()}
                onChange={(e) => set('category', e.target.value)}
                className="pform__input"
                data-testid="product-category"
              >
                {categoryOptions.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="pform__field">
              <label htmlFor="pf-status">Status *</label>
              <select
                id="pf-status"
                value={form.status}
                onChange={(e) => set('status', e.target.value as FormData['status'])}
                className="pform__input"
                data-testid="product-status"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <p className="pform__hint">
                {STATUS_OPTIONS.find((s) => s.value === form.status)?.hint}
              </p>
            </div>
          </div>

          <div className="pform__grid pform__grid--2">
            <div className="pform__field">
              <label htmlFor="pf-price-visibility">Price Visibility</label>
              <select
                id="pf-price-visibility"
                value={form.priceVisibility}
                onChange={(e) => set('priceVisibility', e.target.value as FormData['priceVisibility'])}
                className="pform__input"
                data-testid="product-price-visibility"
              >
                {PRICE_VISIBILITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <p className="pform__hint">
                {PRICE_VISIBILITY_OPTIONS.find((o) => o.value === form.priceVisibility)?.hint}
              </p>
            </div>
            <div className="pform__field">
              <label htmlFor="pf-priority">Display Priority</label>
              <input
                id="pf-priority"
                type="number"
                min="0"
                step="1"
                value={form.priority}
                onChange={(e) => set('priority', e.target.value)}
                className="pform__input"
                placeholder="0"
                data-testid="product-priority"
              />
              <p className="pform__hint">
                Controls storefront order. Priority 0 appears first, followed by 1, 2, etc.
              </p>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '16px',
              padding: '12px 14px',
              background: '#f9fafb',
              borderRadius: '6px',
              border: '1px solid #e5e7eb',
            }}
          >
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.8125rem', color: '#374151' }}>
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => set('isActive', e.target.checked)}
              />
              <span style={{ fontWeight: 500 }}>Active in catalogue reel</span>
            </label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.8125rem', color: '#374151' }}>
              <input
                type="checkbox"
                checked={form.comingSoon}
                onChange={(e) => set('comingSoon', e.target.checked)}
              />
              <span style={{ fontWeight: 500 }}>Coming Soon (Notify Me button)</span>
            </label>
          </div>

          <div className="pform__field">
            <label htmlFor="pf-description">Description</label>
            <textarea
              id="pf-description"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={3}
              className="pform__input"
              placeholder="Brief product description"
            />
          </div>

          <div className="pform__field">
            <label htmlFor="pf-designstyle">Design Style</label>
            <textarea
              id="pf-designstyle"
              value={form.designStyle}
              onChange={(e) => set('designStyle', e.target.value)}
              rows={2}
              className="pform__input"
              placeholder="e.g. Alternating open heart motifs and bezel-set round stones"
            />
          </div>
        </section>
      )}

      {/* ─── SECTION 2: PRODUCT IMAGES ─── */}
      {(activeTab === 'all' || activeTab === 'media') && (
        <section
          className="pform__section"
          style={{
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '20px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <h2 style={{ fontSize: '1.0625rem', fontWeight: 600, color: '#111827', margin: 0 }}>
              🖼️ Product Images
            </h2>
            <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
              {form.images.filter(Boolean).length} uploaded · Drag a tile to swap slots
            </span>
          </div>
          <ImageUploader images={form.images} onChange={(imgs) => set('images', imgs)} />
          <AdminProductGalleryPreview
            images={form.images}
            productName={form.name || 'Product'}
            onChange={(imgs) => set('images', imgs)}
          />
        </section>
      )}

      {/* ─── SECTION 3: FILTER LABELS & TAGS ─── */}
      {(activeTab === 'all' || activeTab === 'labels') && (
        <section
          className="pform__section"
          style={{
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '20px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
            <h2 style={{ fontSize: '1.0625rem', fontWeight: 600, color: '#111827', margin: 0 }}>
              🏷️ Category Filter Labels &amp; Tags
            </h2>
            <Link
              href="/admin/filters"
              target="_blank"
              style={{ fontSize: '0.75rem', color: '#4f46e5', textDecoration: 'none', fontWeight: 500 }}
            >
              Category Filters Manager ↗
            </Link>
          </div>

          <ProductFilterLabelsEditor
            key={`${initialData?.id ?? 'new'}-${form.category}`}
            productId={initialData?.id ?? ''}
            category={currentCategoryConfig?.categoryName || form.category}
            initialLabels={form.labels ?? []}
            availableLabels={availableLabels}
            onLabelsChange={(newLabels) => set('labels', newLabels)}
            showSaveButton={mode === 'edit' && Boolean(initialData?.id)}
          />
        </section>
      )}

      {/* ─── BUILD & PRICE (variants + diamonds + specs, one scroll) ─── */}
      {(activeTab === 'all' || activeTab === 'pricing') && (
        <AdminProductBuildPrice
          variants={activePiece?.variants ?? []}
          stones={activePiece?.stones ?? []}
          diamondRates={diamondRates}
          storePricing={storePricing}
          effectivePricing={effectivePricing}
          vaGoldPct={activePiece?.vaGoldPct ?? '10'}
          vaLabel={activePiece?.vaLabel ?? 'Value Addition'}
          totalLengthMm={form.totalLengthMm}
          motifSizeMm={form.motifSizeMm}
          thicknessMm={form.thicknessMm}
          stoneType={form.stoneType}
          stoneShape={form.stoneShape}
          stoneDimMm={form.stoneDimMm}
          gemCount={form.gemCount}
          caratWeight={form.caratWeight}
          calcBreakdown={calcEstimatedBreakdown}
          onAddVariant={addVariant}
          onRemoveVariant={removeVariant}
          onSetVariant={(idx, field, value) => setVariant(idx, field, value)}
          onAddStone={addStone}
          onRemoveStone={removeStone}
          onSetStone={(idx, field, value) => setStone(idx, field, value)}
          onSetVaGoldPct={(v) =>
            setForm((f) => {
              const pieces = [...f.pieces]
              const pi = Math.min(activePieceIdx, pieces.length - 1)
              pieces[pi] = { ...pieces[pi], vaGoldPct: v, inheritWastage: false }
              return { ...f, pieces }
            })
          }
          onSetVaLabel={(v) =>
            setForm((f) => {
              const pieces = [...f.pieces]
              const pi = Math.min(activePieceIdx, pieces.length - 1)
              pieces[pi] = { ...pieces[pi], vaLabel: v, inheritWastage: false }
              return { ...f, pieces }
            })
          }
          onSetField={(field, value) => set(field as keyof FormData, value as never)}
          pieces={form.pieces.map((p) => ({ key: p.key, id: p.id, name: p.name }))}
          activePieceIndex={Math.min(activePieceIdx, form.pieces.length - 1)}
          onSelectPiece={setActivePieceIdx}
          onAddPiece={addPiece}
          onRemovePiece={removePiece}
          onRenamePiece={renamePiece}
        />
      )}

      {/* ─── BOTTOM ACTION BAR ─── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          marginTop: '1.5rem',
          paddingTop: '1rem',
          borderTop: '1px solid #e5e7eb',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {activeTab !== 'all' && (
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              style={{
                fontSize: '0.75rem',
                color: '#6b7280',
                background: 'transparent',
                border: '1px solid #d1d5db',
                padding: '6px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              View All Sections
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="submit"
            disabled={saving}
            className="pform__submit"
            style={{
              padding: '8px 20px',
              fontSize: '0.875rem',
              fontWeight: 600,
              borderRadius: 6,
              background: saving ? '#9ca3af' : '#111827',
              color: '#ffffff',
              border: 'none',
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Saving…' : mode === 'create' ? 'Create Product' : 'Save Changes'}
          </button>
          <button
            type="button"
            onClick={() => {
              const back = parseInvoiceReturnTo(returnTo)
              if (back) router.push(back)
              else router.back()
            }}
            className="pform__cancel"
            style={{
              padding: '8px 14px',
              fontSize: '0.875rem',
              color: '#6b7280',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  )
}
