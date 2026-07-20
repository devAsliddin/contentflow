import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Search, Bell, Plus, Sun, Moon } from 'lucide-react'
import { useAuthStore, useUIStore } from '@/store'

const TITLES: Record<string, { eyebrow: string; title: string }> = {
  '/dashboard':            { eyebrow: 'Home',      title: 'Good evening' },
  '/dashboard/new-post':   { eyebrow: 'Compose',   title: 'New post' },
  '/dashboard/calendar':   { eyebrow: 'Schedule',  title: 'Content calendar' },
  '/dashboard/accounts':   { eyebrow: 'Network',   title: 'Connected accounts' },
  '/dashboard/ai-chat':    { eyebrow: 'AI',        title: 'AI SMM Menejer' },
  '/dashboard/analytics':  { eyebrow: 'Insights',  title: 'Analytics' },
  '/dashboard/settings':   { eyebrow: 'Workspace', title: 'Settings' },
  '/dashboard/admin':      { eyebrow: 'System',    title: 'Admin panel' },
  '/dashboard/drafts':     { eyebrow: 'Workflow',  title: 'Draft queue' },
  '/dashboard/approval':   { eyebrow: 'Workflow',  title: 'Approval queue' },
  '/dashboard/templates':  { eyebrow: 'Content',   title: 'Template library' },
  '/dashboard/autoreply':  { eyebrow: 'Engage',    title: 'Avtomatik javob' },
  '/dashboard/ai-posts':   { eyebrow: 'AI Studio', title: 'AI Post Drafts' },
  '/dashboard/ai-posts/create': { eyebrow: 'AI Studio', title: 'AI post yaratish' },
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
  const theme = useUIStore((s) => s.theme)
  const toggleTheme = useUIStore((s) => s.toggleTheme)
  const searchRef = useRef<HTMLInputElement>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const meta = TITLES[location.pathname] || TITLES['/dashboard']
  const isDashboard = location.pathname === '/dashboard'
  const title = isDashboard
    ? `${getGreeting()}, ${user?.full_name?.split(' ')[0] || 'there'}`
    : meta.title

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  function handleSearchSubmit(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && searchQuery.trim()) {
      navigate(`/dashboard/drafts?q=${encodeURIComponent(searchQuery.trim())}`)
      setSearchQuery('')
      searchRef.current?.blur()
    }
    if (e.key === 'Escape') {
      setSearchQuery('')
      searchRef.current?.blur()
    }
  }

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

        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface border border-line text-mute w-72 focus-within:border-indigo-500/50 transition">
          <Search size={14} />
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchSubmit}
            placeholder="Search posts, drafts, captions…"
            className="bg-transparent flex-1 text-sm focus:outline-none placeholder:text-faint text-ink"
          />
          <span className="text-[10px] font-mono text-faint border border-line rounded px-1 py-0.5">⌘K</span>
        </div>

        {/* V2-UI-005: Dark mode toggle */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          className="p-2 rounded-lg bg-surface border border-line text-mute hover:text-ink transition"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <button className="relative p-2 rounded-lg bg-surface border border-line text-mute hover:text-ink transition">
          <Bell size={16} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-rose-500" />
        </button>

        <button
          onClick={() => navigate('/dashboard/new-post')}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-sm rounded-lg font-medium transition ring-focus bg-indigo-500 text-white hover:bg-indigo-400 shadow-glow-indigo"
        >
          <Plus size={14} />
          New Post
        </button>
      </div>
    </header>
  )
}
