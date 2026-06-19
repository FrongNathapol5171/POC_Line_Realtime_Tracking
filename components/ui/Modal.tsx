'use client'

import { useEffect } from 'react'
import { type LucideIcon, CheckCircle2, AlertTriangle, XCircle, HelpCircle, X } from 'lucide-react'

export type ModalType = 'success' | 'warning' | 'error' | 'confirm' | 'info'

interface Props {
  type: ModalType
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm?: () => void
  onCancel?: () => void
  onClose?: () => void
}

const CONFIG: Record<ModalType, {
  Icon: LucideIcon
  iconBg: string
  iconColor: string
  btnColor: string
  btnShadow: string
}> = {
  success: {
    Icon: CheckCircle2,
    iconBg: '#f0fdf4', iconColor: '#16a34a',
    btnColor: 'linear-gradient(160deg,#34d399,#059669)',
    btnShadow: '0 4px 16px rgba(5,150,105,.4)',
  },
  warning: {
    Icon: AlertTriangle,
    iconBg: '#fffbeb', iconColor: '#d97706',
    btnColor: 'linear-gradient(160deg,#fbbf24,#d97706)',
    btnShadow: '0 4px 16px rgba(217,119,6,.4)',
  },
  error: {
    Icon: XCircle,
    iconBg: '#fef2f2', iconColor: '#dc2626',
    btnColor: 'linear-gradient(160deg,#f87171,#dc2626)',
    btnShadow: '0 4px 16px rgba(220,38,38,.4)',
  },
  confirm: {
    Icon: HelpCircle,
    iconBg: '#eef3f7', iconColor: '#22394d',
    btnColor: 'linear-gradient(160deg,#2c4d67,#22394d)',
    btnShadow: '0 4px 16px rgba(34,57,77,.4)',
  },
  info: {
    Icon: HelpCircle,
    iconBg: '#eff6ff', iconColor: '#3b82f6',
    btnColor: 'linear-gradient(160deg,#60a5fa,#3b82f6)',
    btnShadow: '0 4px 16px rgba(59,130,246,.4)',
  },
}

export default function Modal({
  type, title, message,
  confirmLabel = type === 'confirm' ? 'Confirm' : 'OK',
  cancelLabel = 'Cancel',
  onConfirm, onCancel, onClose,
}: Props) {
  const cfg = CONFIG[type]
  const close = onClose ?? onCancel ?? onConfirm ?? (() => {})

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [close])

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-6"
      style={{ background: 'rgba(15,23,42,.45)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) close() }}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 relative"
        style={{ animation: 'modalIn .2s cubic-bezier(.34,1.56,.64,1)' }}
      >
        {/* Close X */}
        <button
          onClick={close}
          className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
        >
          <X size={14} className="text-gray-500" />
        </button>

        {/* Icon */}
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
          style={{ background: cfg.iconBg }}
        >
          <cfg.Icon size={30} style={{ color: cfg.iconColor }} />
        </div>

        {/* Content */}
        <h2 className="text-xl font-bold text-gray-900 mb-2 leading-tight">{title}</h2>
        <p className="text-base text-gray-500 leading-relaxed mb-7">{message}</p>

        {/* Actions */}
        <div className="flex gap-3">
          {/* Primary action */}
          <button
            onClick={onConfirm ?? close}
            className="flex-1 py-3 px-6 rounded-2xl text-white font-semibold text-base transition-all duration-150 hover:-translate-y-0.5 active:translate-y-px"
            style={{ background: cfg.btnColor, boxShadow: cfg.btnShadow }}
          >
            {confirmLabel}
          </button>

          {/* Cancel — only shown when onCancel is provided (confirm dialogs) */}
          {onCancel && (
            <button
              onClick={onCancel}
              className="flex-1 py-3 px-6 rounded-2xl font-semibold text-base text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              {cancelLabel}
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes modalIn {
          from { opacity:0; transform: scale(.9) translateY(12px); }
          to   { opacity:1; transform: scale(1)  translateY(0); }
        }
      `}</style>
    </div>
  )
}
