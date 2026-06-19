'use client'

import { Clinic } from '@/lib/types'
import { Check } from 'lucide-react'

const P = '#22394d'

interface Props {
  clinics: Clinic[]
  selected: string[]
  onChange: (selected: string[]) => void
}

export default function ClinicPicker({ clinics, selected, onChange }: Props) {
  const active = clinics.filter(c => c.active && c.clinicId !== 'BILLING')

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id])
  }

  if (active.length === 0)
    return <p className="text-base text-gray-400 py-5 text-center">No clinics — add clinics first</p>

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {active.map(c => {
        const checked = selected.includes(c.clinicId)
        return (
          <label
            key={c.clinicId}
            className={`flex items-start gap-3 p-4 rounded-2xl cursor-pointer transition-all border ${
              checked ? 'shadow-sm' : 'border-gray-100 bg-white hover:bg-gray-50 shadow-sm'
            }`}
            style={checked ? { borderColor: `${P}55`, background: `${P}08` } : {}}
          >
            <div
              className="mt-0.5 w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all border-2"
              style={
                checked
                  ? { background: P, borderColor: P, boxShadow: `0 2px 8px ${P}45` }
                  : { background: 'white', borderColor: '#d1d5db' }
              }
            >
              {checked && <Check size={11} className="text-white" strokeWidth={3} />}
            </div>
            <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggle(c.clinicId)} />
            <div className="min-w-0">
              <p className="font-semibold text-base leading-tight" style={{ color: checked ? P : '#1f2937' }}>
                {c.name}
              </p>
              {c.detail && (
                <p className="text-sm mt-0.5" style={{ color: checked ? `${P}99` : '#9ca3af' }}>{c.detail}</p>
              )}
            </div>
          </label>
        )
      })}
    </div>
  )
}
