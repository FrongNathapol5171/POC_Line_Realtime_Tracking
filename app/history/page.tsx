'use client'

import useSWR from 'swr'
import { RefreshCw, CheckCircle2, Clock, User, Building2 } from 'lucide-react'
import { PatientHistoryRow } from '@/lib/sheets'

const P = '#22394d'
const fetcher = (url: string) => fetch(url).then(r => r.json())

function duration(start: string, end: string): string {
  const ms = Date.parse(end) - Date.parse(start)
  if (isNaN(ms) || ms < 0) return '—'
  const mins = Math.round(ms / 60000)
  if (mins < 60) return `${mins} min`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

export default function HistoryPage() {
  const { data = [], isLoading, mutate } = useSWR<PatientHistoryRow[]>('/api/history', fetcher, {
    refreshInterval: 30000,
  })

  const rows = data as PatientHistoryRow[]

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="page-title">Patient History</h1>
          <p className="page-subtitle">
            Completed journeys — archived after billing step is done
          </p>
        </div>
        <button onClick={() => mutate()} className="btn-ghost">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Completed', value: rows.length,                                              color: P        },
          { label: 'Completed Today', value: rows.filter(r => r.completedAt.startsWith(new Date().toISOString().slice(0, 10))).length, color: '#16a34a' },
          { label: 'LINE Linked',     value: rows.filter(r => r.lineUserId).length,                    color: '#3b82f6' },
        ].map(k => (
          <div key={k.label} className="card p-5">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">{k.label}</p>
            <p className="text-4xl font-bold" style={{ color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="px-7 py-5 border-b border-gray-50 flex items-center justify-between">
          <p className="text-lg font-bold text-gray-800">Completed Journeys</p>
          <span className="badge text-xs" style={{ background: `${P}12`, color: P }}>
            {rows.length} records
          </span>
        </div>

        {isLoading && (
          <div className="py-12 flex flex-col items-center gap-3 text-gray-300">
            <div className="w-8 h-8 rounded-full border-2 animate-spin"
              style={{ borderColor: `${P}25`, borderTopColor: P }} />
            <p className="text-sm text-gray-400">Loading history from Google Sheets...</p>
          </div>
        )}

        {!isLoading && rows.length === 0 && (
          <div className="py-20 flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 rounded-3xl flex items-center justify-center" style={{ background: `${P}10` }}>
              <CheckCircle2 size={28} style={{ color: `${P}50` }} />
            </div>
            <p className="text-base font-semibold text-gray-400">No completed journeys yet</p>
            <p className="text-sm text-gray-300">Records appear here when a patient finishes billing</p>
          </div>
        )}

        {!isLoading && rows.length > 0 && (
          <table className="w-full">
            <thead className="bg-gray-50/70">
              <tr>
                {['HN', 'LINE', 'Clinics', 'Registered', 'Completed', 'Duration', 'Help?'].map(h => (
                  <th key={h} className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wide text-gray-400">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map(r => {
                const seq: string[] = JSON.parse(r.sequenceJson || '[]')
                const dur = duration(r.createdAt, r.completedAt)
                return (
                  <tr key={r.hn + r.completedAt} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: `${P}12` }}>
                          <User size={14} style={{ color: P }} />
                        </div>
                        <span className="font-bold text-base" style={{ color: P }}>{r.hn}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {r.lineUserId
                        ? <span className="badge bg-green-100 text-green-700">Linked</span>
                        : <span className="badge bg-gray-100 text-gray-400">None</span>}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-sm text-gray-500">
                        <Building2 size={12} className="text-gray-400" />
                        {seq.length} stops
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-500">
                        {new Date(r.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                      </p>
                      <p className="text-xs text-gray-300">
                        {new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-500">
                        {new Date(r.completedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                      </p>
                      <p className="text-xs text-gray-300">
                        {new Date(r.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-sm font-medium" style={{ color: P }}>
                        <Clock size={12} /> {dur}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {r.needHelp
                        ? <span className="badge bg-amber-100 text-amber-700">Yes</span>
                        : <span className="text-gray-300 text-sm">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
