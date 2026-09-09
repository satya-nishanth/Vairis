'use client'

export function PrintButton() {
  return (
    <button type="button" className="admin-btn" onClick={() => window.print()}>
      Print / Save PDF
    </button>
  )
}
