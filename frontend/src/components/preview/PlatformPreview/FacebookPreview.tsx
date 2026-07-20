import { ThumbsUp, MessageCircle, Share2, Globe, MoreHorizontal } from 'lucide-react'
import type { PreviewProps } from '../types'
import { MediaFrame, AvatarCircle } from './shared'

export default function FacebookPreview({ mediaUrl, mediaType, caption, account }: PreviewProps) {
  const username = account?.username || 'Your Page'

  return (
    <div className="w-full max-w-[375px] mx-auto bg-white rounded-2xl overflow-hidden shadow-xl font-sans text-black">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-3.5 py-3">
        <AvatarCircle src={account?.avatar_url} name={username} size={40} />
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold truncate">{username}</div>
          <div className="flex items-center gap-1 text-[11px] text-gray-500 mt-0.5">
            <span>Just now ·</span>
            <Globe size={11} />
          </div>
        </div>
        <div className="flex items-center gap-1 text-gray-500">
          <MoreHorizontal size={18} />
          <span className="text-lg leading-none">×</span>
        </div>
      </div>

      {/* Caption */}
      {caption && (
        <div className="px-3.5 pb-2.5 text-[13px] leading-snug line-clamp-3">{caption}</div>
      )}

      {/* Media */}
      {mediaUrl && (
        <MediaFrame mediaUrl={mediaUrl} mediaType={mediaType} aspectRatio="auto" bgColor="#f0f2f5" />
      )}

      {/* Reaction summary */}
      <div className="flex items-center justify-between px-3.5 py-1.5 text-[12px] text-gray-500 border-b border-gray-100">
        <div className="flex items-center gap-1">
          <div className="flex -space-x-0.5">
            {['👍','❤️','😂'].map((e) => (
              <span key={e} className="w-4 h-4 rounded-full bg-white flex items-center justify-center text-[9px] shadow">{e}</span>
            ))}
          </div>
          <span>1.2k</span>
        </div>
        <div className="flex items-center gap-2">
          <span>48 comments</span>
          <span>12 shares</span>
        </div>
      </div>

      {/* Action bar */}
      <div className="grid grid-cols-3 border-b border-gray-100">
        {[
          { icon: <ThumbsUp size={16} />, label: 'Like' },
          { icon: <MessageCircle size={16} />, label: 'Comment' },
          { icon: <Share2 size={16} />, label: 'Share' },
        ].map(({ icon, label }) => (
          <button
            key={label}
            className="flex items-center justify-center gap-1.5 py-2.5 text-[13px] text-gray-500 font-semibold hover:bg-gray-50 transition"
          >
            {icon}
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
