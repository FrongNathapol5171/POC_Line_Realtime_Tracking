'use client'

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface Props { active: number; completed: number }

export default function ActiveDonutChart({ active, completed }: Props) {
  const data = [
    { name: 'Active',    value: active    },
    { name: 'Completed', value: completed },
  ]
  return (
    <div>
      <p className="text-base font-bold text-gray-800 mb-0.5">Active vs Completed</p>
      <p className="text-sm text-gray-400 mb-5">Today's patient distribution</p>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} cx="50%" cy="45%" innerRadius={55} outerRadius={82} dataKey="value" paddingAngle={3} strokeWidth={0}>
            <Cell fill="#22394d" />
            <Cell fill="#10b981" />
          </Pie>
          <Tooltip contentStyle={{ border: 'none', borderRadius: 14, boxShadow: '0 8px 24px rgba(0,0,0,.1)', fontSize: 13 }} />
          <Legend iconType="circle" iconSize={9} formatter={(v) => <span style={{ fontSize: 12, color: '#6b7280' }}>{v}</span>} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
