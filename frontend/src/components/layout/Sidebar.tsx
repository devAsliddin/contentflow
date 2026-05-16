import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, PlusCircle, CalendarDays, UsersRound,
  Sparkles, LineChart, Settings2, PanelLeftClose, PanelLeftOpen,
  ChevronUp, ShieldCheck, LogOut, FileEdit, ClipboardCheck, Layers,
  ChevronDown, X, MessageSquare,
} from 'lucide-react'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store'
import Avatar from '@/components/ui/Avatar'
import PlatformChip, { type PlatformKind } from '@/components/ui/PlatformChip'
import { accountsService } from '@/services/accounts.service'

const NAV_TOP = [
  { to: '/dashboard',           label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/dashboard/new-post',  label: 'New Post',  icon: PlusCircle,      kbd: '⌘N' },
  { to: '/dashboard/calendar',  label: 'Calendar',  icon: CalendarDays },
  { to: '/dashboard/accounts',  label: 'Accounts',  icon: UsersRound },
  { to: '/dashboard/ai-chat',   label: 'AI Menejer',   icon: MessageSquare },
]

const NAV_WORKFLOW = [
  { to: '/dashboard/drafts',    label: 'Drafts',    icon: FileEdit },
  { to: '/dashboard/approval',  label: 'Approval',  icon: ClipboardCheck },
  { to: '/dashboard/templates', label: 'Templates', icon: Layers },
]

const NAV_BOTTOM = [
  { to: '/dashboard/analytics', label: 'Analytics', icon: LineChart },
  { to: '/dashboard/settings',  label: 'Settings',  icon: Settings2 },
]

interface Props {
  collapsed: boolean
  setCollapsed: (v: boolean) => void
  onMobileClose?: () => void
}

function Logo({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="relative w-9 h-9 rounded-xl shrink-0 overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #6C63FF 0%, #00F5A0 100%)',
          boxShadow: '0 8px 22px -8px rgba(108,99,255,0.6)',
        }}
      >
        <div className="absolute inset-[1px] rounded-[10px] bg-bg flex items-center justify-center">
          <span className="font-display text-[17px] font-semibold tracking-tight text-grad-indigo">CF</span>
        </div>
        <span
          className="absolute -right-0.5 -top-0.5 w-2 h-2 rounded-full bg-mint-500 dot-pulse"
          style={{ ['--dot' as string]: 'rgba(0,245,160,0.6)' }}
        />
      </div>
      {!collapsed && (
        <div className="flex flex-col leading-tight">
          <span className="font-display text-[15px] text-ink tracking-tight">ContentFlow</span>
          <span className="text-[10px] text-faint tracking-[0.14em] uppercase">v 2.4 · alpha</span>
        </div>
      )}
    </div>
  )
}

export default function Sidebar({ collapsed, setCollapsed, onMobileClose }: Props) {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const location = useLocation()
  const navigate = useNavigate()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [accountSwitcherOpen, setAccountSwitcherOpen] = useState(false)

  // V2-UI-002: Load connected accounts for account switcher
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountsService.list(),
  })

  // Group accounts by platform
  const accountGroups: Record<string, typeof accounts> = {}
  for (const acc of accounts) {
    if (!accountGroups[acc.platform]) accountGroups[acc.platform] = []
    accountGroups[acc.platform].push(acc)
  }

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const isActive = (to: string, exact?: boolean) =>
    exact ? location.pathname === to : location.pathname.startsWith(to)

  return (
    <aside
      className="relative shrink-0 h-screen sticky top-0 border-r border-line bg-bg/80 backdrop-blur-xl flex flex-col transition-all duration-300 z-20"
      style={{ width: collapsed ? 76 : 244 }}
    >
      {/* Logo row */}
      <div className="px-4 pt-5 pb-4 flex items-center justify-between">
        <Logo collapsed={collapsed} />
        <div className="flex items-center gap-1">
          {/* V2-UI-004: Mobile close button */}
          {onMobileClose && (
            <button
              onClick={onMobileClose}
              className="p-1.5 rounded-md text-faint hover:text-ink hover:bg-surface transition md:hidden"
            >
              <X size={16} />
            </button>
          )}
          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              className="p-1.5 rounded-md text-faint hover:text-ink hover:bg-surface transition hidden md:flex"
            >
              <PanelLeftClose size={16} />
            </button>
          )}
        </div>
      </div>

      {collapsed && (
        <div className="px-4 pb-2">
          <button
            onClick={() => setCollapsed(false)}
            className="w-full flex justify-center p-1.5 rounded-md text-faint hover:text-ink hover:bg-surface transition"
          >
            <PanelLeftOpen size={16} />
          </button>
        </div>
      )}

      <div className="hr mx-3 my-1" />

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 flex flex-col gap-0.5 overflow-y-auto">
        {!collapsed && (
          <div className="text-[10px] uppercase tracking-[0.18em] text-faint px-2 mb-1 mt-1">Workspace</div>
        )}
        {NAV_TOP.map(({ to, label, icon: Icon, exact, kbd }) => {
          const active = isActive(to, exact)
          return (
            <NavLink
              key={to}
              to={to}
              className={`relative group flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm transition
                ${active ? 'text-ink bg-surface2' : 'text-mute hover:text-ink hover:bg-surface/60'}
                ${collapsed ? 'justify-center' : ''}`}
            >
              {active && (
                <span
                  className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r bg-indigo-500"
                  style={{ boxShadow: '0 0 12px rgba(108,99,255,0.7)' }}
                />
              )}
              <Icon size={17} className={active ? 'text-indigo-400' : ''} />
              {!collapsed && <span className="truncate flex-1">{label}</span>}
              {!collapsed && kbd && (
                <span className="ml-auto text-[10px] font-mono text-faint border border-line rounded px-1.5 py-0.5">
                  {kbd}
                </span>
              )}
            </NavLink>
          )
        })}

        {/* V2-UI-002: Workflow section */}
        {!collapsed && (
          <div className="text-[10px] uppercase tracking-[0.18em] text-faint px-2 mb-1 mt-4">Workflow</div>
        )}
        {collapsed && <div className="my-2 mx-2 hr" />}
        {NAV_WORKFLOW.map(({ to, label, icon: Icon }) => {
          const active = isActive(to)
          return (
            <NavLink
              key={to}
              to={to}
              className={`relative group flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm transition
                ${active ? 'text-ink bg-surface2' : 'text-mute hover:text-ink hover:bg-surface/60'}
                ${collapsed ? 'justify-center' : ''}`}
            >
              {active && (
                <span
                  className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r bg-indigo-500"
                  style={{ boxShadow: '0 0 12px rgba(108,99,255,0.7)' }}
                />
              )}
              <Icon size={17} className={active ? 'text-indigo-400' : ''} />
              {!collapsed && <span className="truncate flex-1">{label}</span>}
            </NavLink>
          )
        })}

        {!collapsed && (
          <div className="text-[10px] uppercase tracking-[0.18em] text-faint px-2 mb-1 mt-4">Insights</div>
        )}
        {collapsed && <div className="my-2 mx-2 hr" />}

        {/* Admin link — visible only to admins */}
        {user?.is_admin && (() => {
          const active = isActive('/dashboard/admin')
          return (
            <NavLink
              to="/dashboard/admin"
              className={`relative group flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm transition
                ${active ? 'text-ink bg-surface2' : 'text-mute hover:text-ink hover:bg-surface/60'}
                ${collapsed ? 'justify-center' : ''}`}
            >
              {active && (
                <span
                  className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r bg-indigo-500"
                  style={{ boxShadow: '0 0 12px rgba(108,99,255,0.7)' }}
                />
              )}
              <ShieldCheck size={17} className={active ? 'text-indigo-400' : ''} />
              {!collapsed && <span className="truncate">Admin</span>}
            </NavLink>
          )
        })()}

        {NAV_BOTTOM.map(({ to, label, icon: Icon }) => {
          const active = isActive(to)
          return (
            <NavLink
              key={to}
              to={to}
              className={`relative group flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm transition
                ${active ? 'text-ink bg-surface2' : 'text-mute hover:text-ink hover:bg-surface/60'}
                ${collapsed ? 'justify-center' : ''}`}
            >
              {active && (
                <span
                  className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r bg-indigo-500"
                  style={{ boxShadow: '0 0 12px rgba(108,99,255,0.7)' }}
                />
              )}
              <Icon size={17} className={active ? 'text-indigo-400' : ''} />
              {!collapsed && <span className="truncate">{label}</span>}
            </NavLink>
          )
        })}
      </nav>

      {/* V2-UI-002: Multi-account switcher */}
      {!collapsed && accounts.length > 0 && (
        <div className="mx-3 mb-2">
          <button
            onClick={() => setAccountSwitcherOpen((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-surface border border-line text-xs text-mute hover:text-ink hover:bg-surface2 transition"
          >
            <div className="flex items-center gap-2">
              <div className="flex -space-x-1">
                {Object.keys(accountGroups).slice(0, 3).map((plat) => (
                  <PlatformChip key={plat} kind={plat as PlatformKind} size={14} />
                ))}
              </div>
              <span>{accounts.length} account{accounts.length !== 1 ? 's' : ''}</span>
            </div>
            <ChevronDown
              size={12}
              className={`transition-transform ${accountSwitcherOpen ? 'rotate-180' : ''}`}
            />
          </button>
          {accountSwitcherOpen && (
            <div className="mt-1 rounded-xl bg-surface border border-line overflow-hidden">
              {accounts.map((acc) => (
                <div
                  key={acc.id}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs text-ink hover:bg-surface2 transition border-b border-line last:border-b-0"
                >
                  <PlatformChip kind={acc.platform as PlatformKind} size={14} />
                  <span className="truncate flex-1">{acc.account_name}</span>
                  <span className={`w-1.5 h-1.5 rounded-full ${acc.is_active ? 'bg-mint-500' : 'bg-faint'}`} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* AI Credits */}
      {!collapsed && (
        <div className="mx-3 mb-3 rounded-xl border border-line bg-surface/80 p-3 relative overflow-hidden">
          <div className="absolute inset-0 orbit opacity-50 pointer-events-none" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={14} className="text-indigo-400" />
              <span className="text-[11px] uppercase tracking-[0.16em] text-mute">AI credits</span>
            </div>
            <div className="font-display text-2xl text-ink tnum">
              1,284<span className="text-faint text-base"> / 2,000</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-line2/40 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: '64%', background: 'linear-gradient(90deg, #6C63FF, #00F5A0)' }}
              />
            </div>
            <button className="mt-3 w-full text-[12px] font-medium text-ink py-1.5 rounded-md bg-surface2 border border-line hover:border-line2 transition">
              Get more credits
            </button>
          </div>
        </div>
      )}

      {/* User row */}
      <div className="p-3 border-t border-line relative">
        {/* Logout dropdown */}
        {userMenuOpen && !collapsed && (
          <div className="absolute bottom-full left-3 right-3 mb-1 bg-surface border border-line rounded-xl shadow-card overflow-hidden z-50">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-rose-400 hover:bg-rose-500/10 transition"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        )}
        <div className="flex items-center gap-3">
          <Avatar
            name={user?.full_name || user?.email || 'User'}
            size={collapsed ? 32 : 36}
            hue={250}
          />
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-ink truncate">{user?.full_name || 'User'}</div>
                <div className="text-[11px] text-faint truncate">{user?.email || ''}</div>
              </div>
              <button
                onClick={() => setUserMenuOpen((v) => !v)}
                className="p-1.5 rounded-md text-faint hover:text-ink hover:bg-surface transition"
              >
                <ChevronUp size={14} className={userMenuOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
              </button>
            </>
          )}
          {collapsed && (
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-md text-faint hover:text-rose-400 hover:bg-surface transition"
              title="Sign out"
            >
              <LogOut size={14} />
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}
