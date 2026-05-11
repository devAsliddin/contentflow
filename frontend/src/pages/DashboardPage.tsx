import { useQuery } from '@tanstack/react-query'
import { BarChart3, CheckCircle2, Clock, XCircle } from 'lucide-react'
import StatsCard from '@/components/dashboard/StatsCard'
import UpcomingPosts from '@/components/dashboard/UpcomingPosts'
import AiSuggestions from '@/components/dashboard/AiSuggestions'
import { api } from '@/services/api'
import { postsService } from '@/services/posts.service'
import type { AnalyticsOverview } from '@/types/api.types'

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

  const stats = [
    {
      title: 'Total Posts',
      value: overview?.total_posts ?? '—',
      icon: BarChart3,
      color: '#3B82F6',
      trend: [2, 5, 3, 8, 6, 9, 7],
    },
    {
      title: 'Scheduled',
      value: overview?.scheduled ?? '—',
      icon: Clock,
      color: '#F59E0B',
      trend: [1, 3, 2, 5, 4, 6, overview?.scheduled ?? 0],
    },
    {
      title: 'Published',
      value: overview?.published ?? '—',
      icon: CheckCircle2,
      color: '#10B981',
      trend: [0, 2, 1, 4, 3, 5, overview?.published ?? 0],
    },
    {
      title: 'Failed',
      value: overview?.failed ?? '—',
      icon: XCircle,
      color: '#EF4444',
      trend: [0, 0, 1, 0, 0, 1, overview?.failed ?? 0],
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Dashboard</h2>
        <p className="text-sm text-muted-foreground mt-0.5">This week's overview</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <StatsCard key={stat.title} {...stat} />
        ))}
      </div>

      {/* Bottom panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <UpcomingPosts posts={upcomingPosts} loading={postsLoading} />
        </div>
        <div>
          <AiSuggestions />
        </div>
      </div>
    </div>
  )
}
