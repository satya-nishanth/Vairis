'use client'

import { useState, useTransition } from 'react'

type Props = {
  productId: string
  category: string
  initialLabels: string[]
  availableLabels: string[]
  onLabelsChange?: (labels: string[]) => void
  showSaveButton?: boolean
  className?: string
}

export function ProductFilterLabelsEditor({
  productId,
  category,
  initialLabels,
  availableLabels: initialAvailable,
  onLabelsChange,
  showSaveButton = true,
  className = '',
}: Props) {
  const [assignedLabels, setAssignedLabels] = useState<string[]>(initialLabels)
  const [allAvailable, setAllAvailable] = useState<string[]>(() => {
    const set = new Set([...initialAvailable, ...initialLabels])
    return Array.from(set)
  })
  const [customInput, setCustomInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [, startTransition] = useTransition()

  // Track if current state differs from initialLabels
  const hasChanges =
    assignedLabels.length !== initialLabels.length ||
    assignedLabels.some((l) => !initialLabels.includes(l))

  const handleToggle = (label: string) => {
    setSaveStatus('idle')
    let next: string[]
    if (assignedLabels.includes(label)) {
      next = assignedLabels.filter((l) => l !== label)
    } else {
      next = [...assignedLabels, label]
    }
    setAssignedLabels(next)
    onLabelsChange?.(next)
  }

  const handleAddCustom = (e?: React.FormEvent) => {
    e?.preventDefault()
    const trimmed = customInput.trim()
    if (!trimmed) return

    setSaveStatus('idle')
    if (!allAvailable.includes(trimmed)) {
      setAllAvailable((prev) => [...prev, trimmed])
    }
    if (!assignedLabels.includes(trimmed)) {
      const next = [...assignedLabels, trimmed]
      setAssignedLabels(next)
      onLabelsChange?.(next)
    }
    setCustomInput('')
  }

  const handleSave = async () => {
    if (!productId) return
    setSaving(true)
    setSaveStatus('idle')
    setStatusMessage('')

    try {
      const res = await fetch(`/api/admin/products/${productId}/labels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labels: assignedLabels }),
      })

      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? 'Failed to save labels')
      }

      const data = await res.json()
      if (Array.isArray(data.labels)) {
        setAssignedLabels(data.labels)
        onLabelsChange?.(data.labels)
      }
      if (Array.isArray(data.availableLabels)) {
        setAllAvailable(data.availableLabels)
      }

      setSaveStatus('success')
      setStatusMessage('Filter labels saved successfully!')
      setTimeout(() => setSaveStatus('idle'), 3500)
    } catch (err: any) {
      setSaveStatus('error')
      setStatusMessage(err?.message || 'Error saving filter labels')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setAssignedLabels(initialLabels)
    onLabelsChange?.(initialLabels)
    setSaveStatus('idle')
  }

  const unassignedAvailable = allAvailable.filter((l) => !assignedLabels.includes(l))

  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3 dark:border-gray-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-gray-900 dark:text-gray-100">
              🏷️ Filter Labels / Tags
            </span>
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              {category}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Click to assign or remove labels. These power storefront PLP filters and product badges.
          </p>
        </div>

        {showSaveButton && (
          <div className="flex items-center gap-2">
            {hasChanges && (
              <button
                type="button"
                onClick={handleReset}
                disabled={saving}
                className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 underline"
              >
                Reset
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all ${
                saving
                  ? 'bg-blue-400 cursor-not-allowed'
                  : hasChanges
                  ? 'bg-blue-600 hover:bg-blue-700 ring-2 ring-blue-500/20'
                  : 'bg-gray-800 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600'
              }`}
            >
              {saving ? (
                <>
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Saving...
                </>
              ) : (
                <>
                  <span>Save Labels</span>
                  {hasChanges && <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />}
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Status Alert */}
      {saveStatus === 'success' && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
          <span>✓</span>
          <span>{statusMessage}</span>
        </div>
      )}
      {saveStatus === 'error' && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800">
          <span>⚠️</span>
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Currently Assigned Labels */}
      <div className="mt-3.5">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
          Assigned to this product ({assignedLabels.length})
        </div>
        {assignedLabels.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {assignedLabels.map((lbl) => (
              <span
                key={lbl}
                className="group inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50/80 px-2.5 py-1 text-xs font-medium text-blue-900 transition-all hover:border-rose-300 hover:bg-rose-50 hover:text-rose-900 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-200 dark:hover:border-rose-800 dark:hover:bg-rose-950/60 dark:hover:text-rose-200"
              >
                <span className="text-blue-600 dark:text-blue-400 group-hover:hidden">✓</span>
                <span className="hidden text-rose-600 dark:text-rose-400 group-hover:inline">✕</span>
                <span>{lbl}</span>
                <button
                  type="button"
                  onClick={() => handleToggle(lbl)}
                  title={`Remove ${lbl}`}
                  className="ml-0.5 text-blue-400 hover:text-rose-600 dark:text-blue-400 dark:hover:text-rose-400"
                >
                  <span className="sr-only">Remove {lbl}</span>
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic">No labels assigned yet.</p>
        )}
      </div>

      {/* Available Labels to quickly add */}
      {unassignedAvailable.length > 0 && (
        <div className="mt-3.5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
            Available in category (click to assign)
          </div>
          <div className="flex flex-wrap gap-1.5">
            {unassignedAvailable.map((lbl) => (
              <button
                key={lbl}
                type="button"
                onClick={() => handleToggle(lbl)}
                className="inline-flex items-center gap-1 rounded-lg border border-dashed border-gray-300 bg-gray-50/60 px-2 py-1 text-xs font-medium text-gray-600 transition-colors hover:border-blue-400 hover:bg-blue-50/50 hover:text-blue-700 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300 dark:hover:border-blue-700 dark:hover:bg-blue-950/50 dark:hover:text-blue-300"
                title={`Assign ${lbl}`}
              >
                <span className="text-gray-400">+</span>
                <span>{lbl}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Add Custom Label */}
      <form onSubmit={handleAddCustom} className="mt-3.5 flex items-center gap-2">
        <input
          type="text"
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          placeholder="Add custom label (e.g. Vintage, Floral)..."
          className="flex-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs text-gray-900 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
        />
        <button
          type="submit"
          disabled={!customInput.trim()}
          className="rounded-lg border border-gray-300 bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          + Add
        </button>
      </form>
    </div>
  )
}
