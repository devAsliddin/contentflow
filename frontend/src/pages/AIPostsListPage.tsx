/**
 * V6 — AI Post ro'yxat sahifasi
 * Route: /dashboard/ai-posts
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Edit3, Loader2, Plus, Sparkles, Trash2 } from 'lucide-react'
import { aiPostsService } from '@/services/ai-posts.service'
import type { AiPostDraftListItem, AiPostStatus } from '@/types/ai-posts.types'

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  AiPostStatus,
  { label: string; cls: string }
> = {
  generating:       { label: 'Yaratilmoqda', cls: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' },
  ready:            { label: 'Tayyor',        cls: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' },
  sent_to_composer: { label: 'Yuborildi',     cls: 'bg-mint-500/10 text-mint-500 border border-mint-500/20' },
  discarded:        { label: 'O\'chirildi',   cls: 'bg-faint/10 text-faint border border-line' },
}

function StatusBadge({ status }: { status: AiPostStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.ready
  return (
    <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

// ─── Draft card ───────────────────────────────────────────────────────────────

function DraftCard({
  item,
  onContinue,
  onDelete,
}: {
  item: AiPostDraftListItem
  onContinue: () => void
  onDelete: () => void
}) {
  const caption = item.caption.length > 120
    ? item.caption.slice(0, 120) + '…'
    : item.caption

  const canContinue = item.status === 'ready' || item.status === 'generating'

  return (
    <div className="bg-surface border border-line rounded-xl overflow-hidden flex gap-0">
      {/* Thumbnail placeholder */}
      <div className="w-20 h-20 sm:w-28 sm:h-28 shrink-0 bg-surface2 flex items-center justify-center">
        {item.image_job_id ? (
          <ImageThumb jobId={item.image_job_id} />
        ) : (
          <Sparkles size={22} className="text-faint" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 p-3 flex flex-col justify-between">
        <div>
          <div className="flex items-start gap-2 mb-1">
            <StatusBadge status={item.status} />
            <span className="text-[11px] text-faint ml-auto whitespace-nowrap">
              {new Date(item.created_at).toLocaleDateString('uz-UZ')}
            </span>
          </div>
          <p className="text-sm text-ink line-clamp-2">{caption}</p>
        </div>

        <div className="flex items-center gap-2 mt-2">
          {canContinue && (
            <button
              onClick={onContinue}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs hover:bg-indigo-500/20 transition"
            >
              <Edit3 size={11} />
              Davom etish
            </button>
          )}
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg text-faint hover:text-rose-400 hover:bg-rose-500/10 transition ml-auto"
            aria-label="O'chirish"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

// Thumbnail by polling image job (only for done status)
function ImageThumb({ jobId }: { jobId: string }) {
  const { data } = useQuery({
    queryKey: ['img-job-thumb', jobId],
    queryFn: () => aiPostsService.getImageJob(jobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'done' || status === 'failed' ? false : 4000
    },
  })

  if (data?.status === 'done' && data.image_url) {
    return (
      <img
        src={data.image_url}
        alt="post rasm"
        className="w-full h-full object-cover"
      />
    )
  }

  if (data?.status === 'failed') {
    return <Sparkles size={20} className="text-faint" />
  }

  return <Loader2 size={18} className="animate-spin text-faint" />
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AIPostsListPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 20

  const { data, isLoading } = useQuery({
    queryKey: ['ai-posts-list', page],
    queryFn: () => aiPostsService.list(page, PAGE_SIZE),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => aiPostsService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-posts-list'] })
      toast.success('Post o\'chirildi')
    },
    onError: () => toast.error('O\'chirishda xato'),
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="page-in px-4 sm:px-8 py-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="font-display text-2xl text-ink tracking-tight flex items-center gap-2">
            <Sparkles size={20} className="text-indigo-400" />
            AI Post Drafts
          </h1>
          <p className="text-sm text-mute mt-1">
            AI yordamida yaratilgan post loyihalari
          </p>
        </div>
        <button
          onClick={() => navigate('/dashboard/ai-posts/create')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-400 transition"
        >
          <Plus size={15} />
          Yangi post
        </button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-mute text-sm py-16 justify-center">
          <Loader2 size={16} className="animate-spin" /> Yuklanmoqda…
        </div>
      ) : items.length === 0 ? (
        <div className="bg-surface border border-line rounded-2xl p-12 text-center">
          <Sparkles size={32} className="text-indigo-400 mx-auto mb-3" />
          <p className="text-mute text-sm mb-4">
            Hali AI post yaratilmagan. Birinchi postni yarating.
          </p>
          <button
            onClick={() => navigate('/dashboard/ai-posts/create')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-400 transition mx-auto"
          >
            <Plus size={14} />
            AI Post yaratish
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((item) => (
            <DraftCard
              key={item.id}
              item={item}
              onContinue={() => navigate('/dashboard/ai-posts/create')}
              onDelete={() => {
                if (confirm('Bu postni o\'chirishni tasdiqlaysizmi?')) {
                  deleteMutation.mutate(item.id)
                }
              }}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 rounded-lg border border-line text-sm text-mute hover:text-ink disabled:opacity-40 transition"
          >
            Oldingi
          </button>
          <span className="text-sm text-faint tnum">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 rounded-lg border border-line text-sm text-mute hover:text-ink disabled:opacity-40 transition"
          >
            Keyingi
          </button>
        </div>
      )}
    </div>
  )
}
