import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay,
  addMonths, subMonths, startOfWeek, endOfWeek, setHours, setMinutes,
  addDays,
} from 'date-fns'
import {
  ChevronLeft, ChevronRight, X, Filter, Plus, CalendarX, Repeat2,
  Sparkles, Loader2, Check, RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
import { postsService } from '@/services/posts.service'
import { workflowsService } from '@/services/workflows.service'
import { aiService } from '@/services/ai.service'
import { getPlatformFromEntry } from '@/utils/platform.utils'
import RecycleModal from '@/components/posts/RecycleModal'
import { cn } from '@/utils/cn'
import PlatformChip, { PLATFORM_META, type PlatformKind } from '@/components/ui/PlatformChip'
import StatusPill from '@/components/ui/StatusPill'
import ImgPlaceholder from '@/components/ui/ImgPlaceholder'
import type { Post } from '@/types/post.types'
import type {
  PlanPost, CaptionItem, Tone,
} from '@/types/api.types'
import { useNavigate } from 'react-router-dom'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const ALL_PLATFORMS: PlatformKind[] = [
  'instagram', 'telegram', 'tiktok', 'facebook', 'linkedin', 'youtube', 'twitter',
]

const TONE_OPTIONS: { value: Tone; label: string }[] = [
  { value: 'professional', label: 'Professional' },
  { value: 'casual', label: 'Casual' },
  { value: 'humorous', label: 'Humorous' },
  { value: 'educational', label: 'Educational' },
  { value: 'inspirational', label: 'Inspirational' },
]

// ── Plan post enriched with AI caption ───────────────────────────────────────

interface EnrichedPost extends PlanPost {
  caption?: string
  hashtags?: string[]
  confirmed?: boolean
  dismissed?: boolean
}

function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

function dayToDate(weekStart: Date, dayOffset: number): Date {
  return addDays(weekStart, dayOffset)
}

// ── Day event bubble ──────────────────────────────────────────────────────────

function DayEvent({ post, idx }: { post: Post; idx: number }) {
  const platforms = (post.platforms || []).map(getPlatformFromEntry) as PlatformKind[]
  const statusBg: Record<string, string> = {
    published: 'rgba(0,245,160,0.10)',
    scheduled: 'rgba(255,179,71,0.10)',
    draft: 'rgba(138,138,160,0.08)',
    failed: 'rgba(255,92,138,0.10)',
  }

  const canDrag = post.status === 'scheduled' || post.status === 'draft'

  return (
    <div
      draggable={canDrag}
      onDragStart={(e) => {
        if (!canDrag) return
        e.dataTransfer.setData('text/plain', post.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      className={`flex items-center gap-1.5 px-1.5 py-1 rounded text-[10.5px] truncate ${canDrag ? 'cursor-grab active:cursor-grabbing' : ''}`}
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

// ── Day drawer ────────────────────────────────────────────────────────────────

function DayDrawer({ day, posts, onClose }: { day: Date; posts: Post[]; onClose: () => void }) {
  const navigate = useNavigate()
  const [recyclingPost, setRecyclingPost] = useState<Post | null>(null)

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
                {post.status === 'published' && (
                  <button
                    onClick={() => setRecyclingPost(post)}
                    className="mt-2 flex items-center gap-1.5 text-xs text-mute hover:text-indigo-400 transition"
                  >
                    <Repeat2 size={11} />
                    Recycle
                  </button>
                )}
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

      {recyclingPost && (
        <RecycleModal
          post={recyclingPost}
          onClose={() => setRecyclingPost(null)}
        />
      )}
    </>
  )
}

// ── AI Plan modal ─────────────────────────────────────────────────────────────

interface AiPlanModalProps {
  weekStart: Date
  onClose: () => void
}

type AiPlanStep = 'form' | 'generating-plan' | 'generating-captions' | 'review'

function AiPlanModal({ weekStart, onClose }: AiPlanModalProps) {
  const queryClient = useQueryClient()

  // Form state
  const [niche, setNiche] = useState('')
  const [tone, setTone] = useState<Tone>('casual')
  const [frequency, setFrequency] = useState(1)
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformKind[]>(['instagram'])
  const [step, setStep] = useState<AiPlanStep>('form')
  const [planPosts, setPlanPosts] = useState<EnrichedPost[]>([])
  const [regenIdx, setRegenIdx] = useState<number | null>(null)

  const weekStartStr = format(weekStart, 'yyyy-MM-dd')

  // Step 1: generate plan
  const planMutation = useMutation({
    mutationFn: () =>
      aiService.generatePlan({
        niche,
        tone,
        frequency,
        platforms: selectedPlatforms,
        language: 'en',
        week_start: weekStartStr,
      }),
    onSuccess: async (plan) => {
      setStep('generating-captions')
      const posts: EnrichedPost[] = plan.posts.map((p) => ({
        ...p,
        confirmed: false,
        dismissed: false,
      }))
      setPlanPosts(posts)

      // Step 2: generate captions in batch
      try {
        const captionResult = await aiService.generateCaptions({
          niche,
          tone,
          posts: plan.posts.map((p) => ({
            day: p.day,
            platform: p.platform,
            idea: p.idea,
          })),
        })

        // Merge captions into posts by matching day + platform + idea
        const captionMap = new Map<string, CaptionItem>()
        captionResult.captions.forEach((c) => {
          captionMap.set(`${c.day}:${c.platform}:${c.idea}`, c)
        })

        setPlanPosts(
          posts.map((p) => {
            const key = `${p.day}:${p.platform}:${p.idea}`
            const cap = captionMap.get(key)
            return cap
              ? { ...p, caption: cap.caption, hashtags: cap.hashtags }
              : p
          }),
        )
      } catch (err) {
        toast.error('Caption generation failed — you can add captions manually')
      }

      setStep('review')
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || 'Plan generation failed')
      setStep('form')
    },
  })

  // Regenerate a single caption
  const regenMutation = useMutation({
    mutationFn: async (idx: number) => {
      const p = planPosts[idx]
      return aiService.generateCaption({
        topic: p.idea,
        platform: p.platform,
        tone,
        language: 'en',
      })
    },
    onSuccess: (result, idx) => {
      setPlanPosts((prev) =>
        prev.map((p, i) =>
          i === idx
            ? { ...p, caption: result.caption, hashtags: result.hashtags }
            : p,
        ),
      )
      setRegenIdx(null)
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || 'Caption regeneration failed')
      setRegenIdx(null)
    },
  })

  // Schedule confirmed posts
  const scheduleMutation = useMutation({
    mutationFn: async () => {
      const toSchedule = planPosts.filter((p) => p.confirmed && !p.dismissed)
      const results = await Promise.allSettled(
        toSchedule.map((p) => {
          const postDate = dayToDate(weekStart, p.day)
          const [hh, mm] = p.scheduled_time.split(':').map(Number)
          const scheduled = setMinutes(setHours(postDate, hh), mm)

          return postsService.create({
            caption: p.caption || p.idea,
            platforms: [p.platform],
            scheduled_at: scheduled.toISOString(),
          })
        }),
      )
      return results
    },
    onSuccess: (results) => {
      const ok = results.filter((r) => r.status === 'fulfilled').length
      const fail = results.filter((r) => r.status === 'rejected').length
      if (ok > 0) toast.success(`${ok} post${ok > 1 ? 's' : ''} scheduled`)
      if (fail > 0) toast.error(`${fail} post${fail > 1 ? 's' : ''} failed to schedule`)
      queryClient.invalidateQueries({ queryKey: ['posts', 'calendar'] })
      onClose()
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || 'Scheduling failed')
    },
  })

  function togglePlatform(p: PlatformKind) {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    )
  }

  const confirmedCount = planPosts.filter((p) => p.confirmed && !p.dismissed).length

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-2xl max-h-[90vh] bg-bg border border-line rounded-2xl flex flex-col shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-line shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/15 flex items-center justify-center">
                <Sparkles size={16} className="text-indigo-400" />
              </div>
              <div>
                <div className="font-semibold text-ink text-sm">AI Content Plan</div>
                <div className="text-[11px] text-faint">
                  Week of {format(weekStart, 'MMM d, yyyy')}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-faint hover:text-ink hover:bg-surface transition"
            >
              <X size={15} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            {/* Form step */}
            {step === 'form' && (
              <div className="p-5 space-y-5">
                {/* Niche */}
                <div>
                  <label className="block text-xs font-medium text-ink mb-1.5">
                    Niche / topic
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. fitness, travel, cooking…"
                    value={niche}
                    onChange={(e) => setNiche(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-surface border border-line text-ink text-sm placeholder:text-faint focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition"
                  />
                </div>

                {/* Tone */}
                <div>
                  <label className="block text-xs font-medium text-ink mb-1.5">Tone</label>
                  <div className="flex flex-wrap gap-2">
                    {TONE_OPTIONS.map((t) => (
                      <button
                        key={t.value}
                        onClick={() => setTone(t.value)}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-medium border transition',
                          tone === t.value
                            ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'
                            : 'bg-surface border-line text-mute hover:text-ink hover:border-line2',
                        )}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Frequency */}
                <div>
                  <label className="block text-xs font-medium text-ink mb-1.5">
                    Posts per platform per day:{' '}
                    <span className="text-indigo-400 font-semibold">{frequency}</span>
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={1}
                    value={frequency}
                    onChange={(e) => setFrequency(Number(e.target.value))}
                    className="w-full accent-indigo-500"
                  />
                  <div className="flex justify-between text-[10px] text-faint mt-1">
                    <span>1</span>
                    <span>2</span>
                    <span>3</span>
                  </div>
                </div>

                {/* Platforms */}
                <div>
                  <label className="block text-xs font-medium text-ink mb-1.5">Platforms</label>
                  <div className="flex flex-wrap gap-2">
                    {ALL_PLATFORMS.map((p) => (
                      <button
                        key={p}
                        onClick={() => togglePlatform(p)}
                        className={cn(
                          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition',
                          selectedPlatforms.includes(p)
                            ? 'bg-surface2 border-indigo-500/40 text-ink'
                            : 'bg-surface border-line text-mute hover:text-ink',
                        )}
                      >
                        <PlatformChip kind={p} size={14} />
                        {PLATFORM_META[p].label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Loading steps */}
            {(step === 'generating-plan' || step === 'generating-captions') && (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <Loader2 size={32} className="text-indigo-400 animate-spin" />
                <div className="text-sm text-ink">
                  {step === 'generating-plan'
                    ? 'Generating your weekly plan…'
                    : 'Writing captions for every post…'}
                </div>
                <div className="text-[12px] text-faint">This may take a few seconds</div>
              </div>
            )}

            {/* Review step */}
            {step === 'review' && (
              <div className="p-5 space-y-3">
                <div className="text-xs text-mute mb-3">
                  Check the posts you want to schedule. Click "New caption" to regenerate any
                  caption.
                </div>
                {planPosts.map((post, idx) => {
                  if (post.dismissed) return null
                  const postDate = dayToDate(weekStart, post.day)
                  const isRegen = regenIdx === idx && regenMutation.isPending

                  return (
                    <div
                      key={idx}
                      className={cn(
                        'rounded-xl border p-4 transition',
                        post.confirmed
                          ? 'bg-indigo-500/5 border-indigo-500/30'
                          : 'bg-surface border-line',
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 shrink-0">
                          <PlatformChip kind={post.platform as PlatformKind} size={18} />
                          <div>
                            <div className="text-[11px] text-mute font-mono">
                              {format(postDate, 'EEE d MMM')} · {post.scheduled_time}
                            </div>
                            <div className="text-[12px] text-faint mt-0.5 italic">{post.idea}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {/* Dismiss */}
                          <button
                            onClick={() =>
                              setPlanPosts((prev) =>
                                prev.map((p, i) =>
                                  i === idx ? { ...p, dismissed: true } : p,
                                ),
                              )
                            }
                            className="p-1 rounded text-faint hover:text-red-400 transition"
                            aria-label="Dismiss"
                          >
                            <X size={13} />
                          </button>
                          {/* Confirm toggle */}
                          <button
                            onClick={() =>
                              setPlanPosts((prev) =>
                                prev.map((p, i) =>
                                  i === idx ? { ...p, confirmed: !p.confirmed } : p,
                                ),
                              )
                            }
                            className={cn(
                              'p-1 rounded transition',
                              post.confirmed
                                ? 'text-green-400 hover:text-green-300'
                                : 'text-faint hover:text-ink',
                            )}
                            aria-label="Confirm"
                          >
                            <Check size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Caption */}
                      <div className="mt-2.5 text-[13px] text-ink leading-snug">
                        {isRegen ? (
                          <span className="text-faint italic">Regenerating…</span>
                        ) : (
                          post.caption || (
                            <span className="text-faint italic">No caption generated</span>
                          )
                        )}
                      </div>

                      {/* Hashtags */}
                      {post.hashtags && post.hashtags.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {post.hashtags.map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Regen button */}
                      <button
                        disabled={isRegen}
                        onClick={() => {
                          setRegenIdx(idx)
                          regenMutation.mutate(idx)
                        }}
                        className="mt-2 flex items-center gap-1 text-[11px] text-mute hover:text-indigo-400 transition disabled:opacity-50"
                      >
                        <RefreshCw size={10} className={isRegen ? 'animate-spin' : ''} />
                        New caption
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-5 border-t border-line shrink-0 flex items-center justify-between gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg bg-surface border border-line text-mute hover:text-ink hover:border-line2 transition"
            >
              Cancel
            </button>

            {step === 'form' && (
              <button
                disabled={!niche.trim() || selectedPlatforms.length === 0 || planMutation.isPending}
                onClick={() => {
                  setStep('generating-plan')
                  planMutation.mutate()
                }}
                className="flex items-center gap-2 px-5 py-2 text-sm rounded-lg bg-indigo-500 text-white font-medium hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {planMutation.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Sparkles size={14} />
                )}
                Generate plan
              </button>
            )}

            {step === 'review' && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-mute">
                  {confirmedCount} post{confirmedCount !== 1 ? 's' : ''} selected
                </span>
                <button
                  disabled={confirmedCount === 0 || scheduleMutation.isPending}
                  onClick={() => scheduleMutation.mutate()}
                  className="flex items-center gap-2 px-5 py-2 text-sm rounded-lg bg-indigo-500 text-white font-medium hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {scheduleMutation.isPending ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Check size={14} />
                  )}
                  Schedule {confirmedCount > 0 ? confirmedCount : ''} post
                  {confirmedCount !== 1 ? 's' : ''}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ── Main calendar page ────────────────────────────────────────────────────────

export default function CalendarPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [view, setView] = useState<'month' | 'week'>('month')
  const [draggingOver, setDraggingOver] = useState<string | null>(null)
  const [showAiPlan, setShowAiPlan] = useState(false)

  const { data: posts = [] } = useQuery({
    queryKey: ['posts', 'calendar'],
    queryFn: () => postsService.list({ limit: 100 }),
  })

  const rescheduleMutation = useMutation({
    mutationFn: async ({ postId, targetDay }: { postId: string; targetDay: Date }) => {
      const post = posts.find((p) => p.id === postId)
      if (!post) throw new Error('Post not found')

      const existingTime = post.scheduled_at ? new Date(post.scheduled_at) : new Date()
      const newDate = setMinutes(setHours(targetDay, existingTime.getHours()), existingTime.getMinutes())

      if (post.status === 'scheduled') {
        return workflowsService.transitionStatus(postId, {
          status: 'scheduled',
          scheduled_at: newDate.toISOString(),
        })
      } else {
        return postsService.update(postId, { scheduled_at: newDate.toISOString() })
      }
    },
    onSuccess: () => {
      toast.success('Post rescheduled')
      queryClient.invalidateQueries({ queryKey: ['posts', 'calendar'] })
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || 'Rescheduling failed')
    },
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
  const aiWeekStart = getMonday(currentMonth)

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

        <div className="flex items-center gap-3">
          {/* Platform legend — now shows all 7 */}
          <div className="hidden lg:flex items-center gap-3 text-xs text-mute">
            {(['instagram', 'tiktok', 'telegram', 'facebook', 'linkedin', 'youtube', 'twitter'] as PlatformKind[]).map(
              (k) => (
                <div key={k} className="flex items-center gap-1.5">
                  <PlatformChip kind={k} size={14} />
                  <span className="hidden xl:inline">{PLATFORM_META[k].label}</span>
                </div>
              ),
            )}
          </div>
          <button className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-surface border border-line text-ink hover:border-line2 hover:bg-surface2 transition">
            <Filter size={12} />
            Filter
          </button>
          {/* AI Plan button */}
          <button
            onClick={() => setShowAiPlan(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm rounded-lg font-medium bg-violet-600 text-white hover:bg-violet-500 shadow-lg transition"
          >
            <Sparkles size={14} />
            AI Plan
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
            <div
              key={d}
              className="text-[10px] uppercase tracking-[0.18em] text-faint px-3 py-2 border-r border-line last:border-r-0"
            >
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
            const dayKey = format(day, 'yyyy-MM-dd')
            const isDragTarget = draggingOver === dayKey

            return (
              <button
                key={idx}
                onClick={() => setSelectedDay(isSelected ? null : day)}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                  setDraggingOver(dayKey)
                }}
                onDragLeave={() => setDraggingOver(null)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDraggingOver(null)
                  const postId = e.dataTransfer.getData('text/plain')
                  if (postId) {
                    rescheduleMutation.mutate({ postId, targetDay: day })
                  }
                }}
                className={cn(
                  'group relative min-h-[112px] p-2 text-left border-r border-b border-line transition',
                  (idx + 1) % 7 === 0 ? '!border-r-0' : '',
                  isCurrentMonth ? 'hover:bg-surface2/60' : 'bg-bg/40',
                  isSelected && 'bg-surface2/40',
                  isDragTarget && 'bg-indigo-500/10 border-indigo-500/40',
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

      {/* AI Plan modal */}
      {showAiPlan && (
        <AiPlanModal
          weekStart={aiWeekStart}
          onClose={() => setShowAiPlan(false)}
        />
      )}
    </div>
  )
}
