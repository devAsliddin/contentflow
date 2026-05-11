import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { postsService } from '@/services/posts.service'
import { getPlatformColor, getPlatformFromEntry } from '@/utils/platform.utils'
import { formatDateTime } from '@/utils/date.utils'
import { cn } from '@/utils/cn'
import type { Post } from '@/types/post.types'

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  const { data: posts = [] } = useQuery({
    queryKey: ['posts', 'calendar'],
    queryFn: () => postsService.list({ limit: 100 }),
  })

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  const scheduledPosts = posts.filter((p) => p.scheduled_at)

  function getPostsForDay(day: Date): Post[] {
    return scheduledPosts.filter((p) => p.scheduled_at && isSameDay(new Date(p.scheduled_at), day))
  }

  const selectedDayPosts = selectedDay ? getPostsForDay(selectedDay) : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Content Calendar</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Your scheduled content overview</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold text-foreground w-32 text-center">
            {format(currentMonth, 'MMMM yyyy')}
          </span>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-border">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <div key={d} className="py-2.5 text-center text-xs font-medium text-muted-foreground">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7">
          {days.map((day, idx) => {
            const dayPosts = getPostsForDay(day)
            const isCurrentMonth = day.getMonth() === currentMonth.getMonth()
            const isToday = isSameDay(day, new Date())
            const isSelected = selectedDay && isSameDay(day, selectedDay)

            return (
              <div
                key={idx}
                onClick={() => setSelectedDay(dayPosts.length > 0 ? day : null)}
                className={cn(
                  'min-h-[80px] p-2 border-b border-r border-border last-of-type:border-r-0 transition-colors',
                  isCurrentMonth ? 'bg-card' : 'bg-background/30',
                  dayPosts.length > 0 && 'cursor-pointer hover:bg-accent/30',
                  isSelected && 'bg-primary/5',
                )}
              >
                <span
                  className={cn(
                    'text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full',
                    isToday && 'bg-primary text-primary-foreground',
                    !isToday && isCurrentMonth && 'text-foreground',
                    !isToday && !isCurrentMonth && 'text-muted-foreground',
                  )}
                >
                  {format(day, 'd')}
                </span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {dayPosts.slice(0, 4).map((post) => {
                    const platforms = (post.platforms || []).map(getPlatformFromEntry)
                    const color = getPlatformColor(platforms[0] || 'instagram')
                    return (
                      <div
                        key={post.id}
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                    )
                  })}
                  {dayPosts.length > 4 && (
                    <span className="text-[10px] text-muted-foreground">+{dayPosts.length - 4}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Day drawer */}
      {selectedDay && selectedDayPosts.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">
              {format(selectedDay, 'MMMM d, yyyy')} — {selectedDayPosts.length} post{selectedDayPosts.length !== 1 ? 's' : ''}
            </h3>
            <button
              onClick={() => setSelectedDay(null)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <X size={14} />
            </button>
          </div>
          <div className="space-y-3">
            {selectedDayPosts.map((post) => {
              const platforms = (post.platforms || []).map(getPlatformFromEntry)
              return (
                <div key={post.id} className="flex items-start gap-3 p-3 bg-background rounded-xl">
                  <div className="flex flex-col gap-1 mt-0.5">
                    {platforms.slice(0, 3).map((platform, i) => (
                      <div key={i} className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getPlatformColor(platform) }} />
                    ))}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{post.caption || 'No caption'}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{post.scheduled_at ? formatDateTime(post.scheduled_at) : ''}</p>
                  </div>
                  <span className={cn(
                    'text-xs px-2 py-0.5 rounded-full',
                    post.status === 'published' && 'bg-green-400/10 text-green-400',
                    post.status === 'scheduled' && 'bg-yellow-400/10 text-yellow-400',
                    post.status === 'failed' && 'bg-red-400/10 text-red-400',
                    !['published', 'scheduled', 'failed'].includes(post.status) && 'bg-muted text-muted-foreground',
                  )}>
                    {post.status}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
