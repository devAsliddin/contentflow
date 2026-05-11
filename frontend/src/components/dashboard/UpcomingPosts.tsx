import { Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { cn } from '@/utils/cn'
import { formatDateTime } from '@/utils/date.utils'
import { getPlatformColor, getPlatformFromEntry } from '@/utils/platform.utils'
import type { Post, PostStatus } from '@/types/post.types'

const STATUS_ICONS: Record<PostStatus, React.ReactNode> = {
  draft: <Clock size={14} className="text-muted-foreground" />,
  scheduled: <Clock size={14} className="text-yellow-400" />,
  publishing: <Loader2 size={14} className="text-blue-400 animate-spin" />,
  published: <CheckCircle2 size={14} className="text-green-400" />,
  failed: <XCircle size={14} className="text-destructive" />,
}

const STATUS_LABELS: Record<PostStatus, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  publishing: 'Publishing',
  published: 'Published',
  failed: 'Failed',
}

interface UpcomingPostsProps {
  posts: Post[]
  loading?: boolean
}

export default function UpcomingPosts({ posts, loading }: UpcomingPostsProps) {
  if (loading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Upcoming Posts</h3>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-8 h-8 bg-muted rounded-lg" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-muted rounded w-3/4" />
                <div className="h-2.5 bg-muted rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">Upcoming Posts</h3>

      {posts.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No upcoming posts</p>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => {
            const platforms = (post.platforms || []).map(getPlatformFromEntry)
            return (
              <div key={post.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-accent/50 transition-colors">
                {/* Platform dots */}
                <div className="flex flex-col gap-1 mt-0.5">
                  {platforms.slice(0, 3).map((platform, idx) => (
                    <div
                      key={idx}
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: getPlatformColor(platform) }}
                    />
                  ))}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">
                    {post.caption?.slice(0, 80) || 'No caption'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {post.scheduled_at ? formatDateTime(post.scheduled_at) : 'Not scheduled'}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {STATUS_ICONS[post.status]}
                  <span className="text-xs text-muted-foreground">{STATUS_LABELS[post.status]}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
