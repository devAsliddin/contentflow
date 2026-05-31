import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Bold, Italic, Hash, AtSign, Smile, Sparkles, Loader2, Send, Check,
  Clock, Info,
} from 'lucide-react'
import { toast } from 'sonner'
import { accountsService } from '@/services/accounts.service'
import { postsService } from '@/services/posts.service'
import { aiService } from '@/services/ai.service'
import { previewService } from '@/services/preview.service'
import PlatformChip, { type PlatformKind, PLATFORM_META } from '@/components/ui/PlatformChip'
import Avatar from '@/components/ui/Avatar'
import ContentTypeSelector from './ContentTypeSelector'
import MediaUploader from './MediaUploader'
import PreviewSwitcher from './PreviewSwitcher'
import type { ContentType, PostAspect } from './types'
import type { Account } from '@/types/account.types'

const SUPPORTED_PLATFORMS: PlatformKind[] = [
  'instagram', 'tiktok', 'telegram', 'facebook', 'linkedin', 'youtube', 'twitter',
]

function ToolbarBtn({ icon: Icon }: { icon: any }) {
  return (
    <button type="button" className="p-1.5 rounded-md text-faint hover:text-ink hover:bg-bg/60 transition">
      <Icon size={13} />
    </button>
  )
}

function PlatformToggleGroup({
  kind,
  accounts,
  selected,
  onToggle,
}: {
  kind: PlatformKind
  accounts: Account[]
  selected: Set<string>
  onToggle: (id: string) => void
}) {
  const p = PLATFORM_META[kind]
  const anySelected = accounts.some((a) => selected.has(a.id))

  return (
    <div className={`rounded-xl border p-2.5 transition ${anySelected ? 'border-line2 bg-surface2/60' : 'border-line bg-bg/40'}`}>
      <div className="flex items-center gap-1.5 mb-2">
        <PlatformChip kind={kind} size={16} ring />
        <span className="text-[11px] text-ink">{p.label}</span>
      </div>
      {accounts.length === 0 ? (
        <p className="text-[10px] text-faint text-center py-1">Not connected</p>
      ) : (
        <div className="space-y-1">
          {accounts.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => onToggle(a.id)}
              className={`w-full flex items-center gap-1.5 px-1.5 py-1 rounded-md text-left text-xs transition ${
                selected.has(a.id) ? 'bg-indigo-500/10 text-ink' : 'text-mute hover:bg-surface'
              }`}
            >
              <Avatar name={a.account_name} size={18} hue={240} />
              <span className="flex-1 truncate">{a.account_name}</span>
              <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${selected.has(a.id) ? 'bg-indigo-500 border-indigo-500' : 'border-line2'}`}>
                {selected.has(a.id) && <Check size={8} className="text-white" />}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function PreviewScreen() {
  const navigate = useNavigate()

  const [contentType, setContentType] = useState<ContentType>('post')
  const [postAspect, setPostAspect] = useState<PostAspect>('1:1')
  const [mediaUrl, setMediaUrl] = useState('')
  const [mediaType, setMediaType] = useState<'image' | 'video' | undefined>()
  const [caption, setCaption] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [generating, setGenerating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [scheduleMode, setScheduleMode] = useState<'now' | 'schedule'>('now')
  const [scheduledAt, setScheduledAt] = useState('')

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountsService.list(),
  })

  const { data: connectedAccounts = [] } = useQuery({
    queryKey: ['accounts-connected'],
    queryFn: () => previewService.getConnected(),
  })

  const toggle = (id: string) => setSelected((s) => {
    const next = new Set(s)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  const selectedPlatforms = SUPPORTED_PLATFORMS.filter((p) =>
    accounts.some((a) => a.platform === p && selected.has(a.id))
  )

  async function handleGenerate() {
    setGenerating(true)
    try {
      const platform = selectedPlatforms[0] || 'instagram'
      const result = await aiService.generateCaption({
        topic: caption || 'content',
        platform,
        tone: 'casual',
        image_url: mediaUrl || undefined,
      })
      const tags = result.hashtags.length > 0 ? '\n\n' + result.hashtags.map((h: string) => `#${h}`).join(' ') : ''
      setCaption(result.caption + tags)
      toast.success('Caption generated')
    } catch {
      toast.error('Could not generate caption')
    } finally {
      setGenerating(false)
    }
  }

  function buildPlatformEntries() {
    return Array.from(selected)
      .map((id) => {
        const acc = accounts.find((a) => a.id === id)
        return acc ? `${acc.platform}:${id}` : null
      })
      .filter(Boolean) as string[]
  }

  async function handleAction(mode: 'now' | 'schedule') {
    const platformEntries = buildPlatformEntries()
    if (platformEntries.length === 0) {
      toast.error('Select at least one account')
      return
    }
    if (!caption.trim() && !mediaUrl) {
      toast.error('Add a caption or media')
      return
    }

    let scheduledFor: string | null = null
    if (mode === 'schedule') {
      if (!scheduledAt) {
        toast.error('Pick a schedule date and time')
        return
      }
      const dt = new Date(scheduledAt)
      if (isNaN(dt.getTime()) || dt <= new Date()) {
        toast.error('Scheduled time must be in the future')
        return
      }
      scheduledFor = dt.toISOString()
    }

    setSubmitting(true)
    try {
      const contentTypeToPlacement = { post: 'feed', story: 'story', reel: 'reel' } as const
      const igAspect = (contentType === 'post' ? postAspect : '9:16') as import('@/types/post.types').AspectRatio
      const payload = {
        caption: caption.trim(),
        media_url: mediaUrl || undefined,
        media_type: mediaType,
        platforms: platformEntries,
        platform_options: {
          instagram: {
            placement: contentTypeToPlacement[contentType],
            aspect_ratio: igAspect,
          },
          tiktok: { placement: 'post' as const, aspect_ratio: '9:16' as const },
        },
        scheduled_at: scheduledFor,
      }

      const review = await postsService.review(payload)
      if (!review.ok) {
        toast.error(review.errors[0] || 'Review blocked')
        return
      }

      const post = await postsService.create(payload)

      if (mode === 'now') {
        const result = await postsService.triggerNow(post.id)
        if (result.status === 'failed') {
          toast.error(result.errors?.[0] || 'Publish failed')
          return
        }
        toast.success('Post published!')
      } else {
        toast.success('Post scheduled!')
      }
      navigate('/dashboard')
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to publish')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page-in px-6 py-6 grid grid-cols-12 gap-6 max-w-[1440px]">
      {/* Left — Editor */}
      <div className="col-span-12 xl:col-span-7 space-y-5">
        <ContentTypeSelector
          value={contentType}
          postAspect={postAspect}
          onChange={setContentType}
          onAspectChange={setPostAspect}
        />

        <MediaUploader
          contentType={contentType}
          postAspect={postAspect}
          mediaUrl={mediaUrl}
          mediaType={mediaType}
          onUpload={(url, type) => { setMediaUrl(url); setMediaType(url ? type : undefined) }}
          onClear={() => { setMediaUrl(''); setMediaType(undefined) }}
        />

        {/* Caption */}
        <div className="rounded-2xl bg-surface border border-line overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-line">
            <div className="flex items-center gap-3">
              <span className="text-[11px] uppercase tracking-[0.16em] text-faint">Caption</span>
              <span className="text-[11px] text-mute tnum">{caption.length} / 2,200</span>
            </div>
            <div className="flex items-center gap-1">
              <ToolbarBtn icon={Bold} />
              <ToolbarBtn icon={Italic} />
              <ToolbarBtn icon={Hash} />
              <ToolbarBtn icon={AtSign} />
              <ToolbarBtn icon={Smile} />
              <div className="w-px h-4 bg-line mx-1" />
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium text-indigo-400 hover:text-indigo-500 bg-indigo-500/10 border border-indigo-500/20 transition"
              >
                {generating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {generating ? 'Generating…' : 'AI Caption'}
              </button>
            </div>
          </div>
          <div className="relative">
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="w-full bg-transparent text-ink p-5 text-[15px] leading-relaxed focus:outline-none resize-none placeholder:text-faint"
              rows={5}
              placeholder="Write something worth reading…"
            />
          </div>
        </div>

        {/* Platform toggles */}
        <div className="rounded-2xl bg-surface border border-line p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[11px] uppercase tracking-[0.16em] text-faint">Publish to</div>
            <button
              type="button"
              onClick={() => setSelected(new Set(accounts.map((a) => a.id)))}
              className="text-[11px] text-mute hover:text-ink uppercase tracking-wider"
            >
              Select all
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {SUPPORTED_PLATFORMS.map((kind) => (
              <PlatformToggleGroup
                key={kind}
                kind={kind}
                accounts={accounts.filter((a) => a.platform === kind)}
                selected={selected}
                onToggle={toggle}
              />
            ))}
          </div>
        </div>

        {/* Schedule row */}
        <div className="rounded-2xl bg-surface border border-line p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[11px] uppercase tracking-[0.16em] text-faint">When to post</div>
            <div className="flex items-center bg-bg/60 border border-line rounded-lg p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setScheduleMode('now')}
                className={`px-2.5 py-1 rounded-md transition ${scheduleMode === 'now' ? 'bg-mint-500 text-bg' : 'text-mute hover:text-ink'}`}
              >
                Post now
              </button>
              <button
                type="button"
                onClick={() => setScheduleMode('schedule')}
                className={`px-2.5 py-1 rounded-md transition ${scheduleMode === 'schedule' ? 'bg-surface2 text-ink' : 'text-mute hover:text-ink'}`}
              >
                Schedule
              </button>
            </div>
          </div>
          {scheduleMode === 'schedule' && (
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full bg-bg border border-line rounded-lg px-3 py-2.5 text-ink text-sm focus:outline-none focus:border-indigo-500/50"
            />
          )}
        </div>

        {/* Bottom action bar */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => handleAction('schedule')}
            disabled={submitting}
            className="flex-1 py-3.5 rounded-2xl bg-surface border border-line text-ink font-medium hover:border-line2 hover:bg-surface2 transition flex items-center justify-center gap-2 text-[14px] disabled:opacity-60"
          >
            {submitting ? <Loader2 size={15} className="animate-spin" /> : <Clock size={15} />}
            Schedule
          </button>
          <button
            type="button"
            onClick={() => handleAction('now')}
            disabled={submitting}
            className="flex-1 py-3.5 rounded-2xl bg-indigo-500 text-white font-medium shadow-glow-indigo hover:bg-indigo-400 transition flex items-center justify-center gap-2 text-[14px] disabled:opacity-60"
          >
            {submitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            Post Now
          </button>
        </div>

        <div className="text-center text-[11px] text-faint flex items-center justify-center gap-1.5">
          <Info size={11} />
          Posts go through review before publishing
        </div>
      </div>

      {/* Right — Live Preview */}
      <aside className="col-span-12 xl:col-span-5">
        <div className="rounded-2xl bg-surface border border-line p-5 sticky top-6">
          <div className="text-[11px] uppercase tracking-[0.16em] text-faint mb-4">Live preview</div>
          <PreviewSwitcher
            platforms={selectedPlatforms}
            connectedAccounts={connectedAccounts}
            contentType={contentType}
            postAspect={postAspect}
            mediaUrl={mediaUrl}
            mediaType={mediaType}
            caption={caption}
          />
        </div>
      </aside>
    </div>
  )
}
