import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CheckCircle2, XCircle, Loader2, ClipboardCheck, Clock } from 'lucide-react'
import { postsService } from '@/services/posts.service'
import { workflowsService } from '@/services/workflows.service'
import PlatformChip, { type PlatformKind } from '@/components/ui/PlatformChip'
import StatusPill from '@/components/ui/StatusPill'
import { formatRelative, formatDateTime } from '@/utils/date.utils'
import { getPlatformFromEntry } from '@/utils/platform.utils'
import type { Post } from '@/types/post.types'

function ApprovalCard({ post }: { post: Post }) {
  const queryClient = useQueryClient()
  const platforms = (post.platforms || []).map(getPlatformFromEntry) as PlatformKind[]

  const approveMutation = useMutation({
    mutationFn: () =>
      workflowsService.transitionStatus(post.id, { status: 'approved' }),
    onSuccess: () => {
      toast.success('Post tasdiqlandi')
      queryClient.invalidateQueries({ queryKey: ['posts', 'pending'] })
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || 'Xato'),
  })

  const rejectMutation = useMutation({
    mutationFn: () =>
      workflowsService.transitionStatus(post.id, { status: 'draft' }),
    onSuccess: () => {
      toast.success('Post draft\'ga qaytarildi')
      queryClient.invalidateQueries({ queryKey: ['posts', 'pending'] })
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || 'Xato'),
  })

  const isPending = approveMutation.isPending || rejectMutation.isPending

  return (
    <div className="rounded-2xl bg-surface border border-line p-5 lift">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {platforms.map((p, i) => (
            <PlatformChip key={i} kind={p} size={18} ring />
          ))}
          <StatusPill kind="pending_review">Pending Review</StatusPill>
        </div>
        <span className="text-[11px] text-faint tnum shrink-0">
          {formatRelative(post.updated_at)}
        </span>
      </div>

      {post.media_url && (
        <div className="mb-3 rounded-xl bg-bg/40 border border-line px-3 py-2 text-xs text-mute flex items-center gap-2">
          <span className="capitalize">{post.media_type || 'media'}</span>
          <span>·</span>
          <span className="truncate font-mono">{post.media_url}</span>
        </div>
      )}

      <p className="text-sm text-ink leading-relaxed line-clamp-4 mb-4">
        {post.caption || <span className="text-faint italic">Caption yo'q</span>}
      </p>

      {post.scheduled_at && (
        <div className="flex items-center gap-1.5 text-xs text-amber-400 mb-4">
          <Clock size={12} />
          Scheduled: {formatDateTime(post.scheduled_at)}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={() => approveMutation.mutate()}
          disabled={isPending}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-mint-500/10 border border-mint-500/30 text-sm font-medium text-mint-500 hover:bg-mint-500/20 disabled:opacity-50 transition"
        >
          {approveMutation.isPending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <CheckCircle2 size={14} />
          )}
          Approve
        </button>
        <button
          onClick={() => rejectMutation.mutate()}
          disabled={isPending}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-sm font-medium text-rose-400 hover:bg-rose-500/20 disabled:opacity-50 transition"
        >
          {rejectMutation.isPending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <XCircle size={14} />
          )}
          Reject
        </button>
      </div>
    </div>
  )
}

export default function ApprovalPage() {
  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['posts', 'pending'],
    queryFn: () => postsService.list({ status: 'pending_review', limit: 50 }),
    refetchInterval: 30000, // refresh every 30s
  })

  return (
    <div className="page-in px-8 py-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-faint mb-1">Workflow</div>
          <h1 className="font-display text-2xl text-ink">Approval Queue</h1>
        </div>
        {posts.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-xs text-amber-400">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            {posts.length} awaiting review
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-2xl bg-surface border border-line p-5 animate-pulse h-44" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-2xl bg-surface border border-line p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-mint-500/10 border border-mint-500/20 flex items-center justify-center mx-auto mb-4">
            <ClipboardCheck size={22} className="text-mint-500" />
          </div>
          <div className="font-display text-lg text-ink mb-1">Hammasi ko'rib chiqildi</div>
          <div className="text-sm text-mute">Hozircha tasdiqlash kutayotgan post yo'q</div>
        </div>
      ) : (
        <div className="grid gap-4">
          <div className="text-sm text-mute">{posts.length} post tasdiqlanishini kutmoqda</div>
          {posts.map((post) => (
            <ApprovalCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  )
}
