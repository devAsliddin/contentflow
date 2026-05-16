import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  UploadCloud, X, Play, Scissors, Captions, Image as ImageIcon, Music,
  Bold, Italic, Hash, AtSign, Smile, Sparkles, Loader2, Send, Languages,
  Check, ChevronDown, ChevronLeft, ChevronRight, Clock, Calendar, Repeat2,
  MessageSquare, MapPin, UserPlus, Info, Eye, AlertTriangle,
} from 'lucide-react'
import { accountsService } from '@/services/accounts.service'
import { postsService } from '@/services/posts.service'
import { aiService } from '@/services/ai.service'
import PlatformChip, { PLATFORM_META, type PlatformKind } from '@/components/ui/PlatformChip'
import Avatar from '@/components/ui/Avatar'
import ImgPlaceholder from '@/components/ui/ImgPlaceholder'
import StatusPill from '@/components/ui/StatusPill'
import UploadZone from '@/components/posts/UploadZone'
import type { Account } from '@/types/account.types'
import type { AspectRatio, CreatePostRequest, PlatformOptions, PlatformPlacement, PostReview } from '@/types/post.types'

const PEAK_SLOTS = ['07:15', '12:00', '15:30', '18:00', '21:30']
const ASPECTS: AspectRatio[] = ['9:16', '16:9', '1:1', '4:5']

function ToolbarBtn({ icon: Icon }: { icon: any }) {
  return (
    <button className="p-1.5 rounded-md text-faint hover:text-ink hover:bg-bg/60 transition">
      <Icon size={13} />
    </button>
  )
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2.5 py-2 rounded-md bg-bg/60 border border-line">
      <div className="text-[10px] uppercase tracking-wider text-faint">{label}</div>
      <div className="text-sm text-ink tnum mt-0.5">{value}</div>
    </div>
  )
}

function SettingsRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-bg/60 transition">
      <div className="flex items-center gap-2.5 text-sm text-ink">
        <Icon size={14} className="text-mute" />
        {label}
      </div>
      <div className="flex items-center gap-1.5 text-xs text-mute">
        {value}
        <ChevronRight size={12} />
      </div>
    </button>
  )
}

function SegmentButton({
  active, onClick, children, disabled,
}: { active: boolean; onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`px-2.5 py-1 rounded-md text-xs border transition disabled:opacity-40 disabled:cursor-not-allowed ${
        active
          ? 'bg-indigo-500/15 text-ink border-indigo-500/40'
          : 'bg-bg/40 text-mute border-line hover:border-line2 hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}

const PLACEMENT_LABEL: Record<string, string> = {
  feed: 'Post',
  reel: 'Reel',
  story: 'Story',
  post: 'Post',
}

function DestinationOptions({
  hasInstagram,
  hasTikTok,
  mediaType,
  options,
  onChange,
}: {
  hasInstagram: boolean
  hasTikTok: boolean
  mediaType?: 'image' | 'video'
  options: PlatformOptions
  onChange: (platform: 'instagram' | 'tiktok', patch: { placement?: PlatformPlacement; aspect_ratio?: AspectRatio }) => void
}) {
  if (!hasInstagram && !hasTikTok) return null

  const igPlacement = options.instagram?.placement || (mediaType === 'video' ? 'reel' : 'feed')
  const igAspect = options.instagram?.aspect_ratio || (igPlacement === 'story' || igPlacement === 'reel' ? '9:16' : mediaType === 'image' ? '1:1' : '16:9')
  const tikTokAspect = options.tiktok?.aspect_ratio || '9:16'
  const instagramPlacements: PlatformPlacement[] = mediaType === 'video' ? ['reel', 'feed', 'story'] : ['feed', 'story']

  return (
    <div className="rounded-2xl bg-surface border border-line p-5">
      <div className="text-[11px] uppercase tracking-[0.16em] text-faint mb-4">Format & destination</div>
      <div className="space-y-4">
        {hasInstagram && (
          <div className="rounded-xl border border-line bg-bg/40 p-3">
            <div className="flex items-center gap-2 mb-3">
              <PlatformChip kind="instagram" size={20} ring />
              <span className="text-sm text-ink">Instagram</span>
            </div>
            {!mediaType ? (
              <div className="text-xs text-rose-300">Text-only post Instagramga yuborilmaydi.</div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {instagramPlacements.map((placement) => (
                    <SegmentButton
                      key={placement}
                      active={igPlacement === placement}
                      onClick={() => onChange('instagram', {
                        placement,
                        aspect_ratio: placement === 'story' || placement === 'reel' ? '9:16' : igAspect,
                      })}
                    >
                      {PLACEMENT_LABEL[placement]}
                    </SegmentButton>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {ASPECTS.map((aspect) => (
                    <SegmentButton
                      key={aspect}
                      active={igAspect === aspect}
                      onClick={() => onChange('instagram', { aspect_ratio: aspect })}
                    >
                      {aspect}
                    </SegmentButton>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {hasTikTok && (
          <div className="rounded-xl border border-line bg-bg/40 p-3">
            <div className="flex items-center gap-2 mb-3">
              <PlatformChip kind="tiktok" size={20} ring />
              <span className="text-sm text-ink">TikTok</span>
            </div>
            {mediaType !== 'video' ? (
              <div className="text-xs text-rose-300">TikTok faqat video qabul qiladi.</div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  <SegmentButton active onClick={() => onChange('tiktok', { placement: 'post' })}>Post</SegmentButton>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(['9:16', '16:9'] as AspectRatio[]).map((aspect) => (
                    <SegmentButton
                      key={aspect}
                      active={tikTokAspect === aspect}
                      onClick={() => onChange('tiktok', { placement: 'post', aspect_ratio: aspect })}
                    >
                      {aspect}
                    </SegmentButton>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ReviewPanel({ review }: { review: PostReview | null }) {
  if (!review) return null
  return (
    <div className={`rounded-2xl border p-4 ${review.ok ? 'border-mint-500/30 bg-mint-500/5' : 'border-rose-500/30 bg-rose-500/5'}`}>
      <div className="flex items-center gap-2 text-sm text-ink mb-3">
        {review.ok ? <Check size={15} className="text-mint-500" /> : <AlertTriangle size={15} className="text-rose-300" />}
        Review {review.ok ? 'ready' : 'blocked'}
      </div>
      <div className="space-y-2">
        {review.errors.slice(0, 3).map((error, i) => (
          <div key={`e-${i}`} className="text-xs text-rose-200">{error}</div>
        ))}
        {review.warnings.slice(0, 3).map((warning, i) => (
          <div key={`w-${i}`} className="text-xs text-amber-200">{warning}</div>
        ))}
        {review.targets.map((target) => (
          <div key={`${target.platform}-${target.account_id}`} className="flex items-center justify-between gap-2 text-xs rounded-lg bg-bg/50 border border-line px-2.5 py-2">
            <div className="min-w-0">
              <div className="text-ink truncate">{target.account_name || target.platform}</div>
              <div className="text-faint tnum">
                {[target.placement, target.aspect_ratio].filter(Boolean).join(' · ') || 'default'}
              </div>
            </div>
            <span className={target.status === 'ready' ? 'text-mint-500' : 'text-rose-300'}>
              {target.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function MiniCalendar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const firstDay = new Date(viewYear, viewMonth, 1)
  const days = Array.from({ length: 35 }, (_, i) => i - (firstDay.getDay() + 6) % 7 + 1)
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const selected = value ? new Date(value) : null

  function selectDay(d: number) {
    const existing = value ? new Date(value) : new Date()
    const next = new Date(viewYear, viewMonth, d,
      isNaN(existing.getHours()) ? 12 : existing.getHours(),
      isNaN(existing.getMinutes()) ? 0 : existing.getMinutes())
    // format as datetime-local value: YYYY-MM-DDTHH:mm
    const pad = (n: number) => String(n).padStart(2, '0')
    onChange(`${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}T${pad(next.getHours())}:${pad(next.getMinutes())}`)
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const monthName = new Date(viewYear, viewMonth).toLocaleString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div className="bg-bg/40 rounded-lg p-3 border border-line">
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={prevMonth} className="text-mute hover:text-ink"><ChevronLeft size={14} /></button>
        <div className="text-xs text-ink font-medium tnum">{monthName}</div>
        <button type="button" onClick={nextMonth} className="text-mute hover:text-ink"><ChevronRight size={14} /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-faint mb-1">
        {['M','T','W','T','F','S','S'].map((d, i) => <div key={i}>{d}</div>)}
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

function PlatformGroup({
  kind, accounts, selected, onToggle,
}: { kind: PlatformKind; accounts: (Account & { kind: PlatformKind })[]; selected: Record<string, boolean>; onToggle: (id: string) => void }) {
  const p = PLATFORM_META[kind]
  const anySelected = accounts.some((a) => selected[a.id])
  return (
    <div className={`rounded-xl border p-3 transition ${anySelected ? 'border-line2 bg-surface2/60' : 'border-line bg-bg/40'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <PlatformChip kind={kind} size={20} ring />
          <span className="text-sm text-ink">{p.label}</span>
        </div>
        <span className="text-[10px] text-faint font-mono">{accounts.length}</span>
      </div>
      <div className="space-y-1.5">
        {accounts.map((a) => (
          <button
            key={a.id}
            onClick={() => onToggle(a.id)}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition ${selected[a.id] ? 'bg-indigo-500/10 text-ink' : 'text-mute hover:bg-surface'}`}
          >
            <Avatar name={a.account_name} size={20} hue={240} />
            <span className="text-xs font-medium flex-1 truncate">{a.account_name}</span>
            <span className={`w-4 h-4 rounded border flex items-center justify-center ${selected[a.id] ? 'bg-indigo-500 border-indigo-500' : 'border-line2'}`}>
              {selected[a.id] && <Check size={10} className="text-white" />}
            </span>
          </button>
        ))}
        {accounts.length === 0 && (
          <p className="text-[11px] text-faint text-center py-2">No accounts connected</p>
        )}
      </div>
    </div>
  )
}

export default function NewPostPage() {
  const navigate = useNavigate()
  const [caption, setCaption] = useState('')
  const [mediaUrl, setMediaUrl] = useState('')
  const [mediaType, setMediaType] = useState<'image' | 'video' | undefined>()
  const [selectedAccounts, setSelectedAccounts] = useState<Record<string, boolean>>({})
  const [scheduleMode, setScheduleMode] = useState<'now' | 'schedule'>('now')
  const [selectedTime, setSelectedTime] = useState('18:00')
  const [scheduledAt, setScheduledAt] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [hasMedia, setHasMedia] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [review, setReview] = useState<PostReview | null>(null)
  const [platformOptions, setPlatformOptions] = useState<PlatformOptions>({
    instagram: { placement: 'feed', aspect_ratio: '1:1' },
    tiktok: { placement: 'post', aspect_ratio: '9:16' },
  })

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountsService.list(),
  })

  const allAccounts = accounts.map((a) => ({ ...a, kind: a.platform as PlatformKind }))
  const accountCount = Object.values(selectedAccounts).filter(Boolean).length
  const selectedKinds = new Set(
    Object.entries(selectedAccounts)
      .filter(([, selected]) => selected)
      .map(([id]) => allAccounts.find((a) => a.id === id)?.kind)
      .filter(Boolean) as PlatformKind[]
  )
  const hasInstagramSelected = selectedKinds.has('instagram')
  const hasTikTokSelected = selectedKinds.has('tiktok')

  const toggle = (id: string) => setSelectedAccounts((s) => ({ ...s, [id]: !s[id] }))

  useEffect(() => {
    setReview(null)
    setPlatformOptions((current) => ({
      ...current,
      instagram: {
        placement: mediaType === 'video'
          ? (current.instagram?.placement === 'story' ? 'story' : 'reel')
          : current.instagram?.placement === 'story' ? 'story' : 'feed',
        aspect_ratio: mediaType === 'video'
          ? (current.instagram?.aspect_ratio || '9:16')
          : (current.instagram?.aspect_ratio === '9:16' ? '1:1' : current.instagram?.aspect_ratio || '1:1'),
      },
      tiktok: {
        placement: 'post',
        aspect_ratio: current.tiktok?.aspect_ratio === '16:9' ? '16:9' : '9:16',
      },
    }))
  }, [mediaType, mediaUrl])

  function updatePlatformOption(platform: 'instagram' | 'tiktok', patch: { placement?: PlatformPlacement; aspect_ratio?: AspectRatio }) {
    setReview(null)
    setPlatformOptions((current) => ({
      ...current,
      [platform]: {
        ...(current[platform] || {}),
        ...patch,
      },
    }))
  }

  function selectedPlatformEntries() {
    return Object.entries(selectedAccounts)
      .filter(([, v]) => v)
      .map(([id]) => {
        const account = allAccounts.find((a) => a.id === id)
        return account ? `${account.kind}:${id}` : id
      })
  }

  function buildPayload(scheduledFor: string | null = null): CreatePostRequest {
    return {
      caption: caption.trim(),
      media_url: mediaUrl || undefined,
      media_type: mediaType,
      platforms: selectedPlatformEntries(),
      platform_options: platformOptions,
      scheduled_at: scheduledFor,
    }
  }

  async function handleReview() {
    const payload = buildPayload()
    if (payload.platforms.length === 0) {
      toast.error('Select at least one account')
      return null
    }
    setReviewing(true)
    try {
      const result = await postsService.review(payload)
      setReview(result)
      if (result.ok) toast.success('Review tayyor')
      else toast.error(result.errors[0] || 'Review blocked')
      return result
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Review failed')
      return null
    } finally {
      setReviewing(false)
    }
  }

  async function handleGenerate() {
    if (!caption && accounts.length === 0) {
      toast.error('Add a topic or connect accounts first')
      return
    }
    setGenerating(true)
    try {
      const platform = allAccounts[0]?.kind || 'instagram'
      const result = await aiService.generateCaption({ topic: caption || 'lifestyle', platform, tone: 'casual' })
      setCaption(result.caption + '\n\n' + result.hashtags.map((h) => `#${h}`).join(' '))
      toast.success('Caption generated')
    } catch {
      toast.error('Failed to generate caption')
    } finally {
      setGenerating(false)
    }
  }

  async function handleSubmit() {
    const platforms = selectedPlatformEntries()

    if (platforms.length === 0) {
      toast.error('Select at least one account')
      return
    }
    if (!caption.trim() && !mediaUrl) {
      toast.error('Caption yoki media kiriting')
      return
    }

    let scheduledFor: string | null = null
    if (scheduleMode === 'schedule') {
      if (!scheduledAt) {
        toast.error('Schedule uchun sana va vaqt tanlang')
        return
      }
      const scheduledDate = new Date(scheduledAt)
      if (Number.isNaN(scheduledDate.getTime()) || scheduledDate <= new Date()) {
        toast.error('Schedule vaqti kelajakda bo\'lishi kerak')
        return
      }
      scheduledFor = scheduledDate.toISOString()
    }

    setSubmitting(true)
    try {
      const payload = buildPayload(scheduledFor)
      const reviewResult = await postsService.review(payload)
      setReview(reviewResult)
      if (!reviewResult.ok) {
        toast.error(reviewResult.errors[0] || 'Review blocked')
        return
      }

      const post = await postsService.create(payload)

      if (scheduleMode === 'now') {
        const publishResult = await postsService.triggerNow(post.id)
        if (publishResult.status === 'failed') {
          toast.error(publishResult.errors[0] || 'Post yuborilmadi')
          return
        }
        toast.success('Post yuborildi')
      } else {
        toast.success('Post schedule qilindi')
      }
      navigate('/')
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to create post')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page-in px-8 py-6 grid grid-cols-12 gap-6 max-w-[1440px]">
      {/* Left column */}
      <div className="col-span-12 lg:col-span-8 space-y-6">
        {/* Upload zone */}
        <div className="rounded-2xl bg-surface border border-line p-5">
          <UploadZone
            value={mediaUrl}
            mediaType={mediaType}
            onUpload={(url, type) => {
              setMediaUrl(url)
              setMediaType(url ? type : undefined)
            }}
          />
        </div>

        {false && (
        <div
          onDragEnter={() => setDragOver(true)}
          onDragLeave={() => setDragOver(false)}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); setHasMedia(true) }}
          className={`relative rounded-2xl bg-surface marching ${dragOver ? 'active' : ''} p-6 transition`}
          style={{ minHeight: 280 }}
        >
          {!hasMedia ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-8">
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mb-4">
                <UploadCloud size={22} className="text-indigo-400" />
              </div>
              <div className="font-display text-xl text-ink">Drop a video or image to start</div>
              <div className="text-sm text-mute mt-1">MP4, MOV, JPG, PNG · up to 500MB · 9:16, 1:1, 16:9</div>
              <div className="flex items-center gap-2 mt-4">
                <button
                  onClick={() => setHasMedia(true)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-sm rounded-lg font-medium bg-indigo-500 text-white hover:bg-indigo-400 shadow-glow-indigo transition"
                >
                  <UploadCloud size={14} />
                  Browse files
                </button>
                <button className="inline-flex items-center gap-2 px-3.5 py-2 text-sm rounded-lg font-medium bg-surface border border-line text-ink hover:border-line2 hover:bg-surface2 transition">
                  Import from URL
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-[180px_1fr] gap-5">
              <div className="relative">
                <ImgPlaceholder label="reel · 9:16" aspect="9 / 16" hue={12} className="w-full" />
                <button
                  onClick={() => setHasMedia(false)}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 backdrop-blur text-white flex items-center justify-center hover:bg-black/80"
                >
                  <X size={12} />
                </button>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                  <StatusPill kind="queued">ready to publish</StatusPill>
                  <span className="text-xs text-faint">video · 1080×1920</span>
                </div>
                <div className="font-display text-[22px] text-ink tracking-tight leading-snug">
                  Your uploaded media
                </div>
                <div className="text-sm text-mute mt-1">Auto-detected: vertical video</div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                  <MetaCell label="Aspect"   value="9 : 16" />
                  <MetaCell label="Duration" value="—" />
                  <MetaCell label="Audio"    value="Original" />
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <button className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-surface border border-line text-ink hover:border-line2 hover:bg-surface2 transition">
                    <Scissors size={12} /> Trim
                  </button>
                  <button className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-surface border border-line text-ink hover:border-line2 hover:bg-surface2 transition">
                    <ImageIcon size={12} /> Cover
                  </button>
                  <button className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-surface border border-line text-ink hover:border-line2 hover:bg-surface2 transition">
                    <Music size={12} /> Audio
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        )}

        {/* Caption editor */}
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
                onClick={handleGenerate}
                disabled={generating}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium text-indigo-400 hover:text-indigo-500 bg-indigo-500/10 border border-indigo-500/20 transition"
              >
                {generating
                  ? <Loader2 size={12} className="animate-spin" />
                  : <Sparkles size={12} />}
                {generating ? 'Generating…' : 'Generate with AI'}
              </button>
            </div>
          </div>
          <div className="relative">
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="w-full bg-transparent text-ink p-5 text-[15px] leading-relaxed focus:outline-none resize-none placeholder:text-faint"
              rows={7}
              placeholder="Write something worth reading…"
            />
            {generating && (
              <div className="absolute inset-0 shimmer pointer-events-none rounded-b-2xl" />
            )}
          </div>
          <div className="flex items-center justify-between px-5 py-3 border-t border-line text-xs">
            <div className="flex items-center gap-3 text-faint">
              <span className="inline-flex items-center gap-1.5"><Languages size={12} /> EN</span>
              <span>·</span>
              <span>Hashtags: {(caption.match(/#\w+/g) || []).length}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-mint-500 inline-flex items-center gap-1">
                <Check size={12} /> Reads at grade 6
              </span>
            </div>
          </div>
        </div>

        {/* Platform selector */}
        <div className="rounded-2xl bg-surface border border-line p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-faint mb-1">Publish to</div>
              <div className="font-display text-lg text-ink">
                {accountCount} {accountCount === 1 ? 'account' : 'accounts'} selected
              </div>
            </div>
            <button
              onClick={() => {
                const allIds = allAccounts.reduce((acc, a) => ({ ...acc, [a.id]: true }), {})
                setSelectedAccounts(allIds)
              }}
              className="text-[12px] text-mute hover:text-ink uppercase tracking-wider"
            >
              Select all
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {(['instagram', 'tiktok', 'telegram'] as PlatformKind[]).map((kind) => (
              <PlatformGroup
                key={kind}
                kind={kind}
                accounts={allAccounts.filter((a) => a.kind === kind)}
                selected={selectedAccounts}
                onToggle={toggle}
              />
            ))}
          </div>
        </div>

        <DestinationOptions
          hasInstagram={hasInstagramSelected}
          hasTikTok={hasTikTokSelected}
          mediaType={mediaType}
          options={platformOptions}
          onChange={updatePlatformOption}
        />
      </div>

      {/* Right column — schedule */}
      <aside className="col-span-12 lg:col-span-4 space-y-5">
        <div className="rounded-2xl bg-surface border border-line p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[11px] uppercase tracking-[0.16em] text-faint">When to post</div>
            <div className="flex items-center bg-bg/60 border border-line rounded-lg p-0.5 text-[11px]">
              <button
                onClick={() => setScheduleMode('now')}
                className={`px-2.5 py-1 rounded-md ${scheduleMode === 'now' ? 'bg-mint-500 text-bg' : 'text-mute hover:text-ink'}`}
              >
                Post now
              </button>
              <button
                onClick={() => setScheduleMode('schedule')}
                className={`px-2.5 py-1 rounded-md ${scheduleMode === 'schedule' ? 'bg-surface2 text-ink' : 'text-mute hover:text-ink'}`}
              >
                Schedule
              </button>
            </div>
          </div>

          {scheduleMode === 'schedule' ? (
            <div className="space-y-4">
              <div>
                <div className="text-[10px] uppercase tracking-[0.14em] text-faint mb-1.5">Date & Time</div>
                <div className="px-3 py-2.5 rounded-lg bg-bg border border-line hover:border-line2 transition">
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="w-full bg-transparent text-ink text-sm focus:outline-none"
                  />
                </div>
              </div>
              <MiniCalendar value={scheduledAt} onChange={setScheduledAt} />
              <div>
                <div className="text-[10px] uppercase tracking-[0.14em] text-faint mb-1.5">Suggested peak times</div>
                <div className="flex flex-wrap gap-1.5">
                  {PEAK_SLOTS.map((s) => (
                    <button
                      type="button"
                      key={s}
                      onClick={() => {
                        setSelectedTime(s)
                        const [h, m] = s.split(':').map(Number)
                        const base = scheduledAt ? new Date(scheduledAt) : new Date()
                        const pad = (n: number) => String(n).padStart(2, '0')
                        setScheduledAt(`${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}T${pad(h)}:${pad(m)}`)
                      }}
                      className={`px-2.5 py-1 rounded-md text-xs tnum border transition ${
                        selectedTime === s
                          ? 'bg-indigo-500/15 text-ink border-indigo-500/40'
                          : 'bg-bg/40 text-mute border-line hover:border-line2 hover:text-ink'
                      }`}
                    >
                      {s}
                      {s === '18:00' && <span className="ml-1 text-mint-500">●</span>}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-10">
              <div className="w-12 h-12 rounded-full bg-mint-500/15 border border-mint-500/30 mx-auto flex items-center justify-center mb-3">
                <Send size={18} className="text-mint-500" />
              </div>
              <div className="font-display text-lg text-ink">Publishing immediately</div>
              <div className="text-sm text-mute mt-1">
                Goes live on {accountCount} {accountCount === 1 ? 'account' : 'accounts'} as soon as you confirm.
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-surface border border-line p-5">
          <div className="text-[11px] uppercase tracking-[0.16em] text-faint mb-3">Advanced</div>
          <div className="space-y-3">
            <SettingsRow icon={Repeat2}      label="Repost cycle"   value="Off" />
            <SettingsRow icon={MessageSquare} label="First comment"  value="3 hashtags" />
            <SettingsRow icon={MapPin}        label="Location tag"   value="None" />
            <SettingsRow icon={UserPlus}      label="Collaborator"   value="None" />
          </div>
        </div>

        <ReviewPanel review={review} />

        <button
          onClick={handleReview}
          disabled={reviewing || submitting}
          className="w-full py-3 rounded-2xl bg-surface border border-line text-ink font-medium hover:border-line2 hover:bg-surface2 transition flex items-center justify-center gap-2 text-[14px] disabled:opacity-60"
        >
          {reviewing ? <Loader2 size={15} className="animate-spin" /> : <Eye size={15} />}
          Review post
        </button>

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-4 rounded-2xl bg-indigo-500 text-white font-medium shadow-glow-indigo hover:bg-indigo-400 transition flex items-center justify-center gap-2 text-[15px] disabled:opacity-60"
        >
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          {scheduleMode === 'now' ? 'Publish now' : `Add to queue · ${accountCount} ${accountCount === 1 ? 'account' : 'accounts'}`}
          {!submitting && (
            <span className="ml-2 px-2 py-0.5 rounded-md bg-white/15 text-[11px] font-mono">⌘↵</span>
          )}
        </button>

        <div className="text-center text-[11px] text-faint flex items-center justify-center gap-1.5">
          <Info size={11} />
          Posts go through review · You can edit until 5 min before publish
        </div>
      </aside>
    </div>
  )
}
