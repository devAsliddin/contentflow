import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import {
  Sparkles,
  Loader2,
  ArrowRight,
  AlertTriangle,
  BarChart2,
  Eye,
  Heart,
  Radio,
  CalendarClock,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import StatsCard from '@/components/dashboard/StatsCard'
import PlatformChip, { type PlatformKind } from '@/components/ui/PlatformChip'
import StatusPill from '@/components/ui/StatusPill'
import { analyticsService } from '@/services/analytics.service'
import { postsService } from '@/services/posts.service'
import { aiService } from '@/services/ai.service'
import { formatDateTime, formatRelative } from '@/utils/date.utils'
import type { AnalyticsOverview, PostPerformance, PlatformComparison } from '@/types/api.types'
import type { PostIdea } from '@/types/api.types'
import type { Post } from '@/types/post.types'
import { getPlatformFromEntry } from '@/utils/platform.utils'

// ── Platform brand colors ─────────────────────────────────────────────────────
const PLATFORM_COLORS: Record<string, string> = {
  telegram:  '#229ED9',
  instagram: '#E1306C',
  tiktok:    '#69C9D0',
}

// ── Skeleton helpers ──────────────────────────────────────────────────────────
function SkeletonBlock({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-surface2 rounded animate-pulse ${className}`} />
  )
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl bg-surface border border-line p-5 overflow-hidden shadow-card">
      <SkeletonBlock className="h-3 w-24 mb-4" />
      <SkeletonBlock className="h-8 w-16 mb-2" />
      <SkeletonBlock className="h-9 w-full mt-3" />
    </div>
  )
}

// ── Stat sparkline data builder ───────────────────────────────────────────────
function buildSparkValues(comparison: PlatformComparison[] | undefined, key: keyof PlatformComparison): number[] {
  if (!comparison || comparison.length === 0) {
    return [2, 3, 2, 4, 3, 5, 4]
  }
  return comparison.slice(-7).map((d) => Number(d[key]) || 0)
}

// ── Custom tooltip for BarChart ───────────────────────────────────────────────
function PlatformTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ color: string; name: string; value: number }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl bg-surface2 border border-line px-3 py-2 shadow-lg text-xs space-y-1">
      <div className="text-faint mb-1.5 uppercase tracking-wider text-[10px]">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-mute capitalize">{p.name}</span>
          <span className="text-ink tnum ml-auto pl-4">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

// ── Platform Comparison Chart ─────────────────────────────────────────────────
function PlatformComparisonChart() {
  const { data, isLoading, isError } = useQuery<PlatformComparison[]>({
    queryKey: ['analytics', 'platform-comparison'],
    queryFn: () => analyticsService.getPlatformComparison(7),
    retry: false,
  })

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-surface border border-line p-5 shadow-card">
        <SkeletonBlock className="h-3 w-36 mb-4" />
        <SkeletonBlock className="h-5 w-48 mb-6" />
        <SkeletonBlock className="h-44 w-full" />
      </div>
    )
  }

  if (isError || !data || data.length === 0) {
    return (
      <div className="rounded-2xl bg-surface border border-line p-5 shadow-card flex flex-col items-center justify-center gap-3 min-h-[220px]">
        <div className="w-10 h-10 rounded-xl bg-line flex items-center justify-center">
          <BarChart2 size={18} className="text-faint" />
        </div>
        <div className="text-sm text-mute text-center">
          Platform comparison data is not yet available.
          <br />
          <span className="text-[12px] text-faint">Endpoint will populate once analytics are collected.</span>
        </div>
      </div>
    )
  }

  const chartData = data.map((d) => ({
    date: d.date.slice(5), // "MM-DD"
    Telegram:  d.telegram,
    Instagram: d.instagram,
    TikTok:    d.tiktok,
  }))

  return (
    <div className="rounded-2xl bg-surface border border-line p-5 shadow-card">
      <div className="mb-4">
        <div className="text-[11px] uppercase tracking-[0.18em] text-faint mb-1">Last 7 days</div>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl text-ink tracking-tight">Platform comparison</h2>
          <div className="flex items-center gap-3">
            {(['Telegram', 'Instagram', 'TikTok'] as const).map((name) => {
              const colorKey = name.toLowerCase() as keyof typeof PLATFORM_COLORS
              return (
                <div key={name} className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: PLATFORM_COLORS[colorKey] }}
                  />
                  <span className="text-[11px] text-faint">{name}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={chartData} barCategoryGap="32%" barGap={3}>
          <CartesianGrid vertical={false} stroke="#2A2A35" strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tick={{ fill: '#5A5A70', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#5A5A70', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={24}
            allowDecimals={false}
          />
          <Tooltip content={<PlatformTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Bar dataKey="Telegram"  fill={PLATFORM_COLORS.telegram}  radius={[3, 3, 0, 0]} />
          <Bar dataKey="Instagram" fill={PLATFORM_COLORS.instagram} radius={[3, 3, 0, 0]} />
          <Bar dataKey="TikTok"    fill={PLATFORM_COLORS.tiktok}    radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Upcoming Posts Panel ──────────────────────────────────────────────────────
function UpcomingPostsPanel() {
  const { data: posts = [], isLoading } = useQuery<Post[]>({
    queryKey: ['posts', 'scheduled', 'upcoming', 5],
    queryFn: () => postsService.list({ status: 'scheduled', limit: 5 }),
    retry: 1,
  })

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-surface border border-line overflow-hidden shadow-card">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-line last:border-0">
            <SkeletonBlock className="w-10 h-10 rounded-lg shrink-0" />
            <div className="flex-1 space-y-2">
              <SkeletonBlock className="h-3 w-3/4" />
              <SkeletonBlock className="h-2.5 w-1/2" />
            </div>
            <SkeletonBlock className="h-6 w-20 rounded-full" />
          </div>
        ))}
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <div className="rounded-2xl bg-surface border border-line p-10 text-center shadow-card">
        <CalendarClock size={24} className="text-faint mx-auto mb-3" />
        <p className="text-sm text-mute">No upcoming posts scheduled</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-surface border border-line overflow-hidden shadow-card">
      {posts.map((post, i) => {
        const platforms = (post.platforms || []).map(getPlatformFromEntry) as PlatformKind[]
        const timeLeft = post.scheduled_at ? formatRelative(post.scheduled_at) : null

        return (
          <div
            key={post.id}
            className={`group flex items-center gap-4 px-5 py-3.5 hover:bg-surface2/60 transition ${
              i < posts.length - 1 ? 'border-b border-line' : ''
            }`}
          >
            {/* Platform dots */}
            <div className="flex items-center gap-1 shrink-0">
              {platforms.slice(0, 2).map((pl) => (
                <PlatformChip key={pl} kind={pl} size={20} />
              ))}
            </div>

            {/* Caption */}
            <div className="flex-1 min-w-0">
              <div className="text-[13px] text-ink truncate">
                {post.caption?.slice(0, 72) || 'No caption'}
              </div>
              <div className="text-[11px] text-faint mt-0.5 tnum">
                {post.scheduled_at ? formatDateTime(post.scheduled_at) : '—'}
              </div>
            </div>

            {/* Time remaining badge */}
            {timeLeft && (
              <span className="shrink-0 text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2.5 py-0.5 tnum">
                {timeLeft}
              </span>
            )}

            <StatusPill kind={post.status}>{post.status}</StatusPill>
          </div>
        )
      })}
    </div>
  )
}

// ── Post Performance Table ────────────────────────────────────────────────────
function PostPerformanceTable() {
  const { data, isLoading, isError } = useQuery<PostPerformance[]>({
    queryKey: ['analytics', 'post-performance'],
    queryFn: () => analyticsService.getPostPerformance(7),
    retry: false,
  })

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-surface border border-line overflow-hidden shadow-card">
        <div className="px-5 py-3 border-b border-line grid grid-cols-[28px_1fr_120px_72px_72px_72px] gap-4">
          {['', 'Caption', 'Published', 'Views', 'Likes', 'Reach'].map((h) => (
            <div key={h} className="text-[10px] uppercase tracking-[0.14em] text-faint">{h}</div>
          ))}
        </div>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="px-5 py-3 border-b border-line last:border-0 grid grid-cols-[28px_1fr_120px_72px_72px_72px] gap-4 items-center">
            <SkeletonBlock className="w-6 h-6 rounded" />
            <SkeletonBlock className="h-3 w-3/4" />
            <SkeletonBlock className="h-3 w-20" />
            <SkeletonBlock className="h-3 w-10" />
            <SkeletonBlock className="h-3 w-10" />
            <SkeletonBlock className="h-3 w-10" />
          </div>
        ))}
      </div>
    )
  }

  if (isError || !data || data.length === 0) {
    return (
      <div className="rounded-2xl bg-surface border border-line p-10 text-center shadow-card">
        <BarChart2 size={22} className="text-faint mx-auto mb-3" />
        <p className="text-sm text-mute">Post performance data is not yet available.</p>
        <p className="text-[12px] text-faint mt-1">Once posts are published, engagement metrics will appear here.</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-surface border border-line overflow-hidden shadow-card">
      {/* Table header */}
      <div className="px-5 py-3 border-b border-line grid grid-cols-[28px_1fr_130px_72px_72px_72px] gap-4 items-center">
        <div />
        <div className="text-[10px] uppercase tracking-[0.14em] text-faint">Caption</div>
        <div className="text-[10px] uppercase tracking-[0.14em] text-faint">Published</div>
        <div className="text-[10px] uppercase tracking-[0.14em] text-faint flex items-center gap-1">
          <Eye size={10} /> Views
        </div>
        <div className="text-[10px] uppercase tracking-[0.14em] text-faint flex items-center gap-1">
          <Heart size={10} /> Likes
        </div>
        <div className="text-[10px] uppercase tracking-[0.14em] text-faint flex items-center gap-1">
          <Radio size={10} /> Reach
        </div>
      </div>

      {data.slice(0, 10).map((row, i) => (
        <div
          key={row.id}
          className={`px-5 py-3.5 grid grid-cols-[28px_1fr_130px_72px_72px_72px] gap-4 items-center hover:bg-surface2/50 transition ${
            i < data.length - 1 ? 'border-b border-line' : ''
          }`}
        >
          <PlatformChip kind={row.platform as PlatformKind} size={22} />
          <div className="text-[13px] text-ink truncate min-w-0">
            {row.caption?.slice(0, 60) || 'No caption'}
          </div>
          <div className="text-[12px] text-mute tnum">{formatDateTime(row.published_at)}</div>
          <div className="text-[13px] text-ink tnum">{row.views.toLocaleString()}</div>
          <div className="text-[13px] text-ink tnum">{row.likes.toLocaleString()}</div>
          <div className="text-[13px] text-ink tnum">{row.reach.toLocaleString()}</div>
        </div>
      ))}
    </div>
  )
}

// ── AI Suggestions Panel ──────────────────────────────────────────────────────
function AiSuggestionsPanel() {
  const navigate = useNavigate()
  const [ideas, setIdeas] = useState<PostIdea[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  async function loadIdeas() {
    setLoading(true)
    setError(false)
    try {
      const result = await aiService.suggestIdeas()
      setIdeas(result.ideas.slice(0, 5))
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-surface rounded-xl animate-pulse border border-line" />
        ))}
      </div>
    )
  }

  if (ideas.length === 0) {
    return (
      <div className="rounded-2xl bg-surface border border-line p-5 shadow-card">
        <div className="text-center">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mx-auto mb-3">
            <Sparkles size={18} className="text-indigo-400" />
          </div>
          <p className="text-sm text-ink mb-1">AI Content Ideas</p>
          <p className="text-[12px] text-mute mb-4 leading-relaxed">
            Get AI-powered content ideas tailored for your audience.
          </p>
          {error && (
            <div className="flex items-center gap-2 justify-center text-[12px] text-rose-400 mb-3">
              <AlertTriangle size={12} />
              Failed to load suggestions. Try again.
            </div>
          )}
          <button
            onClick={loadIdeas}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-sm font-medium hover:bg-indigo-500/15 transition"
          >
            <Sparkles size={13} />
            Generate ideas
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <Sparkles size={11} className="text-indigo-400" />
          <span className="text-[10px] uppercase tracking-[0.18em] text-faint">AI Studio</span>
        </div>
        <button
          onClick={loadIdeas}
          disabled={loading}
          className="text-[11px] text-mute hover:text-ink uppercase tracking-wider disabled:opacity-50"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : 'Refresh'}
        </button>
      </div>

      {ideas.map((idea, idx) => (
        <div
          key={idx}
          className="lift relative rounded-xl border border-line bg-surface p-4 overflow-hidden"
        >
          <div
            className="absolute inset-x-0 -top-px h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(108,99,255,0.6), transparent)' }}
          />
          <div className="text-[10px] uppercase tracking-[0.16em] text-indigo-400 font-medium mb-2">
            {idea.platform}
          </div>
          <div className="font-display text-[15px] text-ink leading-snug mb-2">{idea.title}</div>
          <div className="text-[12px] text-mute leading-relaxed mb-3 line-clamp-2">{idea.description}</div>
          <div className="flex items-center justify-between">
            <PlatformChip kind={idea.platform as PlatformKind} size={18} />
            <button
              onClick={() => navigate('/new-post', { state: { idea } })}
              className="text-[12px] font-medium text-indigo-400 hover:text-indigo-500 inline-flex items-center gap-1 group"
            >
              Use this idea
              <ArrowRight size={12} className="group-hover:translate-x-0.5 transition" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main Dashboard Page ───────────────────────────────────────────────────────
export default function DashboardPage() {
  const { data: overview, isLoading: overviewLoading } = useQuery<AnalyticsOverview>({
    queryKey: ['analytics', 'overview'],
    queryFn: () => analyticsService.getOverview(),
    retry: 1,
  })

  const { data: comparison } = useQuery<PlatformComparison[]>({
    queryKey: ['analytics', 'platform-comparison'],
    queryFn: () => analyticsService.getPlatformComparison(7),
    retry: false,
    staleTime: 60_000,
  })

  // Build 7-day sparkline data for each stat from comparison data
  const tgSpark   = buildSparkValues(comparison, 'telegram')
  const igSpark   = buildSparkValues(comparison, 'instagram')
  const ttSpark   = buildSparkValues(comparison, 'tiktok')
  const totalSpark = tgSpark.map((v, i) => v + igSpark[i] + ttSpark[i])

  return (
    <div className="page-in px-8 py-6 space-y-6">

      {/* ── Stats row ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {overviewLoading ? (
          [1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <StatsCard
              label="Posts this week"
              value={overview?.total_posts ?? '—'}
              delta={overview ? '+' + overview.total_posts : undefined}
              deltaKind="up"
              sparkValues={totalSpark}
              sparkColor="#6C63FF"
              sparkFill="rgba(108,99,255,0.18)"
            />
            <StatsCard
              label="Published"
              value={overview?.published ?? '—'}
              deltaKind="up"
              sparkValues={igSpark}
              sparkColor="#00F5A0"
              sparkFill="rgba(0,245,160,0.18)"
            />
            <StatsCard
              label="Scheduled"
              value={overview?.scheduled ?? '—'}
              deltaKind="up"
              sparkValues={tgSpark}
              sparkColor="#FFB347"
              sparkFill="rgba(255,179,71,0.18)"
            />
            <StatsCard
              label="Failed this week"
              value={overview?.failed ?? '—'}
              deltaKind={overview?.failed ? 'down' : 'up'}
              sparkValues={ttSpark}
              sparkColor="#FF5C8A"
              sparkFill="rgba(255,92,138,0.18)"
            />
          </>
        )}
      </div>

      {/* ── Platform Comparison ───────────────────────────────────────── */}
      <PlatformComparisonChart />

      {/* ── Upcoming posts + AI sidebar ───────────────────────────────── */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8 space-y-6">
          {/* Upcoming Posts */}
          <div>
            <div className="flex items-end justify-between mb-4">
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-faint mb-1">Next up</div>
                <h2 className="font-display text-xl text-ink tracking-tight">Upcoming posts</h2>
              </div>
              <button
                onClick={() => {}}
                className="text-[11px] text-mute hover:text-ink uppercase tracking-wider inline-flex items-center gap-1"
              >
                View calendar <ArrowRight size={11} />
              </button>
            </div>
            <UpcomingPostsPanel />
          </div>

          {/* Post Performance Table */}
          <div>
            <div className="flex items-end justify-between mb-4">
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-faint mb-1">Last 7 days</div>
                <h2 className="font-display text-xl text-ink tracking-tight">Post performance</h2>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-mint-500">
                <TrendingUp size={12} />
                <span className="text-mute">Live data</span>
              </div>
            </div>
            <PostPerformanceTable />
          </div>
        </div>

        {/* AI Sidebar */}
        <aside className="col-span-12 lg:col-span-4">
          <div className="flex items-end justify-between mb-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-faint mb-1">AI Studio</div>
              <h2 className="font-display text-xl text-ink tracking-tight">Suggestions</h2>
            </div>
          </div>
          <AiSuggestionsPanel />

          {/* Reach by platform (static summary) */}
          <div className="mt-6 rounded-2xl bg-surface border border-line p-5 relative overflow-hidden shadow-card">
            <div
              className="absolute -right-12 -bottom-12 w-40 h-40 rounded-full blur-3xl"
              style={{ background: 'rgba(108,99,255,0.18)' }}
            />
            <div className="mb-4 relative">
              <div className="text-[11px] uppercase tracking-[0.18em] text-faint mb-1">This week</div>
              <h2 className="font-display text-xl text-ink tracking-tight">Reach by platform</h2>
            </div>
            <div className="space-y-3 relative">
              {(['instagram', 'tiktok', 'telegram'] as PlatformKind[]).map((kind) => {
                const sums: Partial<Record<PlatformKind, number>> = {
                  instagram: comparison?.reduce((a, d) => a + d.instagram, 0) ?? 0,
                  tiktok:    comparison?.reduce((a, d) => a + d.tiktok, 0) ?? 0,
                  telegram:  comparison?.reduce((a, d) => a + d.telegram, 0) ?? 0,
                }
                const allMax = Math.max(...Object.values(sums), 1)
                const val = sums[kind] ?? 0
                const w = Math.round((val / allMax) * 100)
                const color = PLATFORM_COLORS[kind]
                const labels: Partial<Record<PlatformKind, string>> = { instagram: 'Instagram', tiktok: 'TikTok', telegram: 'Telegram' }
                return (
                  <div key={kind}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <PlatformChip kind={kind} size={16} />
                        <span className="text-sm text-ink">{labels[kind]}</span>
                      </div>
                      <span className="text-sm text-ink tnum">{val.toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-line/60 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${w}%`, background: color }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-5 pt-4 border-t border-line flex items-center justify-between text-xs relative">
              <span className="text-faint">Based on post counts</span>
              <button className="text-mute hover:text-ink uppercase tracking-wider">
                Full report <ArrowRight size={10} className="inline ml-0.5" />
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
