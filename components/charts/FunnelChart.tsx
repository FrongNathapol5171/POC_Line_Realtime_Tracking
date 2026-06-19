'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const COLORS = ['#22394d', '#2c4d67', '#3b82f6', '#10b981']

interface Props { data: Array<{ stage: string; count: number }> }

export default function FunnelChart({ data }: Props) {
  const eng = data.map(d => ({
    ...d,
    stage: d.stage === 'ลงทะเบียน' ? 'Registered'
         : d.stage === 'เชื่อม LINE' ? 'LINE Linked'
         : d.stage === 'กำลังรักษา'  ? 'In Progress'
         : d.stage === 'เสร็จสิ้น'   ? 'Completed' : d.stage,
  }))
  return (
    <div>
      <p className="text-base font-bold text-gray-800 mb-0.5">Patient Funnel</p>
      <p className="text-sm text-gray-400 mb-5">Patients at each journey stage</p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={eng} layout="vertical">
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="stage" width={92} tick={{ fontSize: 12, fill: '#9ca3af' }} />
          <Tooltip contentStyle={{ border: 'none', borderRadius: 14, boxShadow: '0 8px 24px rgba(0,0,0,.1)', fontSize: 13 }} cursor={{ fill: 'rgba(34,57,77,.04)' }} />
          <Bar dataKey="count" radius={[0, 8, 8, 0]}>
            {eng.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
