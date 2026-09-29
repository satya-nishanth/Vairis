'use client'

import { useState } from 'react'

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
  const [assignedLabels, setAssignedLabels] = useState<string[]>(() => initialLabels ?? [])
  const [allAvailable, setAllAvailable] = useState<string[]>(() => {
    const set = new Set([...(initialAvailable ?? []), ...(initialLabels ?? [])])
    return Array.from(set)
  })
  const [customInput, setCustomInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [statusMessage, setStatusMessage] = useState('')

  // Track if current state differs from initialLabels
  const hasChanges =
    assignedLabels.length !== (initialLabels?.length ?? 0) ||
    assignedLabels.some((l) => !initialLabels?.includes(l))

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
    setAssignedLabels(initialLabels ?? [])
    onLabelsChange?.(initialLabels ?? [])
    setSaveStatus('idle')
  }

  const unassignedAvailable = allAvailable.filter((l) => !assignedLabels.includes(l))

  return (
    <div
      className={className}
      style={{
        background: '#f9fafb',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
      }}
    >
      <style>{`
        @keyframes pfl-spin {
          to { transform: rotate(360deg); }
        }
        .pfl-tag-assigned {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 11px;
          border-radius: 16px;
          font-size: 12px;
          font-family: inherit;
          font-weight: 500;
          background: #eff6ff;
          color: #1e40af;
          border: 1px solid #bfdbfe;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .pfl-tag-assigned:hover {
          background: #fef2f2 !important;
          border-color: #fca5a5 !important;
          color: #b91c1c !important;
        }
        .pfl-tag-assigned:hover .pfl-icon-check {
          display: none;
        }
        .pfl-tag-assigned .pfl-icon-cross {
          display: none;
        }
        .pfl-tag-assigned:hover .pfl-icon-cross {
          display: inline !important;
        }
        .pfl-tag-available {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 11px;
          border-radius: 16px;
          font-size: 12px;
          font-family: inherit;
          font-weight: 500;
          background: #ffffff;
          color: #374151;
          border: 1px dashed #d1d5db;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .pfl-tag-available:hover {
          background: #eff6ff !important;
          border-color: #93c5fd !important;
          color: #1d4ed8 !important;
        }
        .pfl-btn-save:hover:not(:disabled) {
          opacity: 0.92;
        }
      `}</style>

      {/* Header Row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap',
          borderBottom: '1px solid #e5e7eb',
          paddingBottom: '12px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>
              🏷️ Filter Labels &amp; Tags
            </span>
            <span
              style={{
                display: 'inline-block',
                fontSize: '0.6875rem',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '9999px',
                background: '#eff6ff',
                color: '#1d4ed8',
                border: '1px solid #bfdbfe',
                textTransform: 'capitalize',
              }}
            >
              {category}
            </span>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#6b7280', lineHeight: 1.4 }}>
            Assign or remove style labels for this product. These power storefront PLP filters (e.g. Studs, Hoops, Everyday Wear) and search badges.
          </p>
        </div>

        {showSaveButton && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {hasChanges && (
              <button
                type="button"
                onClick={handleReset}
                disabled={saving}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#6b7280',
                  fontSize: '0.75rem',
                  fontFamily: 'inherit',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  padding: '4px 6px',
                }}
              >
                Reset
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="pfl-btn-save"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontFamily: 'inherit',
                fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
                border: '1px solid transparent',
                background: saving ? '#9ca3af' : hasChanges ? '#2563eb' : '#111827',
                color: '#ffffff',
                boxShadow: hasChanges ? '0 0 0 2px rgba(37, 99, 235, 0.2)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              {saving ? (
                <>
                  <span
                    style={{
                      display: 'inline-block',
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      border: '2px solid #ffffff',
                      borderTopColor: 'transparent',
                      animation: 'pfl-spin 0.6s linear infinite',
                    }}
                  />
                  Saving...
                </>
              ) : (
                <>
                  <span>Save Labels</span>
                  {hasChanges && (
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: '#fbbf24',
                        display: 'inline-block',
                      }}
                    />
                  )}
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Status Alerts */}
      {saveStatus === 'success' && (
        <div
          style={{
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '0.75rem',
            fontWeight: 500,
            background: '#ecfdf5',
            color: '#065f46',
            border: '1px solid #a7f3d0',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span>✓</span>
          <span>{statusMessage}</span>
        </div>
      )}
      {saveStatus === 'error' && (
        <div
          style={{
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '0.75rem',
            fontWeight: 500,
            background: '#fef2f2',
            color: '#991b1b',
            border: '1px solid #fecaca',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span>⚠️</span>
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Assigned Labels */}
      <div>
        <div
          style={{
            fontSize: '0.6875rem',
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#4b5563',
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span>Assigned to this product</span>
          <span
            style={{
              fontSize: '0.6875rem',
              fontWeight: 600,
              background: '#e0e7ff',
              color: '#3730a3',
              padding: '1px 6px',
              borderRadius: '9999px',
            }}
          >
            {assignedLabels.length}
          </span>
        </div>

        {assignedLabels.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {assignedLabels.map((lbl) => (
              <button
                key={lbl}
                type="button"
                className="pfl-tag-assigned"
                onClick={() => handleToggle(lbl)}
                title={`Click to remove "${lbl}"`}
              >
                <span className="pfl-icon-check" style={{ fontSize: '11px', color: '#2563eb' }}>
                  ✓
                </span>
                <span className="pfl-icon-cross" style={{ fontSize: '11px', color: '#dc2626' }}>
                  ✕
                </span>
                <span>{lbl}</span>
                <span
                  style={{
                    marginLeft: '2px',
                    fontSize: '13px',
                    lineHeight: 1,
                    opacity: 0.7,
                  }}
                >
                  ×
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#9ca3af', fontStyle: 'italic' }}>
            No labels assigned yet. Click from the available category labels below or add a custom one.
          </p>
        )}
      </div>

      {/* Available Labels to quickly add */}
      {unassignedAvailable.length > 0 && (
        <div>
          <div
            style={{
              fontSize: '0.6875rem',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#6b7280',
              marginBottom: '8px',
            }}
          >
            Available in category (click to assign)
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {unassignedAvailable.map((lbl) => (
              <button
                key={lbl}
                type="button"
                onClick={() => handleToggle(lbl)}
                className="pfl-tag-available"
                title={`Assign "${lbl}" to this product`}
              >
                <span style={{ color: '#9ca3af', fontWeight: 600, fontSize: '13px', lineHeight: 1 }}>
                  +
                </span>
                <span>{lbl}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Add Custom Label Row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          paddingTop: '8px',
          borderTop: '1px solid #e5e7eb',
        }}
      >
        <input
          type="text"
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              e.stopPropagation()
              handleAddCustom()
            }
          }}
          placeholder="Add custom label (e.g. Cocktail, Floral, Vintage)..."
          style={{
            flex: 1,
            maxWidth: '320px',
            padding: '7px 11px',
            fontSize: '0.75rem',
            fontFamily: 'inherit',
            color: '#111827',
            background: '#ffffff',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={() => handleAddCustom()}
          disabled={!customInput.trim()}
          style={{
            padding: '7px 14px',
            fontSize: '0.75rem',
            fontFamily: 'inherit',
            fontWeight: 500,
            borderRadius: '6px',
            border: '1px solid #d1d5db',
            background: customInput.trim() ? '#111827' : '#f3f4f6',
            color: customInput.trim() ? '#ffffff' : '#9ca3af',
            cursor: customInput.trim() ? 'pointer' : 'default',
            transition: 'all 0.15s ease',
          }}
        >
          + Add Label
        </button>
      </div>
    </div>
  )
}
