import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import MigrationBanner from '@/components/accounts/MigrationBanner'

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false)
  // V2-UI-004: Mobile sidebar overlay state
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex min-h-screen text-ink grain">
      {/* V2-UI-004: Mobile overlay backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* V2-UI-004: Sidebar — hidden on mobile unless mobileOpen */}
      <div
        className={`
          fixed md:relative inset-y-0 left-0 z-40 md:z-auto
          transition-transform duration-300
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} onMobileClose={() => setMobileOpen(false)} />
      </div>

      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        {/* V2-UI-004: Mobile hamburger in top-left */}
        <div className="flex items-center md:hidden px-4 pt-4">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-lg bg-surface border border-line text-mute hover:text-ink transition"
          >
            <Menu size={18} />
          </button>
        </div>

        <TopBar />
        {/* V2-ACC-003: migration notice */}
        <MigrationBanner />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
