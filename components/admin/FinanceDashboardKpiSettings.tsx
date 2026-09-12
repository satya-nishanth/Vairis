'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CategoryRow } from '@/components/admin/FinanceCategoriesManager'
import type { FinanceKpiSettings } from '@/lib/finance-settings'

const BORDER = '#e5e7eb'
const GREEN = '#032b24'

export function FinanceDashboardKpiSettings({
  categories,
  initial,
}: {
  categories: CategoryRow[]
  initial: FinanceKpiSettings
}) {
  const router = useRouter()
  const [cashInflowIds, setCashInflowIds] = useState<string[]>(initial.cashInflowCategoryIds)
  const [expenseIds, setExpenseIds] = useState<string[]>(initial.generalExpenseCategoryIds)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const inflowCats = useMemo(
    () => categories.filter((c) => c.direction === 'INFLOW' && c.active),
    [categories],
  )
  const outflowCats = useMemo(
    () => categories.filter((c) => c.direction === 'OUTFLOW' && c.active),
    [categories],
  )

  function toggle(list: string[], id: string, set: (next: string[]) => void) {
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id])
    setSaved(false)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const res = await fetch('/api/admin/finance/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cashInflowCategoryIds: cashInflowIds,
          generalExpenseCategoryIds: expenseIds,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? 'Could not save')
        return
      }
      setCashInflowIds(json.cashInflowCategoryIds ?? cashInflowIds)
      setExpenseIds(json.generalExpenseCategoryIds ?? expenseIds)
      setSaved(true)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(e) => void save(e)} style={{ display: 'grid', gap: 20, maxWidth: 640 }}>
      <p style={{ fontSize: '0.8125rem', color: '#6b7280', margin: 0, lineHeight: 1.45 }}>
        Choose which cashbook categories feed the dashboard <strong>Cash inflow</strong> and{' '}
        <strong>General expenses</strong> KPIs. Leave a list empty to keep the default: all inflows,
        or all outflows except inventory purchases (by category / purchase bill / inventory link).
      </p>

      <CategoryChecklist
        title="Cash inflow categories"
        hint="INFLOW categories only. Empty = all inflows."
        options={inflowCats}
        selected={cashInflowIds}
        onToggle={(id) => toggle(cashInflowIds, id, setCashInflowIds)}
        onClear={() => {
          setCashInflowIds([])
          setSaved(false)
        }}
      />

      <CategoryChecklist
        title="General expenses categories"
        hint="OUTFLOW categories only. Empty = all outflows except inventory purchases."
        options={outflowCats}
        selected={expenseIds}
        onToggle={(id) => toggle(expenseIds, id, setExpenseIds)}
        onClear={() => {
          setExpenseIds([])
          setSaved(false)
        }}
      />

      {error ? (
        <p style={{ margin: 0, color: '#b91c1c', fontSize: '0.8125rem' }} role="alert">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p style={{ margin: 0, color: GREEN, fontSize: '0.8125rem' }}>Saved. Dashboard KPIs will use this.</p>
      ) : null}

      <div>
        <button
          type="submit"
          disabled={saving}
          className="admin-btn"
          style={{
            background: GREEN,
            color: '#fff',
            border: 'none',
            padding: '10px 18px',
            borderRadius: 8,
            fontWeight: 600,
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Saving…' : 'Save KPI categories'}
        </button>
      </div>
    </form>
  )
}

function CategoryChecklist({
  title,
  hint,
  options,
  selected,
  onToggle,
  onClear,
}: {
  title: string
  hint: string
  options: CategoryRow[]
  selected: string[]
  onToggle: (id: string) => void
  onClear: () => void
}) {
  return (
    <fieldset
      style={{
        margin: 0,
        padding: 14,
        border: `1px solid ${BORDER}`,
        borderRadius: 10,
        background: '#fff',
      }}
    >
      <legend style={{ fontSize: '0.875rem', fontWeight: 700, color: '#111827', padding: '0 6px' }}>
        {title}
      </legend>
      <p style={{ margin: '0 0 10px', fontSize: '0.75rem', color: '#6b7280' }}>{hint}</p>
      {options.length === 0 ? (
        <p style={{ margin: 0, fontSize: '0.8125rem', color: '#6b7280' }}>No active categories.</p>
      ) : (
        <div style={{ display: 'grid', gap: 6 }}>
          {options.map((c) => (
            <label
              key={c.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: '0.8125rem',
                color: '#111827',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={selected.includes(c.id)}
                onChange={() => onToggle(c.id)}
                style={{ accentColor: GREEN }}
              />
              {c.name}
            </label>
          ))}
        </div>
      )}
      {selected.length > 0 ? (
        <button
          type="button"
          onClick={onClear}
          style={{
            marginTop: 10,
            border: 'none',
            background: 'transparent',
            color: GREEN,
            fontSize: '0.75rem',
            fontWeight: 600,
            cursor: 'pointer',
            padding: 0,
          }}
        >
          Clear selection (use default)
        </button>
      ) : null}
    </fieldset>
  )
}
