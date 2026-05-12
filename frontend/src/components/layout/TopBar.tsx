import { useNavigate, useLocation } from 'react-router-dom'
import { Search, Bell, Plus } from 'lucide-react'
import { useAuthStore } from '@/store'

const TITLES: Record<string, { eyebrow: string; title: string }> = {
  '/':          { eyebrow: 'Home',      title: 'Good evening' },
  '/new-post':  { eyebrow: 'Compose',   title: 'New post' },
  '/calendar':  { eyebrow: 'Schedule',  title: 'Content calendar' },
  '/accounts':  { eyebrow: 'Network',   title: 'Connected accounts' },
  '/ai-plan':   { eyebrow: 'AI',        title: 'Plan generator' },
  '/analytics': { eyebrow: 'Insights',  title: 'Analytics' },
  '/settings':  { eyebrow: 'Workspace', title: 'Settings' },
  '/admin':     { eyebrow: 'System',    title: 'Admin panel' },
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function TopBar() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore((s) => s.user)

  const meta = TITLES[location.pathname] || TITLES['/']
  const isDashboard = location.pathname === '/'
  const title = isDashboard
    ? `${getGreeting()}, ${user?.full_name?.split(' ')[0] || 'there'}`
    : meta.title

  return (
    <header className="sticky top-0 z-30 bg-bg/70 backdrop-blur-xl border-b border-line">
      <div className="px-8 py-4 flex items-center gap-6">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-[0.2em] text-faint">{meta.eyebrow}</div>
          <h1 className="font-display text-[26px] text-ink tracking-tight leading-tight">
            {title}
            {isDashboard && <span className="text-indigo-400"> 👋</span>}
          </h1>
        </div>

        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface border border-line text-mute w-72">
          <Search size={14} />
          <input
            type="text"
            placeholder="Search posts, drafts, captions…"
            className="bg-transparent flex-1 text-sm focus:outline-none placeholder:text-faint text-ink"
          />
          <span className="text-[10px] font-mono text-faint border border-line rounded px-1 py-0.5">⌘K</span>
        </div>

        <button className="relative p-2 rounded-lg bg-surface border border-line text-mute hover:text-ink transition">
          <Bell size={16} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-rose-500" />
        </button>

        <button
          onClick={() => navigate('/new-post')}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-sm rounded-lg font-medium transition ring-focus bg-indigo-500 text-white hover:bg-indigo-400 shadow-glow-indigo"
        >
          <Plus size={14} />
          New Post
        </button>
      </div>
    </header>
  )
}
