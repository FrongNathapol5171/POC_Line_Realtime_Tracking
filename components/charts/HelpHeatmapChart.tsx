'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface Props { data: Array<{ name: string; count: number }> }

export default function HelpHeatmapChart({ data }: Props) {
  return (
    <div>
      <p className="text-base font-bold text-gray-800 mb-0.5">Help Requests by Clinic</p>
      <p className="text-sm text-gray-400 mb-5">Which clinics generate the most help requests</p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data}>
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
          <Tooltip contentStyle={{ border: 'none', borderRadius: 14, boxShadow: '0 8px 24px rgba(239,68,68,.15)', fontSize: 13 }} cursor={{ fill: 'rgba(239,68,68,.06)' }} />
          <Bar dataKey="count" fill="#ef4444" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
