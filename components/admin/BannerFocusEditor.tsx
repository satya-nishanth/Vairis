'use client'

import { useCallback, useRef } from 'react'
import type { BannerImageFit } from '@/lib/banner-image-fit'

type PreviewMode = 'web' | 'mobile'

type Props = {
  src: string
  slideLabel: string
  mode: PreviewMode
  onModeChange: (mode: PreviewMode) => void
  fit: BannerImageFit
  onChange: (fit: BannerImageFit) => void
}

const PRESETS: { id: string; label: string; x: number; y: number }[] = [
  { id: 'center', label: 'Center', x: 50, y: 50 },
  { id: 'top', label: 'Top', x: 50, y: 20 },
  { id: 'face', label: 'Face', x: 50, y: 32 },
  { id: 'left', label: 'Left', x: 25, y: 50 },
  { id: 'right', label: 'Right', x: 75, y: 50 },
]

/**
 * Visual focal-point editor: drag the pin on the photo.
 * Web / Mobile keep separate positions; live banner preview reflects the result.
 */
export function BannerFocusEditor({
  src,
  slideLabel,
  mode,
  onModeChange,
  fit,
  onChange,
}: Props) {
  const stageRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const focusX = mode === 'mobile' ? fit.mobileX : fit.webX
  const focusY = mode === 'mobile' ? fit.mobileY : fit.webY

  const applyPoint = useCallback(
    (clientX: number, clientY: number) => {
      const el = stageRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return
      const x = Math.min(100, Math.max(0, Math.round(((clientX - rect.left) / rect.width) * 100)))
      const y = Math.min(100, Math.max(0, Math.round(((clientY - rect.top) / rect.height) * 100)))
      if (mode === 'mobile') onChange({ ...fit, mobileX: x, mobileY: y })
      else onChange({ ...fit, webX: x, webY: y })
    },
    [fit, mode, onChange],
  )

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    dragging.current = true
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    applyPoint(e.clientX, e.clientY)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return
    applyPoint(e.clientX, e.clientY)
  }

  const onPointerUp = (e: React.PointerEvent) => {
    dragging.current = false
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      /* already released */
    }
  }

  function setPreset(x: number, y: number) {
    if (mode === 'mobile') onChange({ ...fit, mobileX: x, mobileY: y })
    else onChange({ ...fit, webX: x, webY: y })
  }

  function resetFocus() {
    setPreset(50, 50)
  }

  function copyWebToMobile() {
    onChange({ ...fit, mobileX: fit.webX, mobileY: fit.webY })
  }

  const aspectClass =
    mode === 'mobile' ? 'banner-focus__stage--mobile' : 'banner-focus__stage--web'

  return (
    <div className="banner-focus">
      <div className="banner-focus__head">
        <div>
          <p className="banner-focus__eyebrow">Focus point</p>
          <p className="banner-focus__title">{slideLabel}</p>
        </div>
        <div className="banner-focus__tabs" role="tablist" aria-label="Device">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'web'}
            className={mode === 'web' ? 'is-active' : undefined}
            onClick={() => onModeChange('web')}
          >
            Web
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'mobile'}
            className={mode === 'mobile' ? 'is-active' : undefined}
            onClick={() => onModeChange('mobile')}
          >
            Mobile
          </button>
        </div>
      </div>

      <div
        ref={stageRef}
        className={`banner-focus__stage ${aspectClass}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="presentation"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" draggable={false} className="banner-focus__img" />
        <div className="banner-focus__veil" aria-hidden />
        <div
          className="banner-focus__pin"
          style={{ left: `${focusX}%`, top: `${focusY}%` }}
          aria-hidden
        >
          <span className="banner-focus__pin-ring" />
          <span className="banner-focus__pin-dot" />
          <span className="banner-focus__pin-cross banner-focus__pin-cross--h" />
          <span className="banner-focus__pin-cross banner-focus__pin-cross--v" />
        </div>
        <p className="banner-focus__drag-hint">Drag to set focus</p>
      </div>

      <div className="banner-focus__presets" aria-label="Quick positions">
        {PRESETS.map((p) => {
          const active = focusX === p.x && focusY === p.y
          return (
            <button
              key={p.id}
              type="button"
              className={active ? 'is-active' : undefined}
              onClick={() => setPreset(p.x, p.y)}
            >
              {p.label}
            </button>
          )
        })}
      </div>

      <div className="banner-focus__fine">
        <label>
          <span>X</span>
          <input
            type="range"
            min={0}
            max={100}
            value={focusX}
            onChange={(e) => setPreset(Number(e.target.value), focusY)}
          />
          <em>{focusX}%</em>
        </label>
        <label>
          <span>Y</span>
          <input
            type="range"
            min={0}
            max={100}
            value={focusY}
            onChange={(e) => setPreset(focusX, Number(e.target.value))}
          />
          <em>{focusY}%</em>
        </label>
      </div>

      <div className="banner-focus__actions">
        <button type="button" className="banner-focus__btn" onClick={resetFocus}>
          Reset {mode}
        </button>
        {mode === 'mobile' && (
          <button type="button" className="banner-focus__btn" onClick={copyWebToMobile}>
            Match web focus
          </button>
        )}
        <p className="banner-focus__note">
          Pin marks what stays centered when the banner crops. Check the live preview below, then
          Save.
        </p>
      </div>
    </div>
  )
}
