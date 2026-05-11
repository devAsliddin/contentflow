import { Menu, Bell } from 'lucide-react'
import { useUIStore, useAuthStore } from '@/store'
import { format } from 'date-fns'

const GREETINGS = ['Good morning', 'Good afternoon', 'Good evening']

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return GREETINGS[0]
  if (hour < 18) return GREETINGS[1]
  return GREETINGS[2]
}

export default function TopBar() {
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const unreadCount = useUIStore((s) => s.unreadCount)
  const markAllRead = useUIStore((s) => s.markAllRead)
  const user = useAuthStore((s) => s.user)
  const today = format(new Date(), 'EEEE, MMMM d')
  const count = unreadCount()

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <Menu size={20} />
        </button>
        <div>
          <h1 className="text-sm font-semibold text-foreground">
            {getGreeting()}, {user?.full_name?.split(' ')[0] || 'there'} 👋
          </h1>
          <p className="text-xs text-muted-foreground">{today}</p>
        </div>
      </div>

      <button
        onClick={markAllRead}
        className="relative p-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
      >
        <Bell size={20} />
        {count > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>
    </header>
  )
}
