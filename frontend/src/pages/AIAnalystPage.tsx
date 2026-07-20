/**
 * V5 — AI Tahlilchi sahifasi
 * Route: /dashboard/accounts/:id/ai-analyst
 */

import { useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts'
import {
  ArrowLeft,
  RefreshCw,
  Copy,
  Loader2,
  AlertCircle,
  Sparkles,
  TrendingUp,
  BarChart2,
  Calendar,
  Lightbulb,
  ChevronRight,
} from 'lucide-react'
import { analysisService } from '@/services/analysis.service'
import type {
  AnalysisJobStatus,
  ContentPillar,
  ContentPerformance,
  ActionPriority,
  ContentIdea,
  MediaFormat,
} from '@/types/analysis.types'

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

const IG_PINK = '#E1306C'

const WEEKDAYS_UZ = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya']
const WEEKDAYS_FULL_UZ: Record<string, string> = {
  monday: 'Dushanba',
  tuesday: 'Seshanba',
  wednesday: 'Chorshanba',
  thursday: 'Payshanba',
  friday: 'Juma',
  saturday: 'Shanba',
  sunday: 'Yakshanba',
}

const FORMAT_LABELS: Record<string, string> = {
  IMAGE: 'Rasm',
  VIDEO: 'Video',
  CAROUSEL_ALBUM: 'Karusel',
  REELS: 'Reels',
}

const ACTIVE_STATUSES = new Set<AnalysisJobStatus>([
  'queued',
  'fetching',
  'computing',
  'classifying',
  'profiling',
])

const STATUS_LABELS: Record<AnalysisJobStatus, string> = {
  queued: 'Navbatda kutilmoqda…',
  fetching: 'Postlar yuklanmoqda…',
  computing: 'Statistika hisoblanmoqda…',
  classifying: 'Kontent tahlil qilinmoqda…',
  profiling: 'AI profil yaratilyapti…',
  done: 'Tahlil yakunlandi',
  failed: 'Tahlil muvaffaqiyatsiz tugadi',
}

function performanceColor(perf: ContentPerformance): string {
  if (perf === 'strong') return '#00F5A0'
  if (perf === 'weak') return '#FF5C8A'
  return '#8B85FF'
}

function priorityBadge(priority: ActionPriority) {
  const styles: Record<ActionPriority, string> = {
    high: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    medium: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    low: 'bg-surface2 text-mute border-line',
  }
  const labels: Record<ActionPriority, string> = {
    high: 'Yuqori',
    medium: "O'rta",
    low: 'Past',
  }
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase tracking-[0.12em] border font-medium ${styles[priority]}`}
    >
      {labels[priority]}
    </span>
  )
}

function formatLabel(fmt: MediaFormat): string {
  return FORMAT_LABELS[fmt] ?? fmt
}

function erPct(er: number): string {
  return `${(er * 100).toFixed(2)}%`
}

// ---------------------------------------------------------------------------
// Skeleton loading block
// ---------------------------------------------------------------------------

function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded bg-surface2 shimmer ${className}`}
      aria-hidden="true"
    />
  )
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function Section({
  title,
  icon: Icon,
  children,
  id,
}: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
  id?: string
}) {
  return (
    <section id={id} className="space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-surface2 flex items-center justify-center text-faint">
          <Icon size={15} />
        </div>
        <h2 className="font-display text-xl text-ink tracking-tight">{title}</h2>
      </div>
      {children}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Status Banner
// ---------------------------------------------------------------------------

function StatusBanner({
  accountId,
  onAnalysisDone,
}: {
  accountId: string
  onAnalysisDone: () => void
}) {
  const queryClient = useQueryClient()

  const statusQuery = useQuery({
    queryKey: ['analysis-status', accountId],
    queryFn: () => analysisService.getStatus(accountId),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (!status) return 3000
      if (status === 'done' || status === 'failed') return false
      return 3000
    },
    retry: (failureCount, error: unknown) => {
      // 404 means no job yet — don't retry aggressively
      const axiosError = error as { response?: { status?: number } }
      if (axiosError?.response?.status === 404) return false
      return failureCount < 3
    },
  })

  const prevStatus = statusQuery.data?.status
  // When status transitions to "done", refetch the data queries
  const [notifiedDone, setNotifiedDone] = useState(false)
  if (prevStatus === 'done' && !notifiedDone) {
    setNotifiedDone(true)
    onAnalysisDone()
  }

  const startMutation = useMutation({
    mutationFn: () => analysisService.startAnalysis(accountId),
    onSuccess: () => {
      toast.success("Tahlil boshlandi")
      setNotifiedDone(false)
      queryClient.invalidateQueries({ queryKey: ['analysis-status', accountId] })
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { status?: number; data?: { detail?: string } } }
      if (axiosErr?.response?.status === 409) {
        toast.info('Tahlil allaqachon davom etmoqda')
        queryClient.invalidateQueries({ queryKey: ['analysis-status', accountId] })
        return
      }
      toast.error(
        axiosErr?.response?.data?.detail || 'Tahlilni boshlashda xato yuz berdi'
      )
    },
  })

  const job = statusQuery.data
  const isActive = job && ACTIVE_STATUSES.has(job.status)
  const isFailed = job?.status === 'failed'
  const isDone = job?.status === 'done'
  const noJob = !job && !statusQuery.isLoading

  // No job or 404 — show CTA only (empty state in main content handles this)
  if (noJob || statusQuery.isError) return null

  if (statusQuery.isLoading) {
    return (
      <div className="rounded-2xl border border-line bg-surface px-5 py-4">
        <Skeleton className="h-4 w-48" />
      </div>
    )
  }

  if (isDone) {
    return (
      <div className="rounded-2xl border border-mint-500/25 bg-mint-500/5 px-5 py-3 flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-mint-500 dot-pulse shrink-0" />
        <span className="text-sm text-mint-400">Tahlil yakunlandi</span>
      </div>
    )
  }

  if (isFailed) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 flex items-center gap-4">
        <AlertCircle size={16} className="text-rose-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm text-rose-300 font-medium">Tahlil muvaffaqiyatsiz tugadi</div>
          {job?.error_message && (
            <div className="text-xs text-rose-400/80 mt-0.5 truncate">{job.error_message}</div>
          )}
        </div>
        <button
          onClick={() => startMutation.mutate()}
          disabled={startMutation.isPending}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-rose-300 bg-rose-500/15 border border-rose-500/30 hover:bg-rose-500/25 transition disabled:opacity-50"
        >
          {startMutation.isPending ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <RefreshCw size={13} />
          )}
          Qayta urinish
        </button>
      </div>
    )
  }

  if (isActive) {
    const pct = job?.progress_pct ?? 0
    const label = STATUS_LABELS[job.status] ?? 'Tahlil jarayonida…'
    return (
      <div className="rounded-2xl border border-indigo-500/25 bg-indigo-500/5 px-5 py-4 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Loader2 size={14} className="animate-spin text-indigo-400 shrink-0" />
            <span className="text-sm text-ink">{label}</span>
          </div>
          <span className="text-sm text-mute tnum shrink-0">{pct}%</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-surface2 overflow-hidden">
          <div
            className="h-full rounded-full bg-indigo-500 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    )
  }

  return null
}

// ---------------------------------------------------------------------------
// Empty state (no job / profile 404)
// ---------------------------------------------------------------------------

function EmptyAnalysisState({ accountId }: { accountId: string }) {
  const queryClient = useQueryClient()

  const startMutation = useMutation({
    mutationFn: () => analysisService.startAnalysis(accountId),
    onSuccess: () => {
      toast.success("Tahlil boshlandi")
      queryClient.invalidateQueries({ queryKey: ['analysis-status', accountId] })
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { status?: number; data?: { detail?: string } } }
      if (axiosErr?.response?.status === 409) {
        toast.info('Tahlil allaqachon davom etmoqda')
        queryClient.invalidateQueries({ queryKey: ['analysis-status', accountId] })
        return
      }
      toast.error(
        axiosErr?.response?.data?.detail || 'Tahlilni boshlashda xato yuz berdi'
      )
    },
  })

  return (
    <div className="flex flex-col items-center justify-center py-20 rounded-2xl border border-dashed border-line text-center px-4">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
        style={{ background: `${IG_PINK}1A`, color: IG_PINK, boxShadow: `inset 0 0 0 1px ${IG_PINK}33` }}
      >
        <Sparkles size={22} />
      </div>
      <h3 className="font-display text-xl text-ink mb-2">Tahlil boshlanmagan</h3>
      <p className="text-sm text-mute max-w-xs mb-6">
        Akkauntingizning AI tahlilini boshlash uchun quyidagi tugmani bosing. Jarayon bir necha daqiqa davom etadi.
      </p>
      <button
        onClick={() => startMutation.mutate()}
        disabled={startMutation.isPending}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white transition disabled:opacity-50"
        style={{ background: IG_PINK }}
      >
        {startMutation.isPending ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Sparkles size={14} />
        )}
        Tahlilni boshlash
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Heatmap: 7 × 24 (weekday × hour)
// ---------------------------------------------------------------------------

function HeatmapGrid({ hours }: { hours: { weekday: number; hour: number; avg_er: number; posts: number }[] }) {
  // Build 7×24 matrix
  const matrix: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0))
  let maxEr = 0
  hours.forEach(({ weekday, hour, avg_er }) => {
    if (weekday >= 0 && weekday <= 6 && hour >= 0 && hour <= 23) {
      matrix[weekday][hour] = avg_er
      if (avg_er > maxEr) maxEr = avg_er
    }
  })

  function cellColor(er: number): string {
    if (maxEr === 0 || er === 0) return 'rgba(255,255,255,0.03)'
    const intensity = er / maxEr
    // Interpolate from faint (#2A2A35) to IG pink (#E1306C) based on intensity
    const r = Math.round(42 + (225 - 42) * intensity)
    const g = Math.round(42 + (48 - 42) * intensity)
    const b = Math.round(53 + (108 - 53) * intensity)
    return `rgb(${r},${g},${b})`
  }

  const hourLabels = [0, 3, 6, 9, 12, 15, 18, 21]

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[420px]">
        {/* Hour labels */}
        <div className="flex mb-1 pl-8">
          {Array.from({ length: 24 }, (_, h) => (
            <div
              key={h}
              className="flex-1 text-center text-[9px] text-faint tnum"
            >
              {hourLabels.includes(h) ? `${h}:00` : ''}
            </div>
          ))}
        </div>
        {/* Grid rows */}
        {matrix.map((row, dayIdx) => (
          <div key={dayIdx} className="flex items-center gap-0.5 mb-0.5">
            <div className="w-7 text-[10px] text-faint text-right pr-1.5 shrink-0">
              {WEEKDAYS_UZ[dayIdx]}
            </div>
            {row.map((er, hourIdx) => (
              <div
                key={hourIdx}
                className="flex-1 rounded-sm"
                style={{
                  background: cellColor(er),
                  height: '18px',
                  minWidth: '12px',
                }}
                title={`${WEEKDAYS_UZ[dayIdx]} ${hourIdx}:00 — ER: ${erPct(er)}`}
              />
            ))}
          </div>
        ))}
        {/* Legend */}
        <div className="flex items-center gap-2 mt-3 pl-8">
          <span className="text-[10px] text-faint">Kam</span>
          <div className="flex gap-0.5">
            {[0, 0.2, 0.4, 0.6, 0.8, 1.0].map((v) => (
              <div
                key={v}
                className="w-4 h-2.5 rounded-sm"
                style={{ background: cellColor(v * maxEr) }}
              />
            ))}
          </div>
          <span className="text-[10px] text-faint">Ko'p</span>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DNA Card (Account Profile)
// ---------------------------------------------------------------------------

function DNACard({ profile }: { profile: import('@/types/analysis.types').AccountProfile }) {
  const pillarData = profile.content_pillars.map((p: ContentPillar) => ({
    name: p.name,
    share_pct: p.share_pct,
    performance: p.performance,
    fill: performanceColor(p.performance),
  }))

  return (
    <div className="space-y-5">
      {/* Header: niche + summary */}
      <div className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-start gap-3 mb-4">
          <span
            className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border"
            style={{
              background: `${IG_PINK}15`,
              color: IG_PINK,
              borderColor: `${IG_PINK}30`,
            }}
          >
            {profile.niche}
          </span>
          {profile.sub_niches.map((sn: string) => (
            <span
              key={sn}
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs border border-line text-mute bg-surface2"
            >
              {sn}
            </span>
          ))}
        </div>
        {/* Summary one-liner */}
        <blockquote className="border-l-2 border-indigo-500/50 pl-4 italic text-ink/90 text-base leading-relaxed">
          "{profile.summary_one_liner}"
        </blockquote>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Tone of voice */}
        <div className="rounded-2xl border border-line bg-surface p-5 space-y-3">
          <div className="text-[10px] uppercase tracking-[0.16em] text-faint">Ovoz ohanggi</div>
          <div className="flex items-center gap-2">
            <span className="text-lg text-ink font-medium">{profile.tone_of_voice.primary}</span>
            <span className="text-xs text-mute bg-surface2 px-2 py-0.5 rounded-full border border-line">
              {profile.tone_of_voice.emoji_usage === 'none'
                ? 'Emoji yo\'q'
                : profile.tone_of_voice.emoji_usage === 'light'
                ? 'Kam emoji'
                : 'Ko\'p emoji'}
            </span>
          </div>
          <p className="text-sm text-mute leading-relaxed">{profile.tone_of_voice.description}</p>
        </div>

        {/* Audience portrait */}
        <div className="rounded-2xl border border-line bg-surface p-5 space-y-3">
          <div className="text-[10px] uppercase tracking-[0.16em] text-faint">Auditoriya portreti</div>
          <p className="text-sm text-mute leading-relaxed">{profile.audience_portrait.summary}</p>
          <div className="flex flex-wrap gap-1.5">
            {profile.audience_portrait.likely_interests.map((interest: string) => (
              <span
                key={interest}
                className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
              >
                {interest}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Content pillars bar chart */}
      {pillarData.length > 0 && (
        <div className="rounded-2xl border border-line bg-surface p-5">
          <div className="text-[10px] uppercase tracking-[0.16em] text-faint mb-4">Kontent ustunlari</div>
          <ResponsiveContainer width="100%" height={Math.max(180, pillarData.length * 44)}>
            <BarChart
              data={pillarData}
              layout="vertical"
              margin={{ left: 8, right: 40, top: 0, bottom: 0 }}
            >
              <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fill: '#5A5A70', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={110} tick={{ fill: '#8A8AA0', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(value: number) => [`${value.toFixed(1)}%`, 'Ulush']}
                contentStyle={{ background: '#16161A', border: '1px solid #2A2A35', borderRadius: 10, fontSize: 12 }}
                labelStyle={{ color: '#E9E9F0' }}
              />
              <Bar dataKey="share_pct" radius={[0, 6, 6, 0]}>
                {pillarData.map((entry, idx) => (
                  <rect key={idx} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-3">
            {[
              { perf: 'strong' as ContentPerformance, label: "Kuchli" },
              { perf: 'average' as ContentPerformance, label: "O'rtacha" },
              { perf: 'weak' as ContentPerformance, label: "Zaif" },
            ].map(({ perf, label }) => (
              <div key={perf} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: performanceColor(perf) }} />
                <span className="text-[11px] text-mute">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Strengths & Weaknesses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-mint-500/20 bg-mint-500/5 p-5 space-y-3">
          <div className="text-[10px] uppercase tracking-[0.16em] text-mint-500/70">Kuchli tomonlar</div>
          <ul className="space-y-2">
            {profile.strengths.map((s: string, i: number) => (
              <li key={i} className="flex items-start gap-2 text-sm text-ink/90">
                <span className="mt-0.5 text-mint-400 shrink-0">✓</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-5 space-y-3">
          <div className="text-[10px] uppercase tracking-[0.16em] text-rose-400/70">Zaif tomonlar</div>
          <ul className="space-y-2">
            {profile.weaknesses.map((w: string, i: number) => (
              <li key={i} className="flex items-start gap-2 text-sm text-ink/90">
                <span className="mt-0.5 text-rose-400 shrink-0">✗</span>
                {w}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Statistics dashboard
// ---------------------------------------------------------------------------

function StatsDashboard({ stats }: { stats: import('@/types/analysis.types').StatsSummary }) {
  const formatData = stats.format_performance.map((f) => ({
    name: FORMAT_LABELS[f.media_type] ?? f.media_type,
    avg_er_pct: parseFloat((f.avg_er * 100).toFixed(3)),
    post_count: f.post_count,
  }))

  const trendData = stats.follower_trend.map((d) => ({
    date: d.date,
    value: d.value,
  }))

  return (
    <div className="space-y-5">
      {/* Summary pills */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Jami postlar", value: String(stats.total_posts) },
          { label: "O'rtacha ER", value: erPct(stats.avg_engagement_rate) },
          { label: "Haftalik chastota", value: `${stats.posting_frequency_per_week.toFixed(1)} ta` },
          { label: "Tahlil davri", value: `${stats.period_days} kun` },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-line bg-surface p-3 text-center">
            <div className="text-[10px] uppercase tracking-[0.14em] text-faint mb-1">{label}</div>
            <div className="font-display text-xl text-ink tnum">{value}</div>
          </div>
        ))}
      </div>

      {/* Heatmap */}
      <div className="rounded-2xl border border-line bg-surface p-5">
        <div className="text-[10px] uppercase tracking-[0.16em] text-faint mb-4">
          Eng yaxshi vaqtlar (kun × soat, ER intensivligi)
        </div>
        <HeatmapGrid hours={stats.best_posting_hours} />
      </div>

      {/* Format performance */}
      {formatData.length > 0 && (
        <div className="rounded-2xl border border-line bg-surface p-5">
          <div className="text-[10px] uppercase tracking-[0.16em] text-faint mb-4">Format samaradorligi (%)</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={formatData} margin={{ left: 0, right: 10, top: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2A35" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#8A8AA0', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => `${v}%`} tick={{ fill: '#5A5A70', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(value: number) => [`${value}%`, 'O\'rtacha ER']}
                contentStyle={{ background: '#16161A', border: '1px solid #2A2A35', borderRadius: 10, fontSize: 12 }}
                labelStyle={{ color: '#E9E9F0' }}
              />
              <Bar dataKey="avg_er_pct" fill={IG_PINK} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Follower trend */}
      {trendData.length > 0 && (
        <div className="rounded-2xl border border-line bg-surface p-5">
          <div className="text-[10px] uppercase tracking-[0.16em] text-faint mb-4">Obunachilar o'zgarishi</div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={trendData} margin={{ left: 0, right: 10, top: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2A35" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: '#5A5A70', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fill: '#5A5A70', fontSize: 11 }} axisLine={false} tickLine={false} width={60} />
              <Tooltip
                contentStyle={{ background: '#16161A', border: '1px solid #2A2A35', borderRadius: 10, fontSize: 12 }}
                labelStyle={{ color: '#E9E9F0' }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#6C63FF"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#6C63FF' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top 5 posts */}
      {stats.top_posts.length > 0 && (
        <div className="rounded-2xl border border-line bg-surface p-5">
          <div className="text-[10px] uppercase tracking-[0.16em] text-faint mb-4">Eng yaxshi 5 ta post</div>
          <div className="space-y-2">
            {stats.top_posts.slice(0, 5).map((post, idx) => (
              <div
                key={post.media_item_id}
                className="flex items-center gap-3 rounded-xl border border-line bg-bg p-3"
              >
                <div className="w-6 text-center text-xs font-medium text-faint tnum shrink-0">
                  #{idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-mute truncate">
                    {post.posted_at ? new Date(post.posted_at).toLocaleDateString('uz-UZ') : '—'}
                  </div>
                </div>
                <div className="text-sm font-medium text-ink tnum shrink-0" style={{ color: IG_PINK }}>
                  {erPct(post.engagement_rate)}
                </div>
                <div className="text-[10px] text-mute shrink-0">
                  {post.er_basis === 'reach' ? 'reach' : 'followers'}
                </div>
                {post.permalink && (
                  <a
                    href={post.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 p-1.5 rounded-md text-faint hover:text-ink hover:bg-surface2 transition"
                    title="Postni ochish"
                    aria-label="Instagram'da ko'rish"
                  >
                    <ChevronRight size={13} />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Recommendations panel
// ---------------------------------------------------------------------------

function RecommendationsPanel({ recs }: { recs: import('@/types/analysis.types').Recommendations }) {
  return (
    <div className="space-y-5">
      {/* Posting schedule table */}
      {recs.posting_schedule.length > 0 && (
        <div className="rounded-2xl border border-line bg-surface p-5">
          <div className="text-[10px] uppercase tracking-[0.16em] text-faint mb-4">Post joylash jadvali</div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[360px]">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-left text-[10px] uppercase tracking-[0.14em] text-faint pb-2 pr-4">Kun</th>
                  <th className="text-left text-[10px] uppercase tracking-[0.14em] text-faint pb-2 pr-4">Soat</th>
                  <th className="text-left text-[10px] uppercase tracking-[0.14em] text-faint pb-2">Sabab</th>
                </tr>
              </thead>
              <tbody>
                {recs.posting_schedule.map((item, idx) => (
                  <tr key={idx} className="border-b border-line/50 last:border-0">
                    <td className="py-2.5 pr-4 text-sm text-ink">
                      {WEEKDAYS_FULL_UZ[item.day] ?? item.day}
                    </td>
                    <td className="py-2.5 pr-4 text-sm text-mute tnum">
                      {String(item.hour).padStart(2, '0')}:00
                    </td>
                    <td className="py-2.5 text-sm text-mute">{item.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Format & Hashtag advice */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-line bg-surface p-5 space-y-2">
          <div className="text-[10px] uppercase tracking-[0.16em] text-faint">Format maslahati</div>
          <p className="text-sm text-ink/90 leading-relaxed">{recs.format_advice}</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-5 space-y-2">
          <div className="text-[10px] uppercase tracking-[0.16em] text-faint">Hashtag strategiyasi</div>
          <p className="text-sm text-ink/90 leading-relaxed">{recs.hashtag_advice}</p>
        </div>
      </div>

      {/* Growth actions */}
      {recs.growth_actions.length > 0 && (
        <div className="rounded-2xl border border-line bg-surface p-5">
          <div className="text-[10px] uppercase tracking-[0.16em] text-faint mb-4">O'sish uchun harakatlar</div>
          <div className="space-y-3">
            {recs.growth_actions.map((action, idx) => (
              <div key={idx} className="flex items-start gap-3 rounded-xl border border-line bg-bg p-4">
                <div className="shrink-0 mt-0.5">{priorityBadge(action.priority)}</div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="text-sm text-ink">{action.action}</div>
                  <div className="text-xs text-mute">{action.expected_impact}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Content ideas skeleton
// ---------------------------------------------------------------------------

function ContentIdeaSkeletons({ count }: { count: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-2xl border border-line bg-surface p-5 space-y-3">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Content idea card
// ---------------------------------------------------------------------------

function IdeaCard({ idea }: { idea: ContentIdea }) {
  function handleCopy() {
    const text = `${idea.title}\n\n${idea.caption_draft}\n\n${idea.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')}`
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Nusxalandi')
    }).catch(() => {
      toast.error('Nusxalab bo\'lmadi')
    })
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 space-y-3 group">
      <div className="flex items-start justify-between gap-3">
        <h4 className="text-sm font-medium text-ink leading-snug">{idea.title}</h4>
        <button
          onClick={handleCopy}
          className="shrink-0 p-1.5 rounded-lg text-faint hover:text-ink hover:bg-surface2 transition opacity-0 group-hover:opacity-100 focus:opacity-100"
          title="Nusxalash"
          aria-label="Nusxalash"
        >
          <Copy size={13} />
        </button>
      </div>
      <p className="text-sm text-mute leading-relaxed whitespace-pre-line">{idea.caption_draft}</p>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="text-[10px] uppercase tracking-[0.12em] px-2 py-0.5 rounded-full border font-medium"
          style={{
            background: `${IG_PINK}15`,
            color: IG_PINK,
            borderColor: `${IG_PINK}30`,
          }}
        >
          {formatLabel(idea.format)}
        </span>
        {idea.hashtags.slice(0, 5).map((h) => (
          <span
            key={h}
            className="text-[11px] text-indigo-400 bg-indigo-500/10 border border-indigo-500/15 px-2 py-0.5 rounded-full"
          >
            {h.startsWith('#') ? h : `#${h}`}
          </span>
        ))}
        {idea.hashtags.length > 5 && (
          <span className="text-[11px] text-faint">+{idea.hashtags.length - 5}</span>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Content ideas generator
// ---------------------------------------------------------------------------

function ContentIdeasGenerator({ accountId }: { accountId: string }) {
  const [count, setCount] = useState(3)
  const [topicHint, setTopicHint] = useState('')
  const [ideas, setIdeas] = useState<ContentIdea[]>([])
  const [generating, setGenerating] = useState(false)

  async function handleGenerate() {
    setGenerating(true)
    setIdeas([])
    try {
      const result = await analysisService.generateContentIdeas(accountId, {
        count,
        topic_hint: topicHint.trim() || undefined,
      })
      setIdeas(result.ideas)
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { detail?: string } } }
      if (axiosErr?.response?.status === 429) {
        toast.error("Soatlik limit tugadi, keyinroq urinib ko'ring")
      } else {
        toast.error(axiosErr?.response?.data?.detail || "G'oya yaratishda xato yuz berdi")
      }
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Count selector */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-[0.14em] text-faint">
              G'oyalar soni
            </label>
            <select
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              disabled={generating}
              className="px-3 py-2 bg-bg border border-line rounded-lg text-sm text-ink focus:outline-none focus:border-indigo-500/50 transition disabled:opacity-50"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} ta
                </option>
              ))}
            </select>
          </div>
          {/* Topic hint */}
          <div className="flex-1 min-w-[180px] space-y-1.5">
            <label className="text-[10px] uppercase tracking-[0.14em] text-faint">
              Mavzu (ixtiyoriy)
            </label>
            <input
              value={topicHint}
              onChange={(e) => setTopicHint(e.target.value)}
              disabled={generating}
              placeholder="Masalan: yangi mahsulot taqdimoti…"
              onKeyDown={(e) => { if (e.key === 'Enter') handleGenerate() }}
              className="w-full px-3 py-2 bg-bg border border-line rounded-lg text-sm text-ink placeholder:text-faint focus:outline-none focus:border-indigo-500/50 transition disabled:opacity-50"
            />
          </div>
          {/* Button */}
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium text-white transition disabled:opacity-50 shrink-0"
            style={{ background: IG_PINK }}
          >
            {generating ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} />
            )}
            {generating ? 'Yaratilmoqda…' : "G'oya yarat"}
          </button>
        </div>
      </div>

      {/* Skeleton while loading */}
      {generating && <ContentIdeaSkeletons count={count} />}

      {/* Result cards */}
      {!generating && ideas.length > 0 && (
        <div className="space-y-3">
          {ideas.map((idea, idx) => (
            <IdeaCard key={idx} idea={idea} />
          ))}
        </div>
      )}

      {/* Empty initial state */}
      {!generating && ideas.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 rounded-2xl border border-dashed border-line text-center px-4">
          <Lightbulb size={24} className="text-faint mb-3" />
          <p className="text-sm text-mute">
            G'oya yaratish uchun yuqoridagi tugmani bosing
          </p>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function AIAnalystPage() {
  const { id: accountId } = useParams<{ id: string }>()
  const queryClient = useQueryClient()

  const refetchAllData = useCallback(() => {
    if (!accountId) return
    queryClient.invalidateQueries({ queryKey: ['analysis-profile', accountId] })
    queryClient.invalidateQueries({ queryKey: ['analysis-stats', accountId] })
    queryClient.invalidateQueries({ queryKey: ['analysis-recommendations', accountId] })
  }, [queryClient, accountId])

  const profileQuery = useQuery({
    queryKey: ['analysis-profile', accountId],
    queryFn: () => analysisService.getProfile(accountId!),
    enabled: !!accountId,
    retry: (failureCount, error: unknown) => {
      const axiosError = error as { response?: { status?: number } }
      if (axiosError?.response?.status === 404) return false
      return failureCount < 2
    },
  })

  const statsQuery = useQuery({
    queryKey: ['analysis-stats', accountId],
    queryFn: () => analysisService.getStats(accountId!),
    enabled: !!accountId,
    retry: (failureCount, error: unknown) => {
      const axiosError = error as { response?: { status?: number } }
      if (axiosError?.response?.status === 404) return false
      return failureCount < 2
    },
  })

  const recsQuery = useQuery({
    queryKey: ['analysis-recommendations', accountId],
    queryFn: () => analysisService.getRecommendations(accountId!),
    enabled: !!accountId,
    retry: (failureCount, error: unknown) => {
      const axiosError = error as { response?: { status?: number } }
      if (axiosError?.response?.status === 404) return false
      return failureCount < 2
    },
  })

  if (!accountId) {
    return (
      <div className="px-8 py-6 text-mute text-sm">Akkaunt topilmadi</div>
    )
  }

  const profileNotFound =
    profileQuery.isError &&
    (profileQuery.error as { response?: { status?: number } })?.response?.status === 404

  // Determine if we should show the empty state:
  // profile is 404 AND status query has no job (handled inside StatusBanner)
  const showEmptyState = profileNotFound && !profileQuery.isFetching

  return (
    <div className="page-in px-4 sm:px-8 py-6 space-y-8 max-w-[1100px]">
      {/* Back link + header */}
      <div className="flex items-center gap-3">
        <Link
          to="/dashboard/accounts"
          className="p-2 rounded-lg text-faint hover:text-ink hover:bg-surface2 transition"
          aria-label="Akkauntlarga qaytish"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="font-display text-2xl text-ink tracking-tight flex items-center gap-2">
            AI Tahlil
            <span
              className="text-[11px] font-sans px-2 py-0.5 rounded-full border"
              style={{
                background: `${IG_PINK}15`,
                color: IG_PINK,
                borderColor: `${IG_PINK}30`,
              }}
            >
              Instagram
            </span>
          </h1>
          <p className="text-sm text-mute mt-0.5">Akkauntingiz uchun shaxsiylashtirilgan AI tahlili</p>
        </div>
      </div>

      {/* Status banner with polling */}
      <StatusBanner accountId={accountId} onAnalysisDone={refetchAllData} />

      {/* Empty state */}
      {showEmptyState && <EmptyAnalysisState accountId={accountId} />}

      {/* DNA Card */}
      {!showEmptyState && (
        <Section title="Akkaunt DNK kartasi" icon={Sparkles} id="dna">
          {profileQuery.isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-24 w-full rounded-2xl" />
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-36 rounded-2xl" />
                <Skeleton className="h-36 rounded-2xl" />
              </div>
            </div>
          ) : profileQuery.data ? (
            <DNACard profile={profileQuery.data} />
          ) : profileNotFound ? (
            <div className="rounded-2xl border border-line bg-surface p-6 text-center text-sm text-mute">
              Profil hali tayyor emas. Tahlil yakunlangandan so'ng ko'rinadi.
            </div>
          ) : null}
        </Section>
      )}

      {/* Stats dashboard */}
      {!showEmptyState && (
        <Section title="Statistika dashboard" icon={BarChart2} id="stats">
          {statsQuery.isLoading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
              </div>
              <Skeleton className="h-48 rounded-2xl" />
            </div>
          ) : statsQuery.data ? (
            <StatsDashboard stats={statsQuery.data} />
          ) : (
            <div className="rounded-2xl border border-line bg-surface p-6 text-center text-sm text-mute">
              Statistika hali mavjud emas. Tahlil yakunlangandan so'ng ko'rinadi.
            </div>
          )}
        </Section>
      )}

      {/* Recommendations */}
      {!showEmptyState && (
        <Section title="Haftalik tavsiyalar" icon={TrendingUp} id="recommendations">
          {recsQuery.isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-48 rounded-2xl" />
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-28 rounded-2xl" />
                <Skeleton className="h-28 rounded-2xl" />
              </div>
            </div>
          ) : recsQuery.data ? (
            <RecommendationsPanel recs={recsQuery.data} />
          ) : (
            <div className="rounded-2xl border border-line bg-surface p-6 text-center text-sm text-mute">
              Tavsiyalar hali tayyor emas. Tahlil yakunlangandan so'ng ko'rinadi.
            </div>
          )}
        </Section>
      )}

      {/* Content ideas */}
      <Section title="Kontent g'oyalari" icon={Lightbulb} id="content-ideas">
        <ContentIdeasGenerator accountId={accountId} />
      </Section>

      {/* Posting schedule summary */}
      {!showEmptyState && (
        <Section title="Posting jadvali xulosa" icon={Calendar} id="schedule">
          {recsQuery.data?.posting_schedule && recsQuery.data.posting_schedule.length > 0 ? (
            <div className="rounded-2xl border border-line bg-surface overflow-hidden">
              <div className="grid grid-cols-7 border-b border-line">
                {WEEKDAYS_UZ.map((d) => (
                  <div key={d} className="py-2 text-center text-[10px] uppercase tracking-[0.14em] text-faint">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 p-2 gap-1">
                {WEEKDAYS_FULL_UZ && Object.keys(WEEKDAYS_FULL_UZ).map((dayKey, _idx) => {
                  const slots = recsQuery.data!.posting_schedule.filter(
                    (s) => s.day === dayKey
                  )
                  return (
                    <div key={dayKey} className="min-h-[56px] rounded-lg border border-line/50 bg-bg p-1.5 space-y-1">
                      {slots.map((slot, si) => (
                        <div
                          key={si}
                          className="text-[10px] text-center rounded px-1 py-0.5 font-medium tnum"
                          style={{ background: `${IG_PINK}20`, color: IG_PINK }}
                        >
                          {String(slot.hour).padStart(2, '0')}:00
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}
        </Section>
      )}
    </div>
  )
}
