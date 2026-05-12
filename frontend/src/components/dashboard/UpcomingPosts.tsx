import { MoreHorizontal } from 'lucide-react'
import PlatformChip, { type PlatformKind } from '@/components/ui/PlatformChip'
import StatusPill from '@/components/ui/StatusPill'
import ImgPlaceholder from '@/components/ui/ImgPlaceholder'
import { formatDateTime } from '@/utils/date.utils'
import { getPlatformFromEntry } from '@/utils/platform.utils'
import type { Post } from '@/types/post.types'

interface Props {
  posts: Post[]
  loading?: boolean
}

export default function UpcomingPosts({ posts, loading }: Props) {
  if (loading) {
    return (
      <div className="rounded-2xl bg-surface border border-line overflow-hidden">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-line last:border-0">
            <div className="w-14 h-14 rounded-md bg-surface2 animate-pulse shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-surface2 rounded w-3/4 animate-pulse" />
              <div className="h-2.5 bg-surface2 rounded w-1/2 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <div className="rounded-2xl bg-surface border border-line p-10 text-center">
        <p className="text-sm text-mute">No upcoming posts</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-surface border border-line overflow-hidden">
      {posts.map((post, i) => {
        const platforms = (post.platforms || []).map(getPlatformFromEntry) as PlatformKind[]
        const hue = (i * 47 + 12) % 360
        return (
          <div
            key={post.id}
            className={`group relative grid grid-cols-[64px_1fr_auto_auto] items-center gap-4 px-5 py-4 hover:bg-surface2/60 transition ${i < posts.length - 1 ? 'border-b border-line' : ''}`}
          >
            <ImgPlaceholder label="post" aspect="1 / 1" hue={hue} className="w-14 h-14" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {platforms.slice(0, 3).map((pl) => (
                  <PlatformChip key={pl} kind={pl} size={18} />
                ))}
              </div>
              <div className="text-[14px] text-ink truncate">
                {post.caption?.slice(0, 80) || 'No caption'}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-ink tnum">
                {post.scheduled_at ? formatDateTime(post.scheduled_at) : '—'}
              </div>
            </div>
            <div className="flex items-center gap-3 pl-2">
              <StatusPill kind={post.status}>{post.status}</StatusPill>
              <button className="p-1.5 rounded-md text-faint hover:text-ink hover:bg-surface opacity-0 group-hover:opacity-100 transition">
                <MoreHorizontal size={16} />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
