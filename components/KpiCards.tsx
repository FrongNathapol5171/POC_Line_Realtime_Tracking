'use client'

import type { LucideIcon } from 'lucide-react'

interface KpiCard {
  label: string
  sublabel: string
  value: number | string
  Icon: LucideIcon
  iconBg: string
  iconColor: string
  pct: number
  trend: string
  trendColor?: string
}

interface Props { cards: KpiCard[] }

export default function KpiCards({ cards }: Props) {
  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
      {cards.map(card => (
        <div
          key={card.label}
          className="card p-5 flex flex-col gap-1 transition-transform duration-200 hover:-translate-y-1"
        >
          {/* Icon + label row */}
          <div className="flex items-center gap-3 mb-2">
            <div className="kpi-icon-circle" style={{ background: card.iconBg }}>
              <card.Icon size={22} strokeWidth={2} style={{ color: card.iconColor }} />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide leading-tight">
                {card.label}
              </p>
              <p className="text-xs text-gray-300 leading-tight">{card.sublabel}</p>
            </div>
          </div>

          {/* Big number */}
          <p className="text-4xl font-bold text-gray-900 leading-none tracking-tight">{card.value}</p>

          {/* Progress bar */}
          <div className="progress-bar-track">
            <div className="progress-bar-fill" style={{ width: `${Math.min(card.pct, 100)}%` }} />
          </div>

          {/* Trend */}
          <p className="text-xs font-semibold mt-1" style={{ color: card.trendColor ?? '#f97316' }}>
            {card.trend}
          </p>
        </div>
      ))}
    </div>
  )
}
