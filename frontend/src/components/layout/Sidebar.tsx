import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, PlusSquare, Users, Calendar,
  Sparkles, LogOut, Zap,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { useAuthStore, useUIStore } from '@/store'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/new-post', label: 'New Post', icon: PlusSquare },
  { to: '/accounts', label: 'Accounts', icon: Users },
  { to: '/calendar', label: 'Calendar', icon: Calendar },
  { to: '/ai-plan', label: 'AI Plan', icon: Sparkles },
]

export default function Sidebar() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const logout = useAuthStore((s) => s.logout)
  const user = useAuthStore((s) => s.user)
  const location = useLocation()

  return (
    <aside
      className={cn(
        'flex flex-col bg-card border-r border-border transition-all duration-300 shrink-0',
        sidebarOpen ? 'w-60' : 'w-16'
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-border">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/20 text-primary shrink-0">
          <Zap size={18} />
        </div>
        {sidebarOpen && (
          <span className="font-bold text-foreground text-lg tracking-tight">ContentFlow</span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ to, label, icon: Icon, exact }) => {
          const isActive = exact ? location.pathname === to : location.pathname.startsWith(to)
          return (
            <NavLink
              key={to}
              to={to}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <Icon size={18} className="shrink-0" />
              {sidebarOpen && <span>{label}</span>}
            </NavLink>
          )
        })}
      </nav>

      {/* User + Logout */}
      <div className="px-2 py-3 border-t border-border">
        {sidebarOpen && user && (
          <div className="px-3 py-2 mb-1">
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            <p className="text-sm font-medium text-foreground truncate">{user.full_name || 'User'}</p>
          </div>
        )}
        <button
          onClick={logout}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full',
            'text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors'
          )}
        >
          <LogOut size={18} className="shrink-0" />
          {sidebarOpen && <span>Logout</span>}
        </button>
      </div>
    </aside>
  )
}
