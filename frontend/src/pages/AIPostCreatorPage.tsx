/**
 * V6 — AI Post Yaratuvchi
 * Route: /dashboard/ai-posts/create
 * 3 qadam wizard: (1) G'oya → (2) Matn → (3) Rasm → Composer
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ArrowLeft, ArrowRight, Check, ChevronRight, Hash,
  ImageOff, Loader2, RefreshCw, Send, Sparkles, X,
  LayoutGrid, Smartphone, Film,
} from 'lucide-react'
import { accountsService } from '@/services/accounts.service'
import { analysisService } from '@/services/analysis.service'
import { aiPostsService } from '@/services/ai-posts.service'
import PlatformChip, { type PlatformKind } from '@/components/ui/PlatformChip'
import type {
  AiPostDraft,
  CaptionVariant,
  ContentType,
  ImageJobStatus,
} from '@/types/ai-posts.types'

// Content type options shared with the chat agent.
const CONTENT_TYPES: { id: ContentType; label: string; sub: string; icon: typeof LayoutGrid }[] = [
  { id: 'post',  label: 'Oddiy post', sub: 'Feed · 1:1', icon: LayoutGrid },
  { id: 'story', label: 'Story',      sub: '9:16',       icon: Smartphone },
  { id: 'reel',  label: 'Reels',      sub: 'Short · 9:16', icon: Film },
]

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORMS: { id: string; label: string; kind: PlatformKind }[] = [
  { id: 'instagram', label: 'Instagram', kind: 'instagram' },
  { id: 'facebook', label: 'Facebook', kind: 'facebook' },
  { id: 'telegram', label: 'Telegram', kind: 'telegram' },
]

const IMAGE_POLL_INTERVAL = 3000 // 3 soniya

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepBar({ current, steps }: { current: 1 | 2 | 3; steps: string[] }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((label, i) => {
        const step = (i + 1) as 1 | 2 | 3
        const active = step === current
        const done = step < current
        return (
          <div key={step} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-medium transition ${
                  done
                    ? 'bg-indigo-500 text-white'
                    : active
                    ? 'bg-indigo-500/20 text-indigo-400 ring-2 ring-indigo-500/40'
                    : 'bg-surface2 text-faint'
                }`}
              >
                {done ? <Check size={14} /> : step}
              </div>
              <span className={`text-[11px] mt-1 ${active ? 'text-ink' : 'text-faint'}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`h-px w-12 mx-2 mb-4 transition ${step < current ? 'bg-indigo-500' : 'bg-line'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Step 1: G'oya ────────────────────────────────────────────────────────────

interface Step1Props {
  onGenerate: (params: {
    accountId: string | null
    platformTargets: string[]
    topic: string | null
    ideaFromRecommendationId: string | null
    contentType: ContentType
    wantImage: boolean
  }) => void
  isLoading: boolean
}

function Step1Idea({ onGenerate, isLoading }: Step1Props) {
  const [selectedAccountId, setSelectedAccountId] = useState<string>('')
  const [platformTargets, setPlatformTargets] = useState<string[]>(['instagram'])
  const [topicMode, setTopicMode] = useState<'manual' | 'ai'>('manual')
  const [topic, setTopic] = useState('')
  const [selectedIdea, setSelectedIdea] = useState<string | null>(null)
  const [contentType, setContentType] = useState<ContentType>('post')
  const [wantImage, setWantImage] = useState(true)

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountsService.list(),
  })

  // V5 recommendations for "AI taklif" chips
  const recQuery = useQuery({
    queryKey: ['recommendations', selectedAccountId],
    queryFn: () => analysisService.getRecommendations(selectedAccountId),
    enabled: !!selectedAccountId && topicMode === 'ai',
    retry: false,
  })

  const ideas: string[] = recQuery.data?.content_ideas_directions ?? []

  function togglePlatform(pid: string) {
    setPlatformTargets((prev) =>
      prev.includes(pid) ? prev.filter((p) => p !== pid) : [...prev, pid]
    )
  }

  function handleSubmit() {
    if (platformTargets.length === 0) {
      toast.error('Kamida bitta platforma tanlang')
      return
    }
    const topicValue = topicMode === 'manual' ? (topic.trim() || null) : (selectedIdea || null)
    onGenerate({
      accountId: selectedAccountId || null,
      platformTargets,
      topic: topicValue,
      ideaFromRecommendationId: null,
      contentType,
      wantImage,
    })
  }

  return (
    <div className="space-y-6">
      {/* Account selector */}
      <div>
        <label className="block text-[10px] uppercase tracking-[0.14em] text-faint mb-1.5">
          Akkaunt (ixtiyoriy)
        </label>
        <select
          className="w-full px-3 py-2.5 bg-bg border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-indigo-500/50 transition"
          value={selectedAccountId}
          onChange={(e) => setSelectedAccountId(e.target.value)}
        >
          <option value="">Akkaunt tanlanmagan (umumiy)</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.account_name} ({a.platform})
            </option>
          ))}
        </select>
        {selectedAccountId && (
          <p className="text-[11px] text-faint mt-1">
            Tanlangan akkaunt profili asosida matn yoziladi.
          </p>
        )}
      </div>

      {/* Platform targets */}
      <div>
        <label className="block text-[10px] uppercase tracking-[0.14em] text-faint mb-2">
          Platforma(lar)
        </label>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map(({ id, label, kind }) => (
            <button
              key={id}
              onClick={() => togglePlatform(id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition ${
                platformTargets.includes(id)
                  ? 'border-indigo-500/60 bg-indigo-500/10 text-ink'
                  : 'border-line text-mute hover:text-ink hover:border-line2'
              }`}
            >
              <PlatformChip kind={kind} size={16} />
              {label}
              {platformTargets.includes(id) && <Check size={12} className="text-indigo-400" />}
            </button>
          ))}
        </div>
      </div>

      {/* Content type */}
      <div>
        <label className="block text-[10px] uppercase tracking-[0.14em] text-faint mb-2">
          Post turi
        </label>
        <div className="grid grid-cols-3 gap-2">
          {CONTENT_TYPES.map(({ id, label, sub, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setContentType(id)}
              className={`rounded-xl border px-3 py-2.5 text-left transition ${
                contentType === id
                  ? 'border-indigo-500/60 bg-indigo-500/10 text-ink'
                  : 'border-line text-mute hover:text-ink hover:border-line2'
              }`}
            >
              <Icon size={16} className={contentType === id ? 'text-indigo-400' : ''} />
              <div className="text-sm font-medium mt-1">{label}</div>
              <div className="text-[10px] text-faint mt-0.5">{sub}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Image needed? */}
      <div>
        <label className="block text-[10px] uppercase tracking-[0.14em] text-faint mb-2">
          Rasm generatsiya qilish kerakmi?
        </label>
        <div className="inline-flex rounded-lg border border-line p-0.5 bg-bg">
          {([['Ha, AI rasm yaratsin', true], ['Yo\'q, rasmsiz', false]] as const).map(([lbl, val]) => (
            <button
              key={String(val)}
              onClick={() => setWantImage(val)}
              className={`px-4 py-1.5 rounded-md text-sm transition ${
                wantImage === val ? 'bg-indigo-500 text-white' : 'text-mute hover:text-ink'
              }`}
            >
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {/* Topic mode */}
      <div>
        <label className="block text-[10px] uppercase tracking-[0.14em] text-faint mb-2">
          Mavzu
        </label>
        <div className="inline-flex rounded-lg border border-line p-0.5 bg-bg mb-3">
          {(['manual', 'ai'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setTopicMode(mode)}
              className={`px-4 py-1.5 rounded-md text-sm transition ${
                topicMode === mode ? 'bg-indigo-500 text-white' : 'text-mute hover:text-ink'
              }`}
            >
              {mode === 'manual' ? 'O\'zim yozaman' : 'AI taklif qilsin'}
            </button>
          ))}
        </div>

        {topicMode === 'manual' ? (
          <textarea
            className="w-full px-3 py-2.5 bg-bg border border-line rounded-lg text-ink text-sm placeholder:text-faint focus:outline-none focus:border-indigo-500/50 transition min-h-[80px] resize-y"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Masalan: Yangi mahsulot taqdimoti, chegirma aksiya, mijoz fikri..."
          />
        ) : (
          <div>
            {!selectedAccountId && (
              <p className="text-[12px] text-amber-400 mb-2">
                AI taklif olish uchun akkaunt tanlang.
              </p>
            )}
            {recQuery.isLoading && (
              <div className="flex items-center gap-2 text-mute text-sm py-4">
                <Loader2 size={14} className="animate-spin" /> AI taklif yuklanmoqda…
              </div>
            )}
            {recQuery.isError && (
              <p className="text-[12px] text-faint py-2">
                Tavsiyalar yuklanmadi. Akkauntda AI tahlil bo'lishi kerak.
              </p>
            )}
            {ideas.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {ideas.map((idea, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedIdea(selectedIdea === idea ? null : idea)}
                    className={`px-3 py-1.5 rounded-full border text-[13px] text-left transition ${
                      selectedIdea === idea
                        ? 'border-indigo-500/60 bg-indigo-500/10 text-ink'
                        : 'border-line text-mute hover:text-ink hover:border-line2'
                    }`}
                  >
                    <Sparkles size={11} className="inline mr-1 text-indigo-400" />
                    {idea}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <button
        onClick={handleSubmit}
        disabled={isLoading || platformTargets.length === 0}
        className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-400 transition disabled:opacity-50"
      >
        {isLoading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
        {isLoading ? 'Matn yaratilmoqda…' : 'Matn yaratish'}
        {!isLoading && <ArrowRight size={15} />}
      </button>
    </div>
  )
}

// ─── Step 2: Matn ─────────────────────────────────────────────────────────────

interface Step2Props {
  draft: AiPostDraft
  onDraftUpdate: (draft: AiPostDraft) => void
  onNext: () => void
  onBack: () => void
  nextLabel: string
  nextLoading?: boolean
}

function Step2Caption({ draft, onDraftUpdate, onNext, onBack, nextLabel, nextLoading }: Step2Props) {
  const variants: CaptionVariant[] = draft.generation_meta.variants ?? []
  const [selectedVariantIdx, setSelectedVariantIdx] = useState(0)
  const [editedCaption, setEditedCaption] = useState(
    variants[0]?.caption ?? draft.caption
  )
  const [hashtags, setHashtags] = useState<string[]>(
    variants[0]?.hashtags ?? draft.hashtags ?? []
  )
  const [newHashtag, setNewHashtag] = useState('')
  const [feedback, setFeedback] = useState('')
  const [showFeedback, setShowFeedback] = useState(false)

  const regenMutation = useMutation({
    mutationFn: () => aiPostsService.regenerateCaption(draft.id, { feedback: feedback.trim() || null }),
    onSuccess: (updated) => {
      onDraftUpdate(updated)
      const newVariants: CaptionVariant[] = updated.generation_meta.variants ?? []
      setSelectedVariantIdx(0)
      setEditedCaption(newVariants[0]?.caption ?? updated.caption)
      setHashtags(newVariants[0]?.hashtags ?? updated.hashtags ?? [])
      setFeedback('')
      setShowFeedback(false)
      toast.success('Matn qayta yozildi')
    },
    onError: () => toast.error('Matnni qayta yozishda xato'),
  })

  function selectVariant(idx: number) {
    setSelectedVariantIdx(idx)
    const v = variants[idx]
    if (v) {
      setEditedCaption(v.caption)
      setHashtags(v.hashtags ?? [])
    }
  }

  function addHashtag() {
    const tag = newHashtag.trim().replace(/^#/, '')
    if (!tag) return
    if (!hashtags.includes(tag)) setHashtags((h) => [...h, tag])
    setNewHashtag('')
  }

  function removeHashtag(tag: string) {
    setHashtags((h) => h.filter((t) => t !== tag))
  }

  function handleNext() {
    // Persist edited caption to draft state
    onDraftUpdate({
      ...draft,
      caption: editedCaption,
      hashtags,
    })
    onNext()
  }

  return (
    <div className="space-y-5">
      {/* 3 variant radio */}
      {variants.length > 0 && (
        <div>
          <label className="block text-[10px] uppercase tracking-[0.14em] text-faint mb-2">
            Variant tanlang
          </label>
          <div className="space-y-2">
            {variants.map((v, i) => (
              <button
                key={i}
                onClick={() => selectVariant(i)}
                className={`w-full text-left rounded-xl border px-4 py-3 text-sm transition ${
                  selectedVariantIdx === i
                    ? 'border-indigo-500/60 bg-indigo-500/10'
                    : 'border-line hover:border-line2 hover:bg-surface2'
                }`}
              >
                <div className="flex items-start gap-2">
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition ${
                      selectedVariantIdx === i
                        ? 'border-indigo-500 bg-indigo-500'
                        : 'border-line'
                    }`}
                  >
                    {selectedVariantIdx === i && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] text-faint mb-1">Variant {i + 1}</div>
                    <p className="text-ink line-clamp-3">{v.caption}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Edit textarea */}
      <div>
        <label className="block text-[10px] uppercase tracking-[0.14em] text-faint mb-1.5">
          Matnni tahrirlang
        </label>
        <textarea
          className="w-full px-3 py-2.5 bg-bg border border-line rounded-lg text-ink text-sm placeholder:text-faint focus:outline-none focus:border-indigo-500/50 transition min-h-[120px] resize-y"
          value={editedCaption}
          onChange={(e) => setEditedCaption(e.target.value)}
        />
      </div>

      {/* Hashtag chips */}
      <div>
        <label className="block text-[10px] uppercase tracking-[0.14em] text-faint mb-2">
          Hashtaglar
        </label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {hashtags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs"
            >
              <Hash size={10} />
              {tag}
              <button onClick={() => removeHashtag(tag)} className="hover:text-white">
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            className="flex-1 px-3 py-2 bg-bg border border-line rounded-lg text-ink text-sm placeholder:text-faint focus:outline-none focus:border-indigo-500/50 transition"
            value={newHashtag}
            onChange={(e) => setNewHashtag(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addHashtag() } }}
            placeholder="#hashtag"
          />
          <button
            onClick={addHashtag}
            className="px-3 py-2 rounded-lg border border-line text-mute hover:text-ink hover:bg-surface2 transition text-sm"
          >
            <Hash size={14} />
          </button>
        </div>
      </div>

      {/* Qayta yozish */}
      <div>
        <button
          onClick={() => setShowFeedback((v) => !v)}
          className="text-[13px] text-indigo-400 hover:text-indigo-300 transition flex items-center gap-1"
        >
          <RefreshCw size={13} />
          Qayta yozish
          {showFeedback && <ChevronRight size={12} className="rotate-90" />}
        </button>

        {showFeedback && (
          <div className="mt-2 space-y-2">
            <textarea
              className="w-full px-3 py-2 bg-bg border border-line rounded-lg text-ink text-sm placeholder:text-faint focus:outline-none focus:border-indigo-500/50 transition"
              rows={2}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Masalan: Ko'proq rasmiy uslubda yoz. Emoji qo'shma."
            />
            <button
              onClick={() => regenMutation.mutate()}
              disabled={regenMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface2 border border-line text-sm text-ink hover:bg-line transition disabled:opacity-50"
            >
              {regenMutation.isPending ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Sparkles size={13} className="text-indigo-400" />
              )}
              {regenMutation.isPending ? 'Qayta yozilmoqda…' : 'AI bilan qayta yoz'}
            </button>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-line text-mute hover:text-ink hover:bg-surface2 transition text-sm"
        >
          <ArrowLeft size={15} />
          Orqaga
        </button>
        <button
          onClick={handleNext}
          disabled={nextLoading}
          className="flex items-center gap-2 px-6 py-2 rounded-xl bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-400 transition disabled:opacity-50"
        >
          {nextLoading ? <Loader2 size={15} className="animate-spin" /> : null}
          {nextLabel}
          {!nextLoading && <ArrowRight size={15} />}
        </button>
      </div>
    </div>
  )
}

// ─── Step 3: Rasm ─────────────────────────────────────────────────────────────

interface Step3Props {
  draft: AiPostDraft
  onDraftUpdate: (draft: AiPostDraft) => void
  onFinish: () => void
  onBack: () => void
  isFinishing: boolean
}

function Step3Image({ draft, onDraftUpdate, onFinish, onBack, isFinishing }: Step3Props) {
  const [imageJobId, setImageJobId] = useState<string | null>(draft.image_job_id)
  const [jobStatus, setJobStatus] = useState<ImageJobStatus | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageError, setImageError] = useState(false)
  const [styleHint, setStyleHint] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  // Poll image job status
  const pollJob = useCallback(async (jobId: string) => {
    try {
      const result = await aiPostsService.getImageJob(jobId)
      setJobStatus(result.status)
      if (result.status === 'done') {
        setImageUrl(result.image_url)
        setImageError(false)
        setIsGenerating(false)
        stopPoll()
      } else if (result.status === 'failed') {
        setImageError(true)
        setIsGenerating(false)
        stopPoll()
      }
    } catch {
      // keep polling
    }
  }, [stopPoll])

  const startPoll = useCallback((jobId: string) => {
    stopPoll()
    pollRef.current = setInterval(() => pollJob(jobId), IMAGE_POLL_INTERVAL)
    pollJob(jobId)
  }, [pollJob, stopPoll])

  useEffect(() => {
    return () => stopPoll()
  }, [stopPoll])

  // Auto-start if job_id already exists from draft
  useEffect(() => {
    if (draft.image_job_id && !imageJobId) {
      setImageJobId(draft.image_job_id)
      setIsGenerating(true)
      startPoll(draft.image_job_id)
    }
  }, [draft.image_job_id, imageJobId, startPoll])

  async function handleGenerateImage() {
    setIsGenerating(true)
    setImageError(false)
    setImageUrl(null)
    setJobStatus(null)
    try {
      const result = await aiPostsService.generateImage(draft.id)
      const jobId = result.image_job_id
      setImageJobId(jobId)
      onDraftUpdate({ ...draft, image_job_id: jobId })
      startPoll(jobId)
    } catch (err: unknown) {
      const e = err as { response?: { status?: number } }
      if (e?.response?.status === 429) {
        toast.error('Rasm yaratish limiti oshdi. Bir soatdan keyin urinib ko\'ring.')
      } else {
        toast.error('Rasm yaratilmadi, qayta urinib ko\'ring')
      }
      setIsGenerating(false)
    }
  }

  async function handleRegenerateImage() {
    setIsGenerating(true)
    setImageError(false)
    setImageUrl(null)
    setJobStatus(null)
    try {
      const result = await aiPostsService.regenerateImage(draft.id, {
        style_hint: styleHint.trim() || null,
      })
      const jobId = result.image_job_id
      setImageJobId(jobId)
      onDraftUpdate({ ...draft, image_job_id: jobId })
      startPoll(jobId)
    } catch (err: unknown) {
      const e = err as { response?: { status?: number } }
      if (e?.response?.status === 429) {
        toast.error('Rasm yaratish limiti oshdi. Bir soatdan keyin urinib ko\'ring.')
      } else {
        toast.error('Rasm yaratilmadi, qayta urinib ko\'ring')
      }
      setIsGenerating(false)
    }
  }

  const isPolling = isGenerating && jobStatus !== 'done' && jobStatus !== 'failed'

  return (
    <div className="space-y-5">
      {/* Image preview area — 1:1 */}
      <div
        className="relative w-full rounded-2xl border border-line bg-surface2 overflow-hidden"
        style={{ aspectRatio: '1 / 1', maxWidth: 400 }}
      >
        {imageUrl && !imageError ? (
          <img
            src={imageUrl}
            alt="Yaratilgan rasm"
            className="w-full h-full object-cover"
          />
        ) : imageError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6">
            <ImageOff size={32} className="text-faint" />
            <p className="text-sm text-mute">Rasm yaratilmadi, qayta urinib ko'ring</p>
            <button
              onClick={handleGenerateImage}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500 text-white text-sm hover:bg-indigo-400 transition"
            >
              <RefreshCw size={13} />
              Qayta urinish
            </button>
          </div>
        ) : isPolling ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div className="relative">
              <Loader2 size={32} className="animate-spin text-indigo-400" />
            </div>
            <p className="text-sm text-mute">
              {jobStatus === 'queued' ? 'Navbatda…' : 'Rasm yaratilmoqda…'}
            </p>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6">
            <Sparkles size={28} className="text-indigo-400" />
            <p className="text-sm text-mute">Rasm yaratish uchun quyidagi tugmani bosing</p>
          </div>
        )}
      </div>

      {/* Generate / Regenerate controls */}
      {!imageUrl && !isPolling && !imageError && (
        <button
          onClick={handleGenerateImage}
          disabled={isGenerating}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-400 transition disabled:opacity-50"
        >
          <Sparkles size={14} />
          Rasm yaratish
        </button>
      )}

      {imageUrl && !isPolling && (
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] uppercase tracking-[0.14em] text-faint mb-1.5">
              Uslub (ixtiyoriy)
            </label>
            <input
              className="w-full px-3 py-2 bg-bg border border-line rounded-lg text-ink text-sm placeholder:text-faint focus:outline-none focus:border-indigo-500/50 transition"
              value={styleHint}
              onChange={(e) => setStyleHint(e.target.value)}
              placeholder="Masalan: minimalist, warm tones, dark background…"
            />
          </div>
          <button
            onClick={handleRegenerateImage}
            disabled={isGenerating}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-line text-mute hover:text-ink hover:bg-surface2 transition text-sm disabled:opacity-50"
          >
            <RefreshCw size={13} />
            Qayta yaratish
          </button>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3 pt-2 flex-wrap">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-line text-mute hover:text-ink hover:bg-surface2 transition text-sm"
        >
          <ArrowLeft size={15} />
          Orqaga
        </button>

        {/* Skip image */}
        <button
          onClick={onFinish}
          disabled={isFinishing || isPolling}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-line text-mute hover:text-ink hover:bg-surface2 transition text-sm disabled:opacity-50"
        >
          Rasmsiz davom
        </button>

        {/* Send to composer */}
        <button
          onClick={onFinish}
          disabled={isFinishing || isPolling}
          className="flex items-center gap-2 px-6 py-2 rounded-xl bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-400 transition disabled:opacity-50"
        >
          {isFinishing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          {isFinishing ? 'Yuborilmoqda…' : 'Composer\'ga yuborish'}
        </button>
      </div>
    </div>
  )
}

// ─── Main wizard page ─────────────────────────────────────────────────────────

export default function AIPostCreatorPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [draft, setDraft] = useState<AiPostDraft | null>(null)
  const [wantImage, setWantImage] = useState(true)

  // Image step only exists when the user asked for an AI image.
  const stepLabels = wantImage ? ['G\'oya', 'Matn', 'Rasm'] : ['G\'oya', 'Matn']

  const generateMutation = useMutation({
    mutationFn: (params: {
      accountId: string | null
      platformTargets: string[]
      topic: string | null
      ideaFromRecommendationId: string | null
      contentType: ContentType
      wantImage: boolean
    }) =>
      aiPostsService.generate({
        account_id: params.accountId,
        platform_targets: params.platformTargets,
        topic: params.topic,
        idea_from_recommendation_id: params.ideaFromRecommendationId,
        content_type: params.contentType,
        want_image: params.wantImage,
      }),
    onSuccess: (newDraft) => {
      setDraft(newDraft)
      setStep(2)
    },
    onError: () => toast.error('Matn yaratishda xato. Qayta urinib ko\'ring.'),
  })

  const sendToComposerMutation = useMutation({
    mutationFn: () => aiPostsService.sendToComposer(draft!.id),
    onSuccess: (result) => {
      toast.success('Post Composer\'ga yuborildi!')
      // Redirect to drafts page with the new post id
      navigate(`/dashboard/drafts?post_id=${result.post_id}`)
    },
    onError: () => toast.error('Composer\'ga yuborishda xato'),
  })

  function handleFinish() {
    sendToComposerMutation.mutate()
  }

  return (
    <div className="page-in px-4 sm:px-8 py-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/dashboard/ai-posts')}
          className="p-2 rounded-lg text-faint hover:text-ink hover:bg-surface2 transition"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="font-display text-2xl text-ink tracking-tight flex items-center gap-2">
            <Sparkles size={20} className="text-indigo-400" />
            AI Post Yaratuvchi
          </h1>
          <p className="text-sm text-mute mt-0.5">
            3 qadam bilan post yarating: g'oya → matn → rasm
          </p>
        </div>
      </div>

      <StepBar current={step} steps={stepLabels} />

      <div className="bg-surface border border-line rounded-2xl p-6">
        {step === 1 && (
          <Step1Idea
            onGenerate={(params) => {
              setWantImage(params.wantImage)
              generateMutation.mutate(params)
            }}
            isLoading={generateMutation.isPending}
          />
        )}

        {step === 2 && draft && (
          <Step2Caption
            draft={draft}
            onDraftUpdate={setDraft}
            onNext={() => (wantImage ? setStep(3) : handleFinish())}
            onBack={() => setStep(1)}
            nextLabel={wantImage ? 'Rasm qadami' : 'Composer\'ga yuborish'}
            nextLoading={!wantImage && sendToComposerMutation.isPending}
          />
        )}

        {step === 3 && draft && (
          <Step3Image
            draft={draft}
            onDraftUpdate={setDraft}
            onFinish={handleFinish}
            onBack={() => setStep(2)}
            isFinishing={sendToComposerMutation.isPending}
          />
        )}
      </div>
    </div>
  )
}
