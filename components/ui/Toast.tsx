'use client'

import { useEffect } from 'react'
import { type LucideIcon, CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react'

export type ToastType = 'success' | 'warning' | 'error' | 'info'

interface Props {
  type: ToastType
  message: string
  onClose: () => void
  duration?: number  // ms, 0 = sticky
}

const CFG: Record<ToastType, { Icon: LucideIcon, bg: string, color: string, bar: string }> = {
  success: { Icon: CheckCircle2, bg: '#f0fdf4', color: '#15803d', bar: '#22c55e' },
  warning: { Icon: AlertTriangle, bg: '#fffbeb', color: '#b45309', bar: '#f59e0b' },
  error:   { Icon: XCircle,      bg: '#fef2f2', color: '#b91c1c', bar: '#ef4444' },
  info:    { Icon: Info,         bg: '#eff6ff', color: '#1d4ed8', bar: '#3b82f6' },
}

export default function Toast({ type, message, onClose, duration = 3500 }: Props) {
  const cfg = CFG[type]

  useEffect(() => {
    if (!duration) return
    const t = setTimeout(onClose, duration)
    return () => clearTimeout(t)
  }, [duration, onClose])

  return (
    <div
      className="fixed top-6 right-6 z-[110] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-xl min-w-[280px] max-w-sm"
      style={{ background: cfg.bg, border: `1.5px solid ${cfg.bar}33`, animation: 'toastIn .25s cubic-bezier(.34,1.56,.64,1)' }}
    >
      {/* Left bar */}
      <div className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full" style={{ background: cfg.bar }} />

      <cfg.Icon size={20} style={{ color: cfg.color, flexShrink: 0 }} />
      <p className="text-sm font-semibold flex-1 leading-snug" style={{ color: cfg.color }}>{message}</p>
      <button onClick={onClose} className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-black/10 transition-colors flex-shrink-0">
        <X size={12} style={{ color: cfg.color }} />
      </button>

      <style>{`
        @keyframes toastIn {
          from { opacity:0; transform: translateX(20px) scale(.95); }
          to   { opacity:1; transform: translateX(0)    scale(1);   }
        }
      `}</style>
    </div>
  )
}
