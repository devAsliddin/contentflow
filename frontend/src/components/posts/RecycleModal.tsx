import { useState } from 'react'
import { X, Repeat2, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { workflowsService } from '@/services/workflows.service'
import type { Post } from '@/types/post.types'
import PlatformChip, { type PlatformKind } from '@/components/ui/PlatformChip'
import { getPlatformFromEntry } from '@/utils/platform.utils'

interface Props {
  post: Post
  onClose: () => void
}

function MiniCalendar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const firstDay = new Date(viewYear, viewMonth, 1)
  const days = Array.from({ length: 35 }, (_, i) => i - (firstDay.getDay() + 6) % 7 + 1)
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const selected = value ? new Date(value) : null
  const pad = (n: number) => String(n).padStart(2, '0')

  function selectDay(d: number) {
    const existing = value ? new Date(value) : new Date()
    const next = new Date(
      viewYear, viewMonth, d,
      isNaN(existing.getHours()) ? 12 : existing.getHours(),
      isNaN(existing.getMinutes()) ? 0 : existing.getMinutes(),
    )
    onChange(`${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}T${pad(next.getHours())}:${pad(next.getMinutes())}`)
  }

  return (
    <div className="bg-bg/40 rounded-lg p-3 border border-line">
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => viewMonth === 0 ? (setViewMonth(11), setViewYear(y => y - 1)) : setViewMonth(m => m - 1)}
          className="text-mute hover:text-ink"
        >
          <ChevronLeft size={14} />
        </button>
        <div className="text-xs text-ink font-medium tnum">
          {new Date(viewYear, viewMonth).toLocaleString('en-US', { month: 'long', year: 'numeric' })}
        </div>
        <button
          type="button"
          onClick={() => viewMonth === 11 ? (setViewMonth(0), setViewYear(y => y + 1)) : setViewMonth(m => m + 1)}
          className="text-mute hover:text-ink"
        >
          <ChevronRight size={14} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-faint mb-1">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <div key={i}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] tnum">
        {days.map((d, i) => {
          const valid = d >= 1 && d <= daysInMonth
          const isToday = valid && d === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear()
          const isSelected = valid && selected && d === selected.getDate() && viewMonth === selected.getMonth() && viewYear === selected.getFullYear()
          return (
            <button
              type="button"
              key={i}
              onClick={() => valid && selectDay(d)}
              className={`h-7 rounded relative ${isSelected ? 'bg-indigo-500 text-white' : isToday ? 'bg-indigo-500/20 text-indigo-300' : valid ? 'text-ink hover:bg-surface2' : 'text-faint/30 cursor-default'}`}
            >
              {valid ? d : ''}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function RecycleModal({ post, onClose }: Props) {
  const queryClient = useQueryClient()
  const [scheduledAt, setScheduledAt] = useState('')
  const platforms = (post.platforms || []).map(getPlatformFromEntry) as PlatformKind[]

  const recycleMutation = useMutation({
    mutationFn: () =>
      workflowsService.recyclePost(post.id, {
        scheduled_at: new Date(scheduledAt).toISOString(),
      }),
    onSuccess: (newPost) => {
      toast.success('Post qayta rejalashtiriildi')
      queryClient.invalidateQueries({ queryKey: ['posts'] })
      onClose()
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || 'Xato yuz berdi'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!scheduledAt) {
      toast.error('Vaqt tanlang')
      return
    }
    const dt = new Date(scheduledAt)
    if (isNaN(dt.getTime()) || dt <= new Date()) {
      toast.error('Kelajakdagi vaqt tanlang')
      return
    }
    recycleMutation.mutate()
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 px-4">
        <div className="w-full max-w-sm bg-bg border border-line rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-5 border-b border-line flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg text-ink flex items-center gap-2">
                <Repeat2 size={18} className="text-indigo-400" />
                Recycle Post
              </h2>
              <div className="text-xs text-faint mt-0.5">Yangi vaqt bilan qayta joylashtirish</div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-md text-faint hover:text-ink hover:bg-surface">
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Post preview */}
            <div className="rounded-xl bg-surface border border-line p-3">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {platforms.map((p, i) => <PlatformChip key={i} kind={p} size={16} />)}
              </div>
              <p className="text-xs text-mute line-clamp-2">
                {post.caption || 'No caption'}
              </p>
            </div>

            {/* Time picker */}
            <div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-faint mb-1.5">Yangi sana va vaqt</div>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-surface border border-line text-ink text-sm focus:outline-none focus:border-indigo-500/60 mb-3"
              />
              <MiniCalendar value={scheduledAt} onChange={setScheduledAt} />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl bg-surface border border-line text-sm text-ink hover:bg-surface2 transition"
              >
                Bekor
              </button>
              <button
                type="submit"
                disabled={!scheduledAt || recycleMutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-400 disabled:opacity-50 transition"
              >
                {recycleMutation.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Repeat2 size={14} />
                )}
                Recycle
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
