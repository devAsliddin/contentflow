import { useQuery } from '@tanstack/react-query'
import { Filter, ArrowRight, CheckCircle2, Zap, AlertTriangle } from 'lucide-react'
import StatsCard from '@/components/dashboard/StatsCard'
import UpcomingPosts from '@/components/dashboard/UpcomingPosts'
import AiSuggestions from '@/components/dashboard/AiSuggestions'
import PlatformChip, { PLATFORM_META, type PlatformKind } from '@/components/ui/PlatformChip'
import { api } from '@/services/api'
import { postsService } from '@/services/posts.service'
import type { AnalyticsOverview } from '@/types/api.types'

const SPARKS = {
  posts:      [4, 6, 5, 9, 7, 11, 8, 12, 10, 14, 13, 16],
  scheduled:  [2, 3, 5, 4, 7, 6, 8, 7, 9, 11, 10, 12],
  published:  [6, 8, 7, 10, 9, 12, 11, 14, 13, 15, 16, 18],
  engagement: [3.1, 3.4, 3.2, 3.8, 3.6, 4.1, 4.0, 4.4, 4.2, 4.7, 4.5, 4.9],
}

const ACTIVITY = [
  { icon: CheckCircle2, tint: '#00F5A0', title: 'Published to Instagram', desc: '"Morning flow" — live', time: '14m ago' },
  { icon: Zap,          tint: '#6C63FF', title: 'AI generated 3 captions', desc: 'For your Thursday queue', time: '42m ago' },
  { icon: AlertTriangle, tint: '#FFB347', title: 'Token expires in 6 days', desc: 'Refresh TikTok connection', time: '2h ago' },
]

function ReachRow({ kind, value, max, pct }: { kind: PlatformKind; value: number; max: number; pct: string }) {
  const p = PLATFORM_META[kind]
  const w = Math.round((value / max) * 100)
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <PlatformChip kind={kind} size={16} />
          <span className="text-sm text-ink">{p.label}</span>
        </div>
        <div className="text-sm tnum">
          <span className="text-ink">{value.toLocaleString()}</span>
          <span className="text-mint-500 text-[11px] ml-2">{pct}</span>
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-line/60 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${w}%`, background: p.bg }} />
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { data: overview } = useQuery<AnalyticsOverview>({
    queryKey: ['analytics', 'overview'],
    queryFn: async () => {
      const { data } = await api.get('/analytics/overview')
      return data
    },
  })

  const { data: upcomingPosts = [], isLoading: postsLoading } = useQuery({
    queryKey: ['posts', 'upcoming'],
    queryFn: () => postsService.list({ limit: 8, status: 'scheduled' }),
  })

  return (
    <div className="page-in px-8 py-6 grid grid-cols-12 gap-6">
      {/* Stats row */}
      <div className="col-span-12 grid grid-cols-4 gap-4">
        <StatsCard
          label="Posts this week"
          value={overview?.total_posts ?? '14'}
          delta="+22%"
          deltaKind="up"
          sparkValues={SPARKS.posts}
          sparkColor="#6C63FF"
          sparkFill="rgba(108,99,255,0.18)"
        />
        <StatsCard
          label="Scheduled"
          value={overview?.scheduled ?? '9'}
          delta="+3"
          deltaKind="up"
          sparkValues={SPARKS.scheduled}
          sparkColor="#FFB347"
          sparkFill="rgba(255,179,71,0.18)"
        />
        <StatsCard
          label="Published"
          value={overview?.published ?? '42'}
          delta="+11"
          deltaKind="up"
          sparkValues={SPARKS.published}
          sparkColor="#00F5A0"
          sparkFill="rgba(0,245,160,0.18)"
        />
        <StatsCard
          label="Engagement rate"
          value="4.9%"
          delta="+0.4%"
          deltaKind="up"
          sparkValues={SPARKS.engagement}
          sparkColor="#5BE8FF"
          sparkFill="rgba(91,232,255,0.18)"
        />
      </div>

      {/* Upcoming + Activity */}
      <div className="col-span-12 lg:col-span-8">
        <div className="flex items-end justify-between mb-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-faint mb-1">Next up</div>
            <h2 className="font-display text-xl text-ink tracking-tight">Upcoming posts</h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-surface border border-line rounded-lg p-0.5 text-xs">
              <button className="px-3 py-1 rounded-md bg-surface2 text-ink">Timeline</button>
              <button className="px-3 py-1 rounded-md text-mute hover:text-ink">Board</button>
            </div>
            <button className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-surface border border-line text-ink hover:border-line2 hover:bg-surface2 transition">
              <Filter size={12} />
              Filter
            </button>
          </div>
        </div>
        <UpcomingPosts posts={upcomingPosts} loading={postsLoading} />

        {/* Activity */}
        <div className="mt-8">
          <div className="flex items-end justify-between mb-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-faint mb-1">Today</div>
              <h2 className="font-display text-xl text-ink tracking-tight">Activity</h2>
            </div>
            <button className="text-[11px] text-mute hover:text-ink inline-flex items-center gap-1 uppercase tracking-wider">
              View all <ArrowRight size={11} />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {ACTIVITY.map(({ icon: Icon, tint, title, desc, time }) => (
              <div key={title} className="rounded-xl bg-surface border border-line p-4 lift">
                <div className="flex items-start gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `${tint}1A`, color: tint, boxShadow: `inset 0 0 0 1px ${tint}33` }}
                  >
                    <Icon size={15} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] text-ink truncate">{title}</div>
                    <div className="text-[12px] text-mute mt-0.5">{desc}</div>
                    <div className="text-[10px] text-faint mt-2 uppercase tracking-wider">{time}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
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
        <AiSuggestions />

        {/* Reach by platform */}
        <div className="mt-8 rounded-2xl bg-surface border border-line p-5 relative overflow-hidden">
          <div
            className="absolute -right-12 -bottom-12 w-40 h-40 rounded-full blur-3xl"
            style={{ background: 'rgba(108,99,255,0.18)' }}
          />
          <div className="mb-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-faint mb-1">This week</div>
            <h2 className="font-display text-xl text-ink tracking-tight">Reach by platform</h2>
          </div>
          <div className="space-y-3 relative">
            <ReachRow kind="instagram" value={28400} max={40000} pct="+18%" />
            <ReachRow kind="tiktok"    value={36100} max={40000} pct="+42%" />
            <ReachRow kind="telegram"  value={8420}  max={40000} pct="+6%"  />
          </div>
          <div className="mt-5 pt-4 border-t border-line flex items-center justify-between text-xs">
            <span className="text-faint">Updated 2 min ago</span>
            <button className="text-mute hover:text-ink uppercase tracking-wider">Full report →</button>
          </div>
        </div>
      </aside>
    </div>
  )
}
