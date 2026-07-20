import { ThumbsUp, MessageSquare, Repeat2, Send, Globe, MoreHorizontal } from 'lucide-react'
import type { PreviewProps } from '../types'
import { MediaFrame, AvatarCircle } from './shared'

export default function LinkedInPreview({ mediaUrl, mediaType, caption, account }: PreviewProps) {
  const username = account?.username || 'Your Name'

  return (
    <div className="w-full max-w-[375px] mx-auto bg-white rounded-2xl overflow-hidden shadow-xl font-sans text-black">
      {/* Header */}
      <div className="flex items-start gap-2.5 px-3.5 py-3">
        <AvatarCircle src={account?.avatar_url} name={username} size={44} />
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold truncate">{username}</div>
          <div className="text-[11px] text-gray-500 truncate">Content Creator · Just now</div>
          <div className="flex items-center gap-1 text-[10px] text-gray-400 mt-0.5">
            <Globe size={10} />
          </div>
        </div>
        <div className="flex items-center gap-1 text-gray-400 mt-0.5">
          <MoreHorizontal size={18} />
          <span className="text-lg leading-none">×</span>
        </div>
      </div>

      {/* Caption */}
      {caption && (
        <div className="px-3.5 pb-2 text-[13px] leading-snug line-clamp-3">{caption}</div>
      )}

      {/* Media */}
      {mediaUrl && (
        <MediaFrame mediaUrl={mediaUrl} mediaType={mediaType} aspectRatio="auto" bgColor="#f3f2ef" />
      )}

      {/* Reactions */}
      <div className="flex items-center justify-between px-3.5 py-1.5 text-[11px] text-gray-500 border-b border-gray-100">
        <div className="flex items-center gap-1">
          <span>👍 ❤️ 💡</span>
          <span>842 reactions</span>
        </div>
        <div>37 comments · 14 reposts</div>
      </div>

      {/* Action bar */}
      <div className="grid grid-cols-4">
        {[
          { icon: <ThumbsUp size={15} />, label: 'Like' },
          { icon: <MessageSquare size={15} />, label: 'Comment' },
          { icon: <Repeat2 size={15} />, label: 'Repost' },
          { icon: <Send size={15} />, label: 'Send' },
        ].map(({ icon, label }) => (
          <button
            key={label}
            className="flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] text-gray-500 font-semibold hover:bg-gray-50 transition"
          >
            {icon}
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
