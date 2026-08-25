'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  GOLD_PURITIES,
  type DiamondSetInput,
  type GoldKarat,
  type EstimatorResults,
  computeComplexEstimate,
  computeStandardEstimate,
  diamondDisplayName,
  diamondSetLineCost,
  filterDecimalInput,
  formatCurrency,
  isValidDecimal,
  isValidPercentage,
  parseNum,
  stripCommas,
} from '@/lib/jewellery-cost-estimator'
import {
  deleteCostEstimate,
  loadCostEstimateHistory,
  upsertCostEstimate,
  type CostEstimateSnapshot,
} from '@/lib/cost-estimator-history'

type Mode = 'standard' | 'complex' | 'history'

function formatToday() {
  return new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function blankDash(value: string) {
  if (value === '' || value == null || String(value).trim() === '') return '—'
  const n = parseNum(value)
  return n === null ? stripCommas(value) || '—' : String(n)
}

function isMobileBrowser() {
  return /Android|iPhone|iPad|iPod|Mobile|EdgA|EdgiOS/i.test(
    typeof navigator !== 'undefined' ? navigator.userAgent || '' : '',
  )
}

/** Plain numeric input — digits + optional decimal only. No thousand separators. */
function Field({
  label,
  value,
  onChange,
  invalid,
  error = 'Enter a valid non-negative number',
  select,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  invalid?: boolean
  error?: string
  select?: boolean
  options?: { value: string; label: string }[]
}) {
  return (
    <div className={invalid ? 'cost-est__field is-invalid' : 'cost-est__field'}>
      <label>{label}</label>
      {select && options ? (
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          value={value}
          onChange={(e) => onChange(filterDecimalInput(e.target.value))}
          placeholder="0"
        />
      )}
      <div className="cost-est__error">{error}</div>
    </div>
  )
}

function TotalsCard({ results }: { results: EstimatorResults }) {
  return (
    <div className="cost-est__totals">
      <div className="cost-est__totals-label">Final Total Cost</div>
      <div className="cost-est__totals-value">{formatCurrency(results.finalTotal)}</div>
      <div>
        <div className="cost-est__row">
          <span>Total Cost Before GST</span>
          <span>{formatCurrency(results.totalBeforeGst)}</span>
        </div>
        <div className="cost-est__row">
          <span>Gold Cost</span>
          <span>{formatCurrency(results.goldCost)}</span>
        </div>
        <div className="cost-est__row">
          <span>Diamond Cost</span>
          <span>{formatCurrency(results.diamondCost)}</span>
        </div>
        <div className="cost-est__row">
          <span>Wastage Cost</span>
          <span>{formatCurrency(results.wastageCost)}</span>
        </div>
        <div className="cost-est__row">
          <span>Making Charges Cost</span>
          <span>{formatCurrency(results.makingCost)}</span>
        </div>
        {results.additionalCost > 0 && (
          <div className="cost-est__row">
            <span>Additional Charges</span>
            <span>{formatCurrency(results.additionalCost)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function Intermediate({ results, karat }: { results: EstimatorResults; karat: GoldKarat }) {
  const purityLabel = GOLD_PURITIES[karat].label
  return (
    <div className="cost-est__section cost-est__intermediate">
      <h3>Intermediate Calculations</h3>
      <div className="cost-est__row">
        <span>Gold Rate for {purityLabel} (₹ per gram)</span>
        <span>{formatCurrency(results.effectiveGoldRate)}</span>
      </div>
      <div className="cost-est__row">
        <span>Gold Cost</span>
        <span>{formatCurrency(results.goldCost)}</span>
      </div>
      <div className="cost-est__row">
        <span>Diamond Cost</span>
        <span>{formatCurrency(results.diamondCost)}</span>
      </div>
      <div className="cost-est__row">
        <span>Wastage Cost</span>
        <span>{formatCurrency(results.wastageCost)}</span>
      </div>
      <div className="cost-est__row">
        <span>Making Charges Cost</span>
        <span>{formatCurrency(results.makingCost)}</span>
      </div>
      <div className="cost-est__row">
        <span>Total Cost Before GST</span>
        <span>{formatCurrency(results.totalBeforeGst)}</span>
      </div>
      <div className="cost-est__row">
        <span>GST Amount</span>
        <span>{formatCurrency(results.gstAmount)}</span>
      </div>
      <div className="cost-est__row">
        <span>Total Cost With GST</span>
        <span>{formatCurrency(results.totalWithGst)}</span>
      </div>
      {results.additionalCost > 0 && (
        <div className="cost-est__row">
          <span>Additional Charges</span>
          <span>{formatCurrency(results.additionalCost)}</span>
        </div>
      )}
      <div className="cost-est__row is-emph">
        <span>Final Total Cost</span>
        <span>{formatCurrency(results.finalTotal)}</span>
      </div>
    </div>
  )
}

const PURITY_OPTIONS: { value: string; label: string }[] = (
  [24, 22, 18, 14, 9] as GoldKarat[]
).map((k) => ({
  value: String(k),
  label: GOLD_PURITIES[k].label,
}))

export function CostEstimator({ initialGoldRate24k = '' }: { initialGoldRate24k?: string }) {
  const [mode, setMode] = useState<Mode>('standard')
  const [toast, setToast] = useState('')
  const [sheet, setSheet] = useState<{ url: string; hint: string; blob: Blob } | null>(null)
  const [estimateName, setEstimateName] = useState('')
  const [history, setHistory] = useState<CostEstimateSnapshot[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)

  const [stdGoldRate, setStdGoldRate] = useState(() => stripCommas(initialGoldRate24k))
  const [stdDiamondRate, setStdDiamondRate] = useState('21000')
  const [stdKarat, setStdKarat] = useState<GoldKarat>(18)
  const [stdWeight, setStdWeight] = useState('')
  const [stdCarats, setStdCarats] = useState('')
  const [stdWastage, setStdWastage] = useState('10')
  const [stdGst, setStdGst] = useState('3')
  const [stdMaking, setStdMaking] = useState('750')
  const [stdAdditional, setStdAdditional] = useState('')

  const [cxGoldRate, setCxGoldRate] = useState(() => stripCommas(initialGoldRate24k))
  const [cxKarat, setCxKarat] = useState<GoldKarat>(18)
  const [cxWeight, setCxWeight] = useState('')
  const [cxWastage, setCxWastage] = useState('10')
  const [cxGst, setCxGst] = useState('3')
  const [cxMaking, setCxMaking] = useState('750')
  const [cxAdditional, setCxAdditional] = useState('')
  const [diamondSets, setDiamondSets] = useState<DiamondSetInput[]>([
    { id: 1, name: 'Diamond 1', carats: '', costPerCarat: '' },
  ])
  const nextId = useRef(2)
  const captureRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setHistory(loadCostEstimateHistory())
  }, [])

  useEffect(() => {
    const raw = stripCommas(initialGoldRate24k)
    if (!raw) return
    setStdGoldRate((prev) => (stripCommas(prev) === '' ? raw : prev))
    setCxGoldRate((prev) => (stripCommas(prev) === '' ? raw : prev))
  }, [initialGoldRate24k])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(''), 2800)
  }, [])

  const stdResults = computeStandardEstimate({
    goldRate: filterDecimalInput(stdGoldRate),
    diamondRate: filterDecimalInput(stdDiamondRate),
    weight: filterDecimalInput(stdWeight),
    carats: filterDecimalInput(stdCarats),
    karat: stdKarat,
    wastage: filterDecimalInput(stdWastage),
    gst: filterDecimalInput(stdGst),
    making: filterDecimalInput(stdMaking),
    additional: filterDecimalInput(stdAdditional),
  })

  const cxResults = computeComplexEstimate({
    goldRate: filterDecimalInput(cxGoldRate),
    weight: filterDecimalInput(cxWeight),
    karat: cxKarat,
    wastage: filterDecimalInput(cxWastage),
    gst: filterDecimalInput(cxGst),
    making: filterDecimalInput(cxMaking),
    additional: filterDecimalInput(cxAdditional),
    diamondSets: diamondSets.map((s) => ({
      ...s,
      carats: filterDecimalInput(s.carats),
      costPerCarat: filterDecimalInput(s.costPerCarat),
    })),
  })

  const calcMode = mode === 'history' ? 'standard' : mode
  const activeResults = calcMode === 'standard' ? stdResults : cxResults
  const canShare = activeResults.finalTotal > 0

  useEffect(() => {
    return () => {
      if (sheet?.url) URL.revokeObjectURL(sheet.url)
    }
  }, [sheet])

  function buildSnapshot(name: string): CostEstimateSnapshot {
    return {
      id: editingId ?? `est_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      savedAt: new Date().toISOString(),
      mode: calcMode,
      standard: {
        goldRate: stdGoldRate,
        diamondRate: stdDiamondRate,
        karat: stdKarat,
        weight: stdWeight,
        carats: stdCarats,
        wastage: stdWastage,
        gst: stdGst,
        making: stdMaking,
        additional: stdAdditional,
      },
      complex: {
        goldRate: cxGoldRate,
        karat: cxKarat,
        weight: cxWeight,
        wastage: cxWastage,
        gst: cxGst,
        making: cxMaking,
        additional: cxAdditional,
        diamondSets,
      },
      results: activeResults,
    }
  }

  function handleSaveEstimate() {
    const name = estimateName.trim()
    if (!name) {
      showToast('Enter a name for this estimate')
      return
    }
    if (activeResults.finalTotal <= 0) {
      showToast('Fill the calculator so the total is greater than zero')
      return
    }
    const next = upsertCostEstimate(buildSnapshot(name))
    setHistory(next)
    setEditingId(next[0]?.id ?? null)
    showToast('Estimate saved')
  }

  function loadSnapshot(item: CostEstimateSnapshot) {
    setEstimateName(item.name)
    setEditingId(item.id)
    const s = item.standard
    setStdGoldRate(stripCommas(s.goldRate))
    setStdDiamondRate(stripCommas(s.diamondRate))
    setStdKarat(s.karat)
    setStdWeight(stripCommas(s.weight))
    setStdCarats(stripCommas(s.carats))
    setStdWastage(stripCommas(s.wastage))
    setStdGst(stripCommas(s.gst))
    setStdMaking(stripCommas(s.making))
    setStdAdditional(stripCommas(s.additional))
    const c = item.complex
    setCxGoldRate(stripCommas(c.goldRate))
    setCxKarat(c.karat)
    setCxWeight(stripCommas(c.weight))
    setCxWastage(stripCommas(c.wastage))
    setCxGst(stripCommas(c.gst))
    setCxMaking(stripCommas(c.making))
    setCxAdditional(stripCommas(c.additional))
    setDiamondSets(
      c.diamondSets?.length
        ? c.diamondSets.map((d) => ({
            ...d,
            carats: stripCommas(d.carats),
            costPerCarat: stripCommas(d.costPerCarat),
          }))
        : [{ id: 1, name: 'Diamond 1', carats: '', costPerCarat: '' }],
    )
    const maxId = Math.max(0, ...(c.diamondSets ?? []).map((d) => d.id))
    nextId.current = maxId + 1
    setMode(item.mode)
    showToast(`Loaded “${item.name}”`)
  }

  async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error('toBlob failed'))
        },
        'image/png',
      )
    })
  }

  function renderShareMarkup(detailed: boolean): string {
    const isComplex = calcMode === 'complex'
    const karat = isComplex ? cxKarat : stdKarat
    const results = isComplex ? cxResults : stdResults
    const goldRate = isComplex ? cxGoldRate : stdGoldRate
    const weight = isComplex ? cxWeight : stdWeight
    const purityLabel = GOLD_PURITIES[karat].label
    const today = formatToday()

    if (detailed) {
      const setsHtml =
        isComplex && diamondSets.length > 0
          ? `<div class="cost-est-detail__section"><h3>Diamond Sets</h3>${diamondSets
              .map(
                (set, i) => `
            <div class="cost-est-detail__diamond">
              <h4>${escapeHtml(diamondDisplayName(set, i + 1))}</h4>
              <div class="cost-est-share__inline">
                <div class="cost-est-detail__field" style="flex:1"><div class="lbl">Diamond Carats</div><div class="val">${blankDash(set.carats)}</div></div>
                <div class="cost-est-detail__field" style="flex:1"><div class="lbl">Cost per Carat</div><div class="val">${blankDash(set.costPerCarat)}</div></div>
              </div>
              <div style="font-size:12px;font-weight:600;margin-top:4px">Set cost: ${formatCurrency(diamondSetLineCost(set))}</div>
            </div>`,
              )
              .join('')}</div>`
          : ''

      return `<div class="cost-est-detail">
        <div class="cost-est-detail__title">Jewellery Cost Calculator</div>
        <div class="cost-est-detail__date">${today}</div>
        <div class="cost-est-detail__total"><div class="lbl">Final Total Cost</div><div class="val">${formatCurrency(results.finalTotal)}</div></div>
        <div class="cost-est-detail__cols">
          <div class="col">
            <div class="cost-est-detail__section"><h3>Market Rates</h3>
              <div class="cost-est-detail__field"><div class="lbl">Gold Rate Today (₹ per gram, 24K)</div><div class="val">${blankDash(goldRate)}</div></div>
              ${!isComplex ? `<div class="cost-est-detail__field"><div class="lbl">Diamond Rate Per Carat</div><div class="val">${blankDash(stdDiamondRate)}</div></div>` : ''}
            </div>
            <div class="cost-est-detail__section"><h3>Jewellery Details</h3>
              <div class="cost-est-detail__field"><div class="lbl">Gold Purity</div><div class="val">${purityLabel}</div></div>
              <div class="cost-est-detail__field"><div class="lbl">Gold Weight (grams)</div><div class="val">${blankDash(weight)}</div></div>
              ${!isComplex ? `<div class="cost-est-detail__field"><div class="lbl">Diamond Carats</div><div class="val">${blankDash(stdCarats)}</div></div>` : ''}
            </div>
            ${setsHtml}
            <div class="cost-est-detail__section"><h3>Additional Charges</h3>
              <div class="cost-est-detail__field"><div class="lbl">Wastage Percentage</div><div class="val">${blankDash(isComplex ? cxWastage : stdWastage)}</div></div>
              <div class="cost-est-detail__field"><div class="lbl">GST Percentage</div><div class="val">${blankDash(isComplex ? cxGst : stdGst)}</div></div>
              <div class="cost-est-detail__field"><div class="lbl">Making Charges Per Gram</div><div class="val">${blankDash(isComplex ? cxMaking : stdMaking)}</div></div>
              ${(isComplex ? cxAdditional : stdAdditional) ? `<div class="cost-est-detail__field"><div class="lbl">Additional Charges (flat amount)</div><div class="val">${blankDash(isComplex ? cxAdditional : stdAdditional)}</div></div>` : ''}
            </div>
          </div>
          <div class="col">
            <div class="cost-est-detail__section"><h3>Intermediate Calculations</h3>
              <div class="cost-est-detail__row"><span>Gold Rate for ${purityLabel} (₹ per gram)</span><span>${formatCurrency(results.effectiveGoldRate)}</span></div>
              <div class="cost-est-detail__row"><span>Gold Cost</span><span>${formatCurrency(results.goldCost)}</span></div>
              <div class="cost-est-detail__row"><span>Diamond Cost</span><span>${formatCurrency(results.diamondCost)}</span></div>
              <div class="cost-est-detail__row"><span>Wastage Cost</span><span>${formatCurrency(results.wastageCost)}</span></div>
              <div class="cost-est-detail__row"><span>Making Charges Cost</span><span>${formatCurrency(results.makingCost)}</span></div>
              <div class="cost-est-detail__row"><span>Total Cost Before GST</span><span>${formatCurrency(results.totalBeforeGst)}</span></div>
              <div class="cost-est-detail__row"><span>GST Amount</span><span>${formatCurrency(results.gstAmount)}</span></div>
              <div class="cost-est-detail__row"><span>Total Cost With GST</span><span>${formatCurrency(results.totalWithGst)}</span></div>
              ${results.additionalCost > 0 ? `<div class="cost-est-detail__row"><span>Additional Charges</span><span>${formatCurrency(results.additionalCost)}</span></div>` : ''}
              <div class="cost-est-detail__row is-emph"><span>Final Total Cost</span><span>${formatCurrency(results.finalTotal)}</span></div>
            </div>
          </div>
        </div>
      </div>`
    }

    const header = `<div class="cost-est-share__header"><div>Vairis Fine Jewellery Estimate</div><div class="cost-est-share__date">${today}</div></div>`
    const finalBlock = `<div class="cost-est-share__final"><div class="lbl">Final Total Cost</div><div class="val">${formatCurrency(results.finalTotal)}</div></div>`
    const costBlock = `<div class="cost-est-share__section" style="margin-top:8px">
      <div class="cost-est-share__row"><span class="lbl">Gold Cost</span><span class="val">${formatCurrency(results.goldCost)}</span></div>
      <div class="cost-est-share__row"><span class="lbl">Diamond Cost</span><span class="val">${formatCurrency(results.diamondCost)}</span></div>
    </div>`
    const marketBlock = `<div class="cost-est-share__section"><h3>Market Rates</h3>
      <div class="cost-est-share__field"><div class="lbl">Gold Rate Today (₹ per gram, 24K)</div><div class="val">${blankDash(goldRate)}</div></div>
      ${!isComplex ? `<div class="cost-est-share__field" style="margin-top:8px"><div class="lbl">Diamond Rate Per Carat</div><div class="val">${blankDash(stdDiamondRate)}</div></div>` : ''}
    </div>`
    const jewelleryBlock = `<div class="cost-est-share__section"><h3>Jewellery Details</h3>
      <div class="cost-est-share__field"><div class="lbl">Gold Purity</div><div class="val">${purityLabel}</div></div>
      <div class="cost-est-share__field" style="margin-top:8px"><div class="lbl">Gold Weight (grams)</div><div class="val">${blankDash(weight)}</div></div>
      ${!isComplex ? `<div class="cost-est-share__field" style="margin-top:8px"><div class="lbl">Diamond Carats</div><div class="val">${blankDash(stdCarats)}</div></div>` : ''}
    </div>`

    if (isComplex && diamondSets.length > 0) {
      const diamondBlock = `<div class="cost-est-share__section"><h3>Diamond Sets</h3>${diamondSets
        .map(
          (set, i) => `
        <div class="cost-est-share__diamond">
          <h4>${escapeHtml(diamondDisplayName(set, i + 1))}</h4>
          <div class="cost-est-share__inline">
            <div><div class="lbl" style="font-size:11px;color:var(--ce-gold-muted)">Diamond Carats</div><div class="val" style="font-size:14px">${blankDash(set.carats)}</div></div>
            <div><div class="lbl" style="font-size:11px;color:var(--ce-gold-muted)">Cost per Carat</div><div class="val" style="font-size:14px">${blankDash(set.costPerCarat)}</div></div>
          </div>
          <div class="cost-est-share__set-cost">Set cost: ${formatCurrency(diamondSetLineCost(set))}</div>
        </div>`,
        )
        .join('')}</div>`

      return `<div class="cost-est-share is-complex">${header}<div class="cost-est-share__cols"><div class="col">${finalBlock}${costBlock}${marketBlock}${jewelleryBlock}</div><div class="col">${diamondBlock}</div></div></div>`
    }

    return `<div class="cost-est-share is-standard">${header}${finalBlock}${costBlock}${marketBlock}${jewelleryBlock}</div>`
  }

  async function captureImage(detailed: boolean): Promise<Blob> {
    const html2canvas = (await import('html2canvas')).default
    const root = captureRef.current
    if (!root) throw new Error('capture root missing')
    root.innerHTML = renderShareMarkup(detailed)
    const card = root.querySelector(detailed ? '.cost-est-detail' : '.cost-est-share') as HTMLElement
    void card.offsetHeight
    const canvas = await html2canvas(card, {
      scale: isMobileBrowser() ? 1.5 : 2,
      backgroundColor: detailed ? '#f5f5f5' : '#0b241c',
      useCORS: true,
      logging: false,
      width: card.scrollWidth,
      height: card.scrollHeight,
      windowWidth: Math.max(card.scrollWidth, 1),
      windowHeight: Math.max(card.scrollHeight, 1),
      scrollX: 0,
      scrollY: 0,
      allowTaint: true,
    })
    root.innerHTML = ''
    return canvasToBlob(canvas)
  }

  function saveBlob(blob: Blob) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'vairis-estimate.png'
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }

  async function nativeShare(blob: Blob): Promise<'shared' | 'aborted' | 'failed' | 'unsupported'> {
    if (!navigator.share) return 'unsupported'
    try {
      const file = new File([blob], 'vairis-estimate.png', { type: 'image/png' })
      await navigator.share({
        files: [file],
        title: 'Vairis Fine Jewellery Estimate',
        text: 'Vairis Fine Jewellery Estimate',
      })
      return 'shared'
    } catch (error) {
      if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
        return 'aborted'
      }
      return 'failed'
    }
  }

  async function handleShare(detailed: boolean) {
    try {
      showToast('Preparing image…')
      if (!canShare) return
      const blob = await captureImage(detailed)
      const result = await nativeShare(blob)
      if (result === 'shared' || result === 'aborted') return
      const url = URL.createObjectURL(blob)
      setSheet({
        url,
        blob,
        hint:
          result === 'failed' || isMobileBrowser()
            ? 'Tap Share below to open WhatsApp or other apps. On some phones, long-press the image to save it.'
            : 'Share is not available here. Save the image, or long-press it.',
      })
    } catch {
      showToast('Unable to create estimate image. Try again.')
    }
  }

  async function handleSave(detailed: boolean) {
    try {
      showToast('Preparing image…')
      if (!canShare) return
      const blob = await captureImage(detailed)
      if (isMobileBrowser()) {
        const url = URL.createObjectURL(blob)
        setSheet({
          url,
          blob,
          hint: 'Mobile browsers often block downloads. Long-press the image to save it, or tap Share.',
        })
        saveBlob(blob)
        return
      }
      saveBlob(blob)
      showToast('Estimate image saved')
    } catch {
      showToast('Unable to save image')
    }
  }

  function closeSheet() {
    if (sheet?.url) URL.revokeObjectURL(sheet.url)
    setSheet(null)
  }

  function updateSet(id: number, patch: Partial<DiamondSetInput>) {
    setDiamondSets((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }

  return (
    <div className="cost-est">
      <div className="cost-est__header">
        <h2>
          {mode === 'standard'
            ? 'Standard Calculator'
            : mode === 'complex'
              ? 'Complex Calculator'
              : 'Saved estimates'}
        </h2>
        <span className="cost-est__date">{formatToday()}</span>
      </div>

      <div className="cost-est__tabs" role="tablist">
        <button
          type="button"
          className={mode === 'standard' ? 'is-active' : undefined}
          onClick={() => setMode('standard')}
        >
          Standard
        </button>
        <button
          type="button"
          className={mode === 'complex' ? 'is-active' : undefined}
          onClick={() => setMode('complex')}
        >
          Complex
        </button>
        <button
          type="button"
          className={mode === 'history' ? 'is-active' : undefined}
          onClick={() => {
            setHistory(loadCostEstimateHistory())
            setMode('history')
          }}
        >
          History{history.length > 0 ? ` (${history.length})` : ''}
        </button>
      </div>

      {mode !== 'history' && (
        <div className="cost-est__save-bar">
          <div className="cost-est__field">
            <label>Estimate name</label>
            <input
              type="text"
              value={estimateName}
              onChange={(e) => setEstimateName(e.target.value)}
              placeholder="e.g. Heart solitaire quote"
              autoComplete="off"
            />
          </div>
          <button type="button" className="cost-est__btn cost-est__btn--primary" onClick={handleSaveEstimate}>
            {editingId ? 'Update saved estimate' : 'Save estimate'}
          </button>
        </div>
      )}

      {mode === 'history' ? (
        <div className="cost-est__section">
          <h3>Previous estimates</h3>
          {history.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--ce-muted)', fontSize: '0.875rem' }}>
              No saved estimates yet. Name a calculation on Standard/Complex and tap Save.
            </p>
          ) : (
            <ul className="cost-est__history-list">
              {history.map((item) => (
                <li key={item.id} className="cost-est__history-item">
                  <div>
                    <div style={{ fontWeight: 600 }}>{item.name}</div>
                    <div className="cost-est__history-meta">
                      {item.mode === 'standard' ? 'Standard' : 'Complex'} ·{' '}
                      {new Date(item.savedAt).toLocaleString('en-IN')} ·{' '}
                      {formatCurrency(item.results.finalTotal)}
                    </div>
                  </div>
                  <div className="cost-est__history-actions">
                    <button
                      type="button"
                      className="cost-est__btn cost-est__btn--primary"
                      onClick={() => loadSnapshot(item)}
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      className="cost-est__btn cost-est__btn--danger"
                      onClick={() => {
                        setHistory(deleteCostEstimate(item.id))
                        if (editingId === item.id) setEditingId(null)
                        showToast('Deleted')
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : mode === 'standard' ? (
        <>
          <TotalsCard results={stdResults} />
          <div className="cost-est__section">
            <h3>Market Rates</h3>
            <div className="cost-est__field-row">
              <Field
                label="Gold Rate Today (₹ per gram, 24K)"
                value={stdGoldRate}
                onChange={setStdGoldRate}
                invalid={!isValidDecimal(stripCommas(stdGoldRate))}
              />
              <Field
                label="Diamond Rate Per Carat"
                value={stdDiamondRate}
                onChange={setStdDiamondRate}
                invalid={!isValidDecimal(stripCommas(stdDiamondRate))}
              />
            </div>
          </div>
          <div className="cost-est__section">
            <h3>Jewellery Details</h3>
            <Field
              label="Gold Purity"
              value={String(stdKarat)}
              onChange={(v) => setStdKarat(Number(v) as GoldKarat)}
              select
              options={PURITY_OPTIONS}
            />
            <div className="cost-est__field-row">
              <Field
                label="Gold Weight (grams)"
                value={stdWeight}
                onChange={setStdWeight}
                invalid={!isValidDecimal(stripCommas(stdWeight))}
              />
              <Field
                label="Diamond Carats"
                value={stdCarats}
                onChange={setStdCarats}
                invalid={!isValidDecimal(stripCommas(stdCarats))}
              />
            </div>
          </div>
          <div className="cost-est__section">
            <h3>Additional Charges</h3>
            <Field
              label="Wastage Percentage"
              value={stdWastage}
              onChange={setStdWastage}
              invalid={!isValidPercentage(stripCommas(stdWastage))}
              error="Enter a percentage between 0 and 100"
            />
            <Field
              label="GST Percentage"
              value={stdGst}
              onChange={setStdGst}
              invalid={!isValidPercentage(stripCommas(stdGst))}
              error="Enter a percentage between 0 and 100"
            />
            <Field
              label="Making Charges Per Gram"
              value={stdMaking}
              onChange={setStdMaking}
              invalid={!isValidDecimal(stripCommas(stdMaking))}
            />
            <Field
              label="Additional Charges (flat amount)"
              value={stdAdditional}
              onChange={setStdAdditional}
              invalid={!isValidDecimal(stripCommas(stdAdditional))}
            />
          </div>
        </>
      ) : (
        <>
          <TotalsCard results={cxResults} />
          <div className="cost-est__layout is-two-col">
            <div className="cost-est__col">
              <div className="cost-est__section">
                <h3>Market Rates</h3>
                <Field
                  label="Gold Rate Today (₹ per gram, 24K)"
                  value={cxGoldRate}
                  onChange={setCxGoldRate}
                  invalid={!isValidDecimal(stripCommas(cxGoldRate))}
                />
              </div>
              <div className="cost-est__section">
                <h3>Jewellery Details</h3>
                <Field
                  label="Gold Purity"
                  value={String(cxKarat)}
                  onChange={(v) => setCxKarat(Number(v) as GoldKarat)}
                  select
                  options={PURITY_OPTIONS}
                />
                <Field
                  label="Gold Weight (grams)"
                  value={cxWeight}
                  onChange={setCxWeight}
                  invalid={!isValidDecimal(stripCommas(cxWeight))}
                />
              </div>
              <div className="cost-est__section">
                <h3>Additional Charges</h3>
                <Field
                  label="Wastage Percentage"
                  value={cxWastage}
                  onChange={setCxWastage}
                  invalid={!isValidPercentage(stripCommas(cxWastage))}
                  error="Enter a percentage between 0 and 100"
                />
                <Field
                  label="GST Percentage"
                  value={cxGst}
                  onChange={setCxGst}
                  invalid={!isValidPercentage(stripCommas(cxGst))}
                  error="Enter a percentage between 0 and 100"
                />
                <Field
                  label="Making Charges Per Gram"
                  value={cxMaking}
                  onChange={setCxMaking}
                  invalid={!isValidDecimal(stripCommas(cxMaking))}
                />
                <Field
                  label="Additional Charges (flat amount)"
                  value={cxAdditional}
                  onChange={setCxAdditional}
                  invalid={!isValidDecimal(stripCommas(cxAdditional))}
                />
              </div>
            </div>
            <div className="cost-est__col">
              <div className="cost-est__section">
                <h3>Diamond Sets</h3>
                {diamondSets.map((set, i) => (
                  <div key={set.id} className="cost-est__diamond">
                    <div className="cost-est__diamond-head">
                      <h4>{diamondDisplayName(set, i + 1)}</h4>
                      {diamondSets.length > 1 && (
                        <button
                          type="button"
                          className="cost-est__btn cost-est__btn--danger"
                          onClick={() =>
                            setDiamondSets((prev) => prev.filter((s) => s.id !== set.id))
                          }
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="cost-est__field">
                      <label>Diamond set name</label>
                      <input
                        type="text"
                        value={set.name}
                        onChange={(e) => updateSet(set.id, { name: e.target.value })}
                      />
                    </div>
                    <div className="cost-est__diamond-grid">
                      <div className="cost-est__field">
                        <label>Carats</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          autoCorrect="off"
                          spellCheck={false}
                          value={set.carats}
                          onChange={(e) =>
                            updateSet(set.id, { carats: filterDecimalInput(e.target.value) })
                          }
                        />
                      </div>
                      <div className="cost-est__field">
                        <label>Cost per Carat</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          autoCorrect="off"
                          spellCheck={false}
                          value={set.costPerCarat}
                          onChange={(e) =>
                            updateSet(set.id, {
                              costPerCarat: filterDecimalInput(e.target.value),
                            })
                          }
                        />
                      </div>
                    </div>
                    <div style={{ marginTop: 8, fontSize: '0.85rem', color: 'var(--ce-muted)' }}>
                      Set cost:{' '}
                      <strong style={{ color: 'var(--ce-text)' }}>
                        {formatCurrency(diamondSetLineCost(set))}
                      </strong>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="cost-est__btn cost-est__btn--outline"
                  onClick={() => {
                    const n = diamondSets.length + 1
                    setDiamondSets((prev) => [
                      ...prev,
                      {
                        id: nextId.current++,
                        name: `Diamond ${n}`,
                        carats: '',
                        costPerCarat: '',
                      },
                    ])
                  }}
                >
                  + Add another diamond set
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {mode !== 'history' && (
        <>
          <div className="cost-est__btn-row">
            <button
              type="button"
              className="cost-est__btn cost-est__btn--primary"
              disabled={!canShare}
              onClick={() => handleShare(false)}
            >
              Share
            </button>
            <button
              type="button"
              className="cost-est__btn cost-est__btn--outline"
              disabled={!canShare}
              onClick={() => handleSave(false)}
            >
              Save Image
            </button>
          </div>

          <Intermediate
            results={activeResults}
            karat={calcMode === 'standard' ? stdKarat : cxKarat}
          />

          <div className="cost-est__btn-row is-stack">
            <button
              type="button"
              className="cost-est__btn cost-est__btn--share"
              disabled={!canShare}
              onClick={() => handleShare(true)}
            >
              Share with all details
            </button>
            <button
              type="button"
              className="cost-est__btn cost-est__btn--share-dark"
              disabled={!canShare}
              onClick={() => handleSave(true)}
            >
              Save image with all details
            </button>
          </div>
        </>
      )}

      <div ref={captureRef} className="cost-est__capture" aria-hidden />

      <div className={toast ? 'cost-est__toast is-show' : 'cost-est__toast'} role="status">
        {toast}
      </div>

      <div
        className={sheet ? 'cost-est__sheet is-open' : 'cost-est__sheet'}
        onClick={(e) => {
          if (e.target === e.currentTarget) closeSheet()
        }}
      >
        {sheet && (
          <div className="cost-est__sheet-card">
            <p className="cost-est__sheet-hint">{sheet.hint}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={sheet.url} alt="Estimate preview" />
            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button
                type="button"
                className="cost-est__btn cost-est__btn--primary"
                onClick={async () => {
                  const result = await nativeShare(sheet.blob)
                  if (result === 'shared' || result === 'aborted') closeSheet()
                  else showToast('Unable to open share. Long-press the image to save it.')
                }}
              >
                Share
              </button>
            )}
            <button
              type="button"
              className="cost-est__btn cost-est__btn--outline"
              onClick={() => {
                saveBlob(sheet.blob)
                showToast('If nothing downloaded, long-press the image to save it')
              }}
            >
              Save image
            </button>
            <button type="button" className="cost-est__btn cost-est__btn--outline" onClick={closeSheet}>
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function escapeHtml(str: string) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
