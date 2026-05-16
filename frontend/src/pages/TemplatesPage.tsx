import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Trash2, Loader2, BookTemplate, Copy, X, Hash } from 'lucide-react'
import { workflowsService, type PostTemplate, type TemplateCreateRequest } from '@/services/workflows.service'
import PlatformChip, { type PlatformKind } from '@/components/ui/PlatformChip'
import { formatRelative } from '@/utils/date.utils'

function TemplateCard({
  template,
  onUse,
}: {
  template: PostTemplate
  onUse: (t: PostTemplate) => void
}) {
  const queryClient = useQueryClient()

  const deleteMutation = useMutation({
    mutationFn: () => workflowsService.deleteTemplate(template.id),
    onSuccess: () => {
      toast.success('Template o\'chirildi')
      queryClient.invalidateQueries({ queryKey: ['templates'] })
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || 'Xato'),
  })

  const platforms = (template.platforms || []).map((p) => {
    const parts = String(p).split(':')
    return parts[0] as PlatformKind
  })

  return (
    <div className="rounded-2xl bg-surface border border-line p-5 lift flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="font-medium text-ink text-sm truncate flex-1">{template.name}</div>
        <span className="text-[10px] text-faint tnum shrink-0">{formatRelative(template.created_at)}</span>
      </div>

      {platforms.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {platforms.map((p, i) => (
            <PlatformChip key={i} kind={p} size={16} />
          ))}
        </div>
      )}

      {template.caption && (
        <p className="text-sm text-mute line-clamp-3 leading-relaxed">{template.caption}</p>
      )}

      {template.hashtags && template.hashtags.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          <Hash size={10} className="text-faint" />
          {template.hashtags.slice(0, 5).map((tag, i) => (
            <span key={i} className="text-[11px] text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">
              {tag}
            </span>
          ))}
          {template.hashtags.length > 5 && (
            <span className="text-[10px] text-faint">+{template.hashtags.length - 5}</span>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 mt-auto pt-2">
        <button
          onClick={() => onUse(template)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 hover:bg-indigo-500/20 transition"
        >
          <Copy size={11} />
          Use Template
        </button>
        <button
          onClick={() => deleteMutation.mutate()}
          disabled={deleteMutation.isPending}
          className="flex items-center justify-center p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition"
        >
          {deleteMutation.isPending ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Trash2 size={12} />
          )}
        </button>
      </div>
    </div>
  )
}

function CreateTemplateModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [caption, setCaption] = useState('')
  const [hashtagInput, setHashtagInput] = useState('')
  const [hashtags, setHashtags] = useState<string[]>([])

  const createMutation = useMutation({
    mutationFn: (payload: TemplateCreateRequest) => workflowsService.createTemplate(payload),
    onSuccess: () => {
      toast.success('Template yaratildi')
      queryClient.invalidateQueries({ queryKey: ['templates'] })
      onClose()
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || 'Xato'),
  })

  function addHashtag(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const tag = hashtagInput.trim().replace(/^#/, '')
      if (tag && !hashtags.includes(`#${tag}`)) {
        setHashtags((prev) => [...prev, `#${tag}`])
      }
      setHashtagInput('')
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Nom kiriting')
      return
    }
    createMutation.mutate({
      name: name.trim(),
      caption: caption.trim() || undefined,
      hashtags,
    })
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 px-4">
        <div className="w-full max-w-md bg-bg border border-line rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-5 border-b border-line flex items-center justify-between">
            <h2 className="font-display text-lg text-ink">Yangi Template</h2>
            <button onClick={onClose} className="p-1.5 rounded-md text-faint hover:text-ink hover:bg-surface">
              <X size={16} />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div>
              <label className="text-[10px] uppercase tracking-[0.14em] text-faint mb-1.5 block">Nom *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Masalan: Kunlik motivatsiya"
                className="w-full px-3 py-2 rounded-lg bg-surface border border-line text-ink text-sm focus:outline-none focus:border-indigo-500/60"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.14em] text-faint mb-1.5 block">Caption</label>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Standart caption matni..."
                rows={4}
                className="w-full px-3 py-2 rounded-lg bg-surface border border-line text-ink text-sm focus:outline-none focus:border-indigo-500/60 resize-none"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.14em] text-faint mb-1.5 block">
                Hashtaglar (Enter yoki vergul bilan qo'shing)
              </label>
              <input
                value={hashtagInput}
                onChange={(e) => setHashtagInput(e.target.value)}
                onKeyDown={addHashtag}
                placeholder="#tag1"
                className="w-full px-3 py-2 rounded-lg bg-surface border border-line text-ink text-sm focus:outline-none focus:border-indigo-500/60"
              />
              {hashtags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {hashtags.map((tag, i) => (
                    <span
                      key={i}
                      className="flex items-center gap-1 text-[11px] text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded cursor-pointer hover:bg-rose-500/10 hover:text-rose-400"
                      onClick={() => setHashtags((prev) => prev.filter((_, j) => j !== i))}
                    >
                      {tag}
                      <X size={8} />
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl bg-surface border border-line text-sm text-ink hover:bg-surface2 transition"
              >
                Bekor
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="flex-1 py-2.5 rounded-xl bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-400 disabled:opacity-60 transition"
              >
                {createMutation.isPending ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Saqlash'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

interface Props {
  onSelectTemplate?: (template: PostTemplate) => void
}

export default function TemplatesPage({ onSelectTemplate }: Props) {
  const [showCreate, setShowCreate] = useState(false)

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: () => workflowsService.listTemplates(),
  })

  function handleUse(template: PostTemplate) {
    if (onSelectTemplate) {
      onSelectTemplate(template)
    } else {
      toast.info(`Template: ${template.name}`)
    }
  }

  return (
    <div className="page-in px-8 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-faint mb-1">Content</div>
          <h1 className="font-display text-2xl text-ink">Template Library</h1>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-sm rounded-lg font-medium bg-indigo-500 text-white hover:bg-indigo-400 shadow-glow-indigo transition"
        >
          <Plus size={14} />
          New Template
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl bg-surface border border-line p-5 animate-pulse h-44" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-2xl bg-surface border border-line p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4">
            <BookTemplate size={22} className="text-indigo-400" />
          </div>
          <div className="font-display text-lg text-ink mb-1">Template yo'q</div>
          <div className="text-sm text-mute mb-4">Tez-tez ishlatiladigan caption'larni template qilib saqlang</div>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-400 transition"
          >
            <Plus size={14} />
            Birinchi template
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <TemplateCard key={t.id} template={t} onUse={handleUse} />
          ))}
        </div>
      )}

      {showCreate && <CreateTemplateModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}
