'use client'

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface Props { data: Array<{ hour: string; count: number }> }

export default function ThroughputChart({ data }: Props) {
  return (
    <div>
      <p className="text-base font-bold text-gray-800 mb-0.5">Throughput per Hour</p>
      <p className="text-sm text-gray-400 mb-5">Completions per hour today</p>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="tpGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#22394d" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#22394d" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis dataKey="hour" tick={{ fontSize: 11, fill: '#9ca3af' }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
          <Tooltip contentStyle={{ border: 'none', borderRadius: 14, boxShadow: '0 8px 24px rgba(34,57,77,.15)', fontSize: 13 }} cursor={{ stroke: '#22394d', strokeDasharray: '4 4' }} />
          <Area type="monotone" dataKey="count" stroke="#22394d" strokeWidth={2.5} fill="url(#tpGrad)" dot={{ fill: '#22394d', r: 4 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
