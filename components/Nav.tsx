'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Activity, ClipboardPlus, Stethoscope,
  Building2, LayoutDashboard, Settings, HelpCircle, UserCog,
  Users, ScrollText, History,
} from 'lucide-react'

const P = '#22394d'
const PL = '#eef3f7'

const menuLinks = [
  { href: '/register', label: 'Register',       Icon: ClipboardPlus   },
  { href: '/nurse',    label: 'Nurse Station',  Icon: Stethoscope     },
  { href: '/clinics',  label: 'Clinics',        Icon: Building2       },
  { href: '/patients', label: 'Patient Editor', Icon: Users           },
  { href: '/history',  label: 'History',        Icon: History         },
  { href: '/dashboard',label: 'Dashboard',      Icon: LayoutDashboard },
  { href: '/logs',     label: 'Webhook Logs',   Icon: ScrollText      },
]

export default function Nav() {
  const pathname = usePathname()
  return (
    <nav id="sidebar">
      {/* Brand */}
      <div className="px-5 pt-6 pb-4 flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `linear-gradient(135deg,#2c4d67,${P})`, boxShadow: `0 4px 14px ${P}55` }}
        >
          <Activity size={18} className="text-white" strokeWidth={2.5} />
        </div>
        <div>
          <p className="font-bold text-gray-900 text-base leading-tight">SmartTrack</p>
          <p className="text-xs font-semibold" style={{ color: P }}>Patient Journey</p>
        </div>
      </div>

      {/* Staff chip */}
      <div
        className="mx-4 mb-2 px-3 py-3 rounded-2xl flex items-center gap-3"
        style={{ background: PL, border: `1px solid ${P}20` }}
      >
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${P}20` }}>
          <UserCog size={16} style={{ color: P }} />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-gray-800 text-sm leading-tight truncate">Staff Portal</p>
          <p className="text-xs leading-tight" style={{ color: P }}>Hospital System</p>
        </div>
      </div>

      {/* Menu */}
      <span className="sidebar-section">Menu</span>
      <div className="space-y-0.5 px-1">
        {menuLinks.map(({ href, label, Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link key={href} href={href} className={`nav-item ${active ? 'active' : ''}`}>
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
                style={{ background: active ? `${P}18` : '#f5f7f9' }}
              >
                <Icon
                  size={15}
                  strokeWidth={2.2}
                  className="nav-icon transition-colors"
                  style={{ color: active ? P : '#9ca3af' }}
                />
              </div>
              {label}
            </Link>
          )
        })}
      </div>

      {/* Settings (static, non-navigable) */}
      <span className="sidebar-section" style={{ marginTop: 24 }}>Settings</span>
      <div className="space-y-0.5 px-1">
        {[{ Icon: Settings, label: 'App Settings' }, { Icon: HelpCircle, label: 'Help & Support' }].map(({ Icon, label }) => (
          <div key={label} className="nav-item cursor-default">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-gray-50 flex-shrink-0">
              <Icon size={15} strokeWidth={2.2} className="text-gray-300" />
            </div>
            {label}
          </div>
        ))}
      </div>

      {/* Push everything else to the bottom */}
      <div className="flex-1" />

      {/* Version footer — simple text, no card */}
      <div className="px-5 py-4 border-t border-gray-50">
        <p className="text-[11px] text-gray-400 font-medium">SmartTrack POC · v1.0</p>
        <p className="text-[10px] text-gray-300 mt-0.5">Hospital Patient Journey Tracker</p>
      </div>
    </nav>
  )
}
