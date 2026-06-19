import type { Metadata } from 'next'
import './globals.css'
import Nav from '@/components/Nav'

export const metadata: Metadata = {
  title: 'SmartTrack Patient',
  description: 'Hospital Patient Journey Tracker',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={{ height: '100%' }}>
      <body>
        <div id="app-window">
          <Nav />
          <div id="page-content">
            {children}
          </div>
        </div>
      </body>
    </html>
  )
}
