'use client'

import useSWR from 'swr'
import { DashboardData } from '@/lib/types'
import KpiCards from '@/components/KpiCards'
import dynamic from 'next/dynamic'
import { RefreshCw, AlertTriangle, CheckCircle2, Users, Activity, ClipboardList, HeartPulse } from 'lucide-react'

const FunnelChart     = dynamic(() => import('@/components/charts/FunnelChart'),     { ssr: false })
const DwellTimeChart  = dynamic(() => import('@/components/charts/DwellTimeChart'),  { ssr: false })
const ThroughputChart = dynamic(() => import('@/components/charts/ThroughputChart'), { ssr: false })
const HelpHeatmap     = dynamic(() => import('@/components/charts/HelpHeatmapChart'),{ ssr: false })
const ActiveDonut     = dynamic(() => import('@/components/charts/ActiveDonutChart'),{ ssr: false })

const P = '#22394d'
const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function DashboardPage() {
  const { data, isLoading, mutate } = useSWR<DashboardData>('/api/dashboard', fetcher, { refreshInterval: 15000 })

  async function resolveHelp(helpId: string) {
    await fetch('/api/help/resolve', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ helpId }),
    })
    await mutate()
  }

  if (isLoading || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5">
        <div className="w-14 h-14 rounded-full border-4 border-t-[#22394d] animate-spin" style={{ borderColor: `${P}30`, borderTopColor: P }} />
        <p className="text-lg font-medium text-gray-400">Loading dashboard...</p>
      </div>
    )
  }

  const total = Object.values(data.statusCounts).reduce((a, b) => a + b, 0)

  const kpiCards = [
    {
      label: 'Active Patients', sublabel: 'Currently in journey',
      value: data.activeCount, Icon: Activity,
      iconBg: `${P}12`, iconColor: P,
      pct: total ? Math.round((data.activeCount / total) * 100) : 0,
      trend: `${data.statusCounts.IN_PROGRESS} in progress`,
    },
    {
      label: 'Completed Today', sublabel: 'Finished all steps',
      value: data.completedToday, Icon: CheckCircle2,
      iconBg: '#f0fdf4', iconColor: '#16a34a',
      pct: total ? Math.round((data.completedToday / total) * 100) : 0,
      trend: `Out of ${total} total`, trendColor: '#16a34a',
    },
    {
      label: 'Help Requests', sublabel: 'Pending resolution',
      value: data.openHelpRequests.length, Icon: HeartPulse,
      iconBg: '#fef2f2', iconColor: '#ef4444',
      pct: Math.min(data.openHelpRequests.length * 10, 100),
      trend: data.openHelpRequests.length > 0 ? 'Needs attention' : 'All resolved',
      trendColor: data.openHelpRequests.length > 0 ? '#ef4444' : '#16a34a',
    },
    {
      label: 'Total Registered', sublabel: 'All patients today',
      value: total, Icon: ClipboardList,
      iconBg: '#eff6ff', iconColor: '#3b82f6',
      pct: total > 0 ? Math.round((data.statusCounts.COMPLETED / total) * 100) : 0,
      trend: `${data.statusCounts.COMPLETED} completed`, trendColor: '#3b82f6',
    },
  ]

  return (
    <div>
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Welcome back. Here is what is happening today.</p>
        </div>
        <button onClick={() => mutate()} className="btn-ghost"><RefreshCw size={14} /> Refresh</button>
      </div>

      <KpiCards cards={kpiCards} />

      {data.openHelpRequests.length > 0 && (
        <div className="card p-6 mb-6 border-l-4 border-red-400">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={18} className="text-red-500" />
            <h2 className="text-lg font-bold text-gray-800">Help Requests</h2>
            <span className="badge bg-red-100 text-red-600">{data.openHelpRequests.length}</span>
          </div>
          <div className="space-y-2.5">
            {data.openHelpRequests.map(h => (
              <div key={h.helpId}
                className="flex items-center justify-between px-5 py-3.5 rounded-2xl bg-red-50 border border-red-100">
                <div className="flex items-center gap-4">
                  <span className="font-bold text-base" style={{ color: P }}>{h.hn}</span>
                  <span className="text-base text-gray-500">{h.clinicName}</span>
                  <span className="text-sm text-gray-400">
                    {new Date(h.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <button onClick={() => resolveHelp(h.helpId)} className="btn-success">
                  <CheckCircle2 size={13} /> Resolve
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.clinicCounts.length > 0 && (
        <div className="card p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Users size={16} className="text-gray-400" />
            <p className="text-lg font-bold text-gray-800">Patients per Clinic</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {data.clinicCounts.map(c => (
              <div key={c.clinicId} className="flex flex-col items-center px-6 py-4 rounded-2xl text-center"
                style={{ background: `${P}0a` }}>
                <p className="text-3xl font-bold leading-none" style={{ color: P }}>{c.count}</p>
                <p className="text-sm text-gray-500 mt-1">{c.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="card p-6"><FunnelChart     data={data.funnelData} /></div>
        <div className="card p-6"><ActiveDonut     active={data.activeCount} completed={data.completedToday} /></div>
        <div className="card p-6"><ThroughputChart data={data.throughputByHour} /></div>
        <div className="card p-6"><DwellTimeChart  data={data.dwellTimes} /></div>
        <div className="card p-6 md:col-span-2"><HelpHeatmap data={data.helpByClinic} /></div>
      </div>
    </div>
  )
}
