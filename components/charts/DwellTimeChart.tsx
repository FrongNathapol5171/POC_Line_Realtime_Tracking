'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface Props { data: Array<{ name: string; avgMinutes: number }> }

export default function DwellTimeChart({ data }: Props) {
  return (
    <div>
      <p className="text-base font-bold text-gray-800 mb-0.5">Avg Dwell Time</p>
      <p className="text-sm text-gray-400 mb-5">Average wait minutes per clinic</p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data}>
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} />
          <YAxis unit=" m" tick={{ fontSize: 11, fill: '#9ca3af' }} />
          <Tooltip formatter={(v: number) => [`${v} min`, 'Avg']} contentStyle={{ border: 'none', borderRadius: 14, boxShadow: '0 8px 24px rgba(0,0,0,.1)', fontSize: 13 }} cursor={{ fill: 'rgba(34,57,77,.04)' }} />
          <Bar dataKey="avgMinutes" radius={[6, 6, 0, 0]}>
            {data.map((_, i) => <Cell key={i} fill={i % 2 === 0 ? '#22394d' : '#3b82f6'} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
