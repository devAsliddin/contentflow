import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay,
  addMonths, subMonths, startOfWeek, endOfWeek,
} from 'date-fns'
import { ChevronLeft, ChevronRight, X, Filter, Plus, CalendarX } from 'lucide-react'
import { postsService } from '@/services/posts.service'
import { getPlatformFromEntry } from '@/utils/platform.utils'
import { formatDateTime } from '@/utils/date.utils'
import { cn } from '@/utils/cn'
import PlatformChip, { PLATFORM_META, type PlatformKind } from '@/components/ui/PlatformChip'
import StatusPill from '@/components/ui/StatusPill'
import ImgPlaceholder from '@/components/ui/ImgPlaceholder'
import type { Post } from '@/types/post.types'
import { useNavigate } from 'react-router-dom'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function DayEvent({ post, idx }: { post: Post; idx: number }) {
  const platforms = (post.platforms || []).map(getPlatformFromEntry) as PlatformKind[]
  const statusBg: Record<string, string> = {
    published: 'rgba(0,245,160,0.10)',
    scheduled: 'rgba(255,179,71,0.10)',
    draft: 'rgba(138,138,160,0.08)',
    failed: 'rgba(255,92,138,0.10)',
  }
  return (
    <div
      className="flex items-center gap-1.5 px-1.5 py-1 rounded text-[10.5px] truncate"
      style={{ background: statusBg[post.status] || statusBg.draft }}
    >
      {platforms[0] && <PlatformChip kind={platforms[0]} size={12} />}
      <span className="text-ink/90 truncate flex-1">{post.caption?.slice(0, 30) || 'Post'}</span>
      {post.scheduled_at && (
        <span className="text-faint tnum font-mono shrink-0">
          {format(new Date(post.scheduled_at), 'HH:mm')}
        </span>
      )}
    </div>
  )
}

function DayDrawer({ day, posts, onClose }: { day: Date; posts: Post[]; onClose: () => void }) {
  const navigate = useNavigate()
  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 mask-in" />
      <aside className="fixed top-0 right-0 bottom-0 w-[440px] bg-bg border-l border-line z-50 drawer-in flex flex-col">
        <div className="p-5 border-b border-line flex items-start justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-faint">Schedule</div>
            <div className="font-display text-2xl text-ink mt-1">{format(day, 'MMMM d, yyyy')}</div>
            <div className="text-sm text-mute mt-1">
              {posts.length} {posts.length === 1 ? 'post' : 'posts'} scheduled
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-faint hover:text-ink hover:bg-surface">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {posts.length === 0 && (
            <div className="text-center py-12">
              <div className="w-12 h-12 rounded-full bg-surface border border-line mx-auto flex items-center justify-center mb-3">
                <CalendarX size={18} className="text-faint" />
              </div>
              <div className="text-sm text-ink">Nothing scheduled</div>
              <div className="text-[12px] text-faint mt-1">A perfect day to draft something new.</div>
            </div>
          )}
          {posts.map((post, i) => {
            const platforms = (post.platforms || []).map(getPlatformFromEntry) as PlatformKind[]
            return (
              <div key={post.id} className="rounded-xl bg-surface border border-line p-4 lift">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {platforms[0] && <PlatformChip kind={platforms[0]} size={18} />}
                    {post.scheduled_at && (
                      <span className="text-[11px] text-faint font-mono">
                        {format(new Date(post.scheduled_at), 'HH:mm')}
                      </span>
                    )}
                  </div>
                  <StatusPill kind={post.status}>{post.status}</StatusPill>
                </div>
                <div className="flex items-start gap-3">
                  <ImgPlaceholder label="thumb" aspect="1 / 1" hue={(i + 1) * 60 % 360} className="w-12 h-12" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] text-ink leading-snug line-clamp-2">
                      {post.caption || 'No caption'}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="p-5 border-t border-line">
          <button
            onClick={() => navigate('/new-post')}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-500 text-white font-medium shadow-glow-indigo hover:bg-indigo-400 transition text-sm"
          >
            <Plus size={14} />
            Add post on this day
          </button>
        </div>
      </aside>
    </>
  )
}

export default function CalendarPage() {
  const navigate = useNavigate()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [view, setView] = useState<'month' | 'week'>('month')

  const { data: posts = [] } = useQuery({
    queryKey: ['posts', 'calendar'],
    queryFn: () => postsService.list({ limit: 100 }),
  })

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  function getPostsForDay(day: Date): Post[] {
    return posts.filter((p) => p.scheduled_at && isSameDay(new Date(p.scheduled_at), day))
  }

  const selectedDayPosts = selectedDay ? getPostsForDay(selectedDay) : []

  return (
    <div className="page-in px-8 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-surface border border-line rounded-lg overflow-hidden">
            <button
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="px-2.5 py-2 text-mute hover:text-ink hover:bg-surface2 border-r border-line"
            >
              <ChevronLeft size={14} />
            </button>
            <div className="px-4 py-2 font-display text-lg text-ink tnum min-w-[180px] text-center">
              {format(currentMonth, 'MMMM yyyy')}
            </div>
            <button
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="px-2.5 py-2 text-mute hover:text-ink hover:bg-surface2 border-l border-line"
            >
              <ChevronRight size={14} />
            </button>
          </div>
          <button
            onClick={() => setCurrentMonth(new Date())}
            className="px-3 py-2 text-sm rounded-lg bg-surface border border-line text-ink hover:border-line2 hover:bg-surface2 transition"
          >
            Today
          </button>
          <div className="flex items-center bg-surface border border-line rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setView('week')}
              className={`px-3 py-1 rounded-md ${view === 'week' ? 'bg-surface2 text-ink' : 'text-mute hover:text-ink'}`}
            >
              Week
            </button>
            <button
              onClick={() => setView('month')}
              className={`px-3 py-1 rounded-md ${view === 'month' ? 'bg-surface2 text-ink' : 'text-mute hover:text-ink'}`}
            >
              Month
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-3 text-xs text-mute">
            {(['instagram', 'tiktok', 'telegram'] as PlatformKind[]).map((k) => (
              <div key={k} className="flex items-center gap-1.5">
                <PlatformChip kind={k} size={14} />
                <span>{PLATFORM_META[k].label}</span>
              </div>
            ))}
          </div>
          <button className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-surface border border-line text-ink hover:border-line2 hover:bg-surface2 transition">
            <Filter size={12} />
            Filter
          </button>
          <button
            onClick={() => navigate('/new-post')}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm rounded-lg font-medium bg-indigo-500 text-white hover:bg-indigo-400 shadow-glow-indigo transition"
          >
            <Plus size={14} />
            New Post
          </button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="rounded-2xl bg-surface border border-line overflow-hidden">
        <div className="grid grid-cols-7 border-b border-line">
          {WEEKDAYS.map((d) => (
            <div key={d} className="text-[10px] uppercase tracking-[0.18em] text-faint px-3 py-2 border-r border-line last:border-r-0">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day, idx) => {
            const dayPosts = getPostsForDay(day)
            const isCurrentMonth = day.getMonth() === currentMonth.getMonth()
            const isToday = isSameDay(day, new Date())
            const isSelected = selectedDay && isSameDay(day, selectedDay)

            return (
              <button
                key={idx}
                onClick={() => setSelectedDay(isSelected ? null : day)}
                className={cn(
                  'group relative min-h-[112px] p-2 text-left border-r border-b border-line transition',
                  (idx + 1) % 7 === 0 ? '!border-r-0' : '',
                  isCurrentMonth ? 'hover:bg-surface2/60' : 'bg-bg/40',
                  isSelected && 'bg-surface2/40',
                )}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className={cn(
                      'inline-flex items-center justify-center text-[12px] tnum',
                      isToday ? 'w-6 h-6 rounded-full bg-indigo-500 text-white font-medium' : '',
                      !isToday && isCurrentMonth ? 'text-mute' : '',
                      !isToday && !isCurrentMonth ? 'text-faint/40' : '',
                    )}
                  >
                    {format(day, 'd')}
                  </span>
                  {dayPosts.length > 0 && (
                    <span className="text-[10px] text-faint tnum font-mono">{dayPosts.length}</span>
                  )}
                </div>
                <div className="space-y-1">
                  {dayPosts.slice(0, 2).map((post, i) => (
                    <DayEvent key={post.id} post={post} idx={i} />
                  ))}
                  {dayPosts.length > 2 && (
                    <div className="text-[10px] text-mute pl-1.5">+{dayPosts.length - 2} more</div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Day drawer */}
      {selectedDay && (
        <DayDrawer
          day={selectedDay}
          posts={selectedDayPosts}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </div>
  )
}
