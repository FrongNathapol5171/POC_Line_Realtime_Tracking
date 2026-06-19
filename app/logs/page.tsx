'use client'

import { useState } from 'react'
import useSWR from 'swr'
import Modal from '@/components/ui/Modal'
import Toast, { ToastType } from '@/components/ui/Toast'
import { type LucideIcon, RefreshCw, Trash2, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, Info, AlertCircle } from 'lucide-react'

const P = '#22394d'

const fetcher = (url: string) => fetch(url).then(r => r.json())

type LogRow = {
  logId: string
  timestamp: string
  type: string
  hn: string
  step: string
  status: 'OK' | 'ERROR' | 'WARN' | 'INFO'
  detail: string
}

const STATUS_STYLE: Record<string, { bg: string; color: string; Icon: LucideIcon }> = {
  OK:    { bg: '#f0fdf4', color: '#16a34a', Icon: CheckCircle2   },
  ERROR: { bg: '#fef2f2', color: '#dc2626', Icon: AlertCircle    },
  WARN:  { bg: '#fffbeb', color: '#d97706', Icon: AlertTriangle  },
  INFO:  { bg: '#eff6ff', color: '#3b82f6', Icon: Info           },
}

const TYPE_COLOR: Record<string, string> = {
  BINDING_SUCCESS:    '#16a34a',
  BINDING_ERROR:      '#dc2626',
  BINDING_ATTEMPT:    '#3b82f6',
  BINDING_SKIP:       '#d97706',
  LINE_PUSH_SUCCESS:  '#16a34a',
  LINE_PUSH_FAILED:   '#dc2626',
  LINE_REPLY_SUCCESS: '#16a34a',
  LINE_REPLY_FAILED:  '#dc2626',
  WEBHOOK_RECEIVED:   '#6366f1',
  WEBHOOK_ERROR:      '#dc2626',
  WEBHOOK_SKIP:       '#9ca3af',
  HELP_LOGGED:        '#f59e0b',
  POSTBACK:           '#8b5cf6',
  POSTBACK_ERROR:     '#dc2626',
  PROCESS_ERROR:      '#dc2626',
}

export default function LogsPage() {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('ALL')
  const [filterType, setFilterType] = useState<string>('')
  const [clearModal, setClearModal] = useState(false)
  const [toast, setToast] = useState<{ type: ToastType; message: string; key: number } | null>(null)

  const { data: logs = [], isLoading, mutate } = useSWR<LogRow[]>('/api/logs?limit=200', fetcher, {
    refreshInterval: 8000,
  })

  async function clearLogs() {
    setClearModal(false)
    const res = await fetch('/api/logs', { method: 'DELETE' })
    const data = await res.json()
    if (res.ok) {
      setToast({ type: 'success', message: 'Logs cleared', key: Date.now() })
      await mutate()
    } else {
      setToast({ type: 'error', message: data.error ?? 'Clear failed', key: Date.now() })
    }
  }

  const displayed = (logs as LogRow[])
    .filter(r => filterStatus === 'ALL' || r.status === filterStatus)
    .filter(r => !filterType || r.type.toLowerCase().includes(filterType.toLowerCase()))

  const errorCount = (logs as LogRow[]).filter(r => r.status === 'ERROR').length

  return (
    <>
      {clearModal && (
        <Modal
          type="confirm"
          title="Clear All Logs?"
          message="This will delete all log rows from the Logs sheet (header row is kept). This cannot be undone."
          confirmLabel="Clear Logs"
          onConfirm={clearLogs}
          onCancel={() => setClearModal(false)}
          onClose={() => setClearModal(false)}
        />
      )}
      {toast && (
        <Toast key={toast.key} type={toast.type} message={toast.message} onClose={() => setToast(null)} />
      )}

      <div>
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="page-title">Webhook Logs</h1>
            <p className="page-subtitle">
              Real-time log of LINE webhook events — refreshes every 8 s
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => mutate()} className="btn-ghost">
              <RefreshCw size={14} /> Refresh
            </button>
            <button onClick={() => setClearModal(true)} className="btn-ghost" style={{ color: '#dc2626', borderColor: '#fca5a5' }}>
              <Trash2 size={14} /> Clear Logs
            </button>
          </div>
        </div>

        {/* Summary KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total entries',  value: (logs as LogRow[]).length,                              color: P          },
            { label: 'Errors',         value: errorCount,                                              color: '#dc2626'  },
            { label: 'Warnings',       value: (logs as LogRow[]).filter(r => r.status === 'WARN').length, color: '#d97706' },
            { label: 'Successes',      value: (logs as LogRow[]).filter(r => r.status === 'OK').length,   color: '#16a34a' },
          ].map(k => (
            <div key={k.label} className="card p-5 flex flex-col gap-1">
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">{k.label}</p>
              <p className="text-4xl font-bold leading-none" style={{ color: k.color }}>{k.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="card p-4 mb-5 flex flex-wrap gap-3 items-center">
          <div className="flex gap-1.5 flex-wrap">
            {['ALL', 'OK', 'ERROR', 'WARN', 'INFO'].map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wide transition-all"
                style={{
                  background: filterStatus === s ? P : '#f3f4f6',
                  color: filterStatus === s ? '#fff' : '#6b7280',
                }}
              >
                {s}
              </button>
            ))}
          </div>
          <input
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            placeholder="Filter by type (e.g. BINDING)"
            className="input-field text-sm flex-1 min-w-[200px] py-2"
          />
          <p className="text-sm text-gray-400 flex-shrink-0">{displayed.length} rows</p>
        </div>

        {/* Log table */}
        <div className="card overflow-hidden">
          {isLoading && (
            <div className="py-10 text-center text-gray-400">
              <div className="w-8 h-8 rounded-full border-2 border-t-[#22394d] animate-spin mx-auto mb-2" style={{ borderColor: `${P}25`, borderTopColor: P }} />
              Loading logs from Google Sheets...
            </div>
          )}

          {!isLoading && displayed.length === 0 && (
            <div className="py-16 text-center text-gray-300">
              <Info size={36} className="mx-auto mb-3 text-gray-200" />
              <p className="text-base font-medium text-gray-400">No log entries</p>
              <p className="text-sm mt-1">Logs appear here after LINE webhook events are received</p>
            </div>
          )}

          {!isLoading && displayed.length > 0 && (
            <table className="w-full text-sm">
              <thead className="bg-gray-50/70 border-b border-gray-100">
                <tr>
                  {['Time', 'Status', 'Type', 'HN', 'Step', 'Detail'].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wide text-gray-400">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {displayed.map(row => {
                  const st = STATUS_STYLE[row.status] ?? STATUS_STYLE.INFO
                  const isOpen = expanded === row.logId
                  return (
                    <>
                      <tr
                        key={row.logId}
                        className="hover:bg-gray-50/60 transition-colors cursor-pointer"
                        onClick={() => setExpanded(isOpen ? null : row.logId)}
                      >
                        {/* Time */}
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <p className="font-mono text-xs text-gray-500">
                            {new Date(row.timestamp).toLocaleTimeString('en-US', { hour12: false })}
                          </p>
                          <p className="font-mono text-[10px] text-gray-300">
                            {new Date(row.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </p>
                        </td>

                        {/* Status badge */}
                        <td className="px-5 py-3.5">
                          <span
                            className="badge text-[11px] gap-1"
                            style={{ background: st.bg, color: st.color }}
                          >
                            <st.Icon size={11} /> {row.status}
                          </span>
                        </td>

                        {/* Type */}
                        <td className="px-5 py-3.5">
                          <span
                            className="text-xs font-bold font-mono"
                            style={{ color: TYPE_COLOR[row.type] ?? '#6b7280' }}
                          >
                            {row.type}
                          </span>
                        </td>

                        {/* HN */}
                        <td className="px-5 py-3.5">
                          {row.hn
                            ? <span className="font-bold text-sm" style={{ color: P }}>{row.hn}</span>
                            : <span className="text-gray-200">—</span>}
                        </td>

                        {/* Step */}
                        <td className="px-5 py-3.5">
                          <span className="text-xs font-mono text-gray-500">{row.step}</span>
                        </td>

                        {/* Detail preview + expand toggle */}
                        <td className="px-5 py-3.5 max-w-[260px]">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 truncate flex-1">
                              {row.detail ? row.detail.slice(0, 80) + (row.detail.length > 80 ? '…' : '') : '—'}
                            </span>
                            {row.detail && (
                              isOpen
                                ? <ChevronUp size={13} className="text-gray-400 flex-shrink-0" />
                                : <ChevronDown size={13} className="text-gray-400 flex-shrink-0" />
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expanded detail row */}
                      {isOpen && row.detail && (
                        <tr key={`${row.logId}-detail`} className="bg-gray-50/60">
                          <td colSpan={6} className="px-5 pb-4 pt-0">
                            <div
                              className="rounded-xl p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all"
                              style={{ background: st.bg, color: st.color, border: `1px solid ${st.color}22` }}
                            >
                              {row.detail}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <p className="text-xs text-gray-300 mt-3 text-center">
          Showing last 200 entries · newest first · stored in Google Sheets "Logs" tab
        </p>
      </div>
    </>
  )
}
