import { ThumbsUp, ThumbsDown, MessageSquare, Share2, MoreHorizontal, Bell } from 'lucide-react'
import type { PreviewProps } from '../types'
import type { ContentType } from '../types'
import { MediaFrame, AvatarCircle } from './shared'

interface Props extends PreviewProps {
  contentType: ContentType
}

export default function YouTubePreview({ mediaUrl, mediaType, caption, account, contentType }: Props) {
  const username = account?.username || 'Your Channel'
  const isShort = contentType === 'reel' || contentType === 'story'

  if (isShort) {
    return (
      <div
        className="relative mx-auto overflow-hidden rounded-2xl shadow-xl bg-black"
        style={{ aspectRatio: '9 / 16', maxWidth: 270 }}
      >
        <MediaFrame mediaUrl={mediaUrl} mediaType={mediaType} aspectRatio="9 / 16" bgColor="#0f0f0f" />

        {/* Right rail */}
        <div className="absolute right-2 bottom-20 flex flex-col items-center gap-4 z-20">
          <RailBtn icon={<ThumbsUp size={22} />} label="12k" />
          <RailBtn icon={<ThumbsDown size={22} />} label="—" />
          <RailBtn icon={<MessageSquare size={22} />} label="348" />
          <RailBtn icon={<Share2 size={22} />} label="Share" />
          <RailBtn icon={<MoreHorizontal size={22} />} label="" />
        </div>

        {/* Bottom info */}
        <div className="absolute bottom-0 left-0 right-0 z-20 p-3"
          style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.9))' }}
        >
          <div className="text-white text-[13px] font-semibold">@{username}</div>
          <div className="text-white/70 text-[11px] line-clamp-2 mt-0.5">{caption || 'Short title here #shorts'}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-[375px] mx-auto font-sans rounded-2xl overflow-hidden shadow-xl"
      style={{ background: '#0f0f0f' }}
    >
      {/* Thumbnail */}
      <div className="relative">
        <MediaFrame mediaUrl={mediaUrl} mediaType={mediaType} aspectRatio="16 / 9" bgColor="#1a1a1a" />
        <div className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
          0:30
        </div>
      </div>

      <div className="px-3 py-3">
        <div className="text-white text-[13px] font-semibold leading-snug line-clamp-2 mb-2">
          {caption || 'Your video title will appear here'}
        </div>
        <div className="flex items-start gap-2.5">
          <AvatarCircle src={account?.avatar_url} name={username} size={32} />
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-medium truncate" style={{ color: '#aaa' }}>{username}</div>
            <div className="text-[11px]" style={{ color: '#717171' }}>12K views · Just now</div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <div className="flex items-center rounded-full overflow-hidden" style={{ background: '#272727' }}>
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-white text-[12px] font-medium border-r border-[#373737]">
              <ThumbsUp size={14} /> 1.2K
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-white text-[12px] font-medium">
              <ThumbsDown size={14} />
            </button>
          </div>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-[12px] font-medium" style={{ background: '#272727' }}>
            <Share2 size={14} /> Share
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-[12px] font-medium ml-auto" style={{ background: '#cc0000' }}>
            <Bell size={14} /> Subscribe
          </button>
        </div>
      </div>
    </div>
  )
}

function RailBtn({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="text-white">{icon}</div>
      {label && <span className="text-white text-[10px] font-semibold">{label}</span>}
    </div>
  )
}
