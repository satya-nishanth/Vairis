'use client'
import { useEffect, useState } from 'react'

type Rates = { '14K': number; '18K': number; fetchedAt: string }

export default function GoldRateBanner() {
  const [rates, setRates] = useState<Rates | null>(null)

  useEffect(() => {
    fetch('/api/gold-rates')
      .then((r) => r.json())
      .then((data) => {
        if (data.rates) setRates({ ...data.rates, fetchedAt: data.fetchedAt })
      })
      .catch(() => {})
  }, [])

  if (!rates) return null

  const updatedAt = new Date(rates.fetchedAt).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  })

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

  return (
    <div className="bg-brand-dark border-b border-brand-gold/10 py-1.5 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-center gap-4 md:gap-8 flex-wrap">
        <span className="text-[10px] text-brand-gold/50 tracking-[0.2em] uppercase hidden sm:block">
          Today's Gold
        </span>
        {[
          { label: '18K', value: rates['18K'] },
          { label: '14K', value: rates['14K'] },
        ].map(({ label, value }) => (
          <span key={label} className="text-[10px] text-white/60 tracking-wide">
            <span className="text-brand-gold/70 font-medium">{label}</span>
            {' '}{fmt(value)}<span className="text-white/30">/g</span>
          </span>
        ))}
        <span className="text-[10px] text-white/20 hidden md:block">
          Updated {updatedAt} IST
        </span>
      </div>
    </div>
  )
}
