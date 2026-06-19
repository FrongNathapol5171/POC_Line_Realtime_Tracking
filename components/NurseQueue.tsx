'use client'

import { Patient } from '@/lib/types'
import { CheckCircle, Loader2 } from 'lucide-react'

const P = '#22394d'

interface Props {
  patients: Patient[]
  clinicId: string
  onMarkComplete: (hn: string) => void
  loading: boolean
}

const STATUS: Record<string, { label: string; bg: string; color: string }> = {
  REGISTERED:  { label: 'Registered',  bg: '#f3f4f6', color: '#6b7280' },
  BOUND:       { label: 'LINE Linked', bg: '#eef3f7', color: P         },
  IN_PROGRESS: { label: 'In Progress', bg: '#fef3c7', color: '#d97706' },
  COMPLETED:   { label: 'Completed',   bg: '#d1fae5', color: '#059669' },
}

export default function NurseQueue({ patients, onMarkComplete, loading }: Props) {
  if (loading) {
    return (
      <div className="py-14 flex flex-col items-center gap-3 text-gray-300">
        <Loader2 size={32} className="animate-spin" style={{ color: P }} />
        <p className="text-base text-gray-400">Loading patients...</p>
      </div>
    )
  }

  if (patients.length === 0) {
    return (
      <div className="py-16 flex flex-col items-center gap-3 text-gray-300">
        <CheckCircle size={52} strokeWidth={1.5} className="text-emerald-300" />
        <p className="text-lg font-semibold text-gray-400 mt-1">Queue is clear</p>
        <p className="text-base text-gray-300">No patients waiting at this clinic</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-100">
            {['HN', 'Status', 'Action'].map(h => (
              <th key={h} className="pb-3 pr-4 text-left text-xs font-bold uppercase tracking-wide text-gray-400">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {patients.map(p => {
            const st = STATUS[p.status] ?? STATUS.REGISTERED
            return (
              <tr key={p.hn} className="hover:bg-gray-50/60 transition-colors">
                <td className="py-4 pr-4">
                  <span className="font-bold text-lg" style={{ color: P }}>{p.hn}</span>
                </td>
                <td className="py-4 pr-4">
                  <span className="badge text-xs" style={{ background: st.bg, color: st.color }}>
                    {st.label}
                  </span>
                </td>
                <td className="py-4">
                  <button onClick={() => onMarkComplete(p.hn)} className="btn-success">
                    <CheckCircle size={14} /> Mark Done
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
