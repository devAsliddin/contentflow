import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { FileEdit, Clock, Trash2, Send, Loader2, FilePlus2, ChevronRight } from 'lucide-react'
import { postsService } from '@/services/posts.service'
import { workflowsService } from '@/services/workflows.service'
import PlatformChip, { type PlatformKind } from '@/components/ui/PlatformChip'
import StatusPill from '@/components/ui/StatusPill'
import { formatRelative } from '@/utils/date.utils'
import { getPlatformFromEntry } from '@/utils/platform.utils'
import type { Post } from '@/types/post.types'

function DraftCard({ post, onDelete }: { post: Post; onDelete: (id: string) => void }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [scheduling, setScheduling] = useState(false)
  const [scheduledAt, setScheduledAt] = useState('')

  const platforms = (post.platforms || []).map(getPlatformFromEntry) as PlatformKind[]

  const sendToPendingMutation = useMutation({
    mutationFn: () =>
      workflowsService.transitionStatus(post.id, { status: 'pending_review' }),
    onSuccess: () => {
      toast.success('Post approval uchun yuborildi')
      queryClient.invalidateQueries({ queryKey: ['posts', 'drafts'] })
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || 'Xato yuz berdi'),
  })

  const scheduleNowMutation = useMutation({
    mutationFn: () =>
      workflowsService.transitionStatus(post.id, {
        status: 'scheduled',
        scheduled_at: new Date(scheduledAt).toISOString(),
      }),
    onSuccess: () => {
      toast.success('Post schedule qilindi')
      setScheduling(false)
      queryClient.invalidateQueries({ queryKey: ['posts', 'drafts'] })
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || 'Xato yuz berdi'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => postsService.delete(post.id),
    onSuccess: () => {
      toast.success('Draft o\'chirildi')
      onDelete(post.id)
      queryClient.invalidateQueries({ queryKey: ['posts', 'drafts'] })
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || 'O\'chirishda xato'),
  })

  return (
    <div className="rounded-2xl bg-surface border border-line p-5 lift transition">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {platforms.map((p, i) => (
            <PlatformChip key={i} kind={p} size={18} ring />
          ))}
          <StatusPill kind={post.status}>{post.status}</StatusPill>
        </div>
        <span className="text-[11px] text-faint tnum shrink-0">
          {formatRelative(post.created_at)}
        </span>
      </div>

      <p className="text-sm text-ink leading-relaxed line-clamp-3 mb-4">
        {post.caption || <span className="text-faint italic">Caption yo'q</span>}
      </p>

      {scheduling && (
        <div className="mb-3 p-3 rounded-xl bg-bg/60 border border-line">
          <div className="text-[10px] uppercase tracking-[0.14em] text-faint mb-1.5">Schedule vaqti</div>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="w-full bg-transparent text-ink text-sm focus:outline-none border border-line rounded-lg px-3 py-2"
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => scheduleNowMutation.mutate()}
              disabled={!scheduledAt || scheduleNowMutation.isPending}
              className="flex-1 py-1.5 rounded-lg bg-indigo-500 text-white text-xs font-medium hover:bg-indigo-400 disabled:opacity-50 transition"
            >
              {scheduleNowMutation.isPending ? <Loader2 size={12} className="animate-spin mx-auto" /> : 'Tasdiqlash'}
            </button>
            <button
              onClick={() => setScheduling(false)}
              className="px-3 py-1.5 rounded-lg bg-surface border border-line text-xs text-ink hover:bg-surface2 transition"
            >
              Bekor
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => navigate(`/new-post?edit=${post.id}`)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-line text-xs text-ink hover:bg-surface2 transition"
        >
          <FileEdit size={12} />
          Edit
        </button>
        <button
          onClick={() => setScheduling(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-line text-xs text-ink hover:bg-surface2 transition"
        >
          <Clock size={12} />
          Schedule
        </button>
        <button
          onClick={() => sendToPendingMutation.mutate()}
          disabled={sendToPendingMutation.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 hover:bg-indigo-500/20 transition"
        >
          {sendToPendingMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
          Submit for Review
        </button>
        <button
          onClick={() => deleteMutation.mutate()}
          disabled={deleteMutation.isPending}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 hover:bg-rose-500/20 transition"
        >
          {deleteMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
        </button>
      </div>
    </div>
  )
}

export default function DraftsPage() {
  const navigate = useNavigate()
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())

  const { data: drafts = [], isLoading } = useQuery({
    queryKey: ['posts', 'drafts'],
    queryFn: () => postsService.list({ status: 'draft', limit: 50 }),
  })

  const visible = drafts.filter((p) => !deletedIds.has(p.id))

  return (
    <div className="page-in px-8 py-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-faint mb-1">Workflow</div>
          <h1 className="font-display text-2xl text-ink">Draft Queue</h1>
        </div>
        <button
          onClick={() => navigate('/new-post')}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-sm rounded-lg font-medium bg-indigo-500 text-white hover:bg-indigo-400 shadow-glow-indigo transition"
        >
          <FilePlus2 size={14} />
          New Draft
        </button>
      </div>

      {isLoading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl bg-surface border border-line p-5 animate-pulse h-36" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl bg-surface border border-line p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4">
            <FileEdit size={22} className="text-indigo-400" />
          </div>
          <div className="font-display text-lg text-ink mb-1">Draft yo'q</div>
          <div className="text-sm text-mute mb-4">Yangi post yarating va draft sifatida saqlang</div>
          <button
            onClick={() => navigate('/new-post')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-400 transition"
          >
            <FilePlus2 size={14} />
            Create Draft
            <ChevronRight size={14} />
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          <div className="text-sm text-mute">{visible.length} draft</div>
          {visible.map((post) => (
            <DraftCard
              key={post.id}
              post={post}
              onDelete={(id) => setDeletedIds((s) => new Set([...s, id]))}
            />
          ))}
        </div>
      )}
    </div>
  )
}
