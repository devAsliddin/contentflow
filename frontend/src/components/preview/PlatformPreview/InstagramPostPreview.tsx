import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal } from 'lucide-react'
import type { PreviewProps } from '../types'
import type { PostAspect } from '../types'
import { MediaFrame } from './shared'

interface Props extends PreviewProps {
  postAspect: PostAspect
}

export default function InstagramPostPreview({ mediaUrl, mediaType, caption, account, postAspect }: Props) {
  const username = account?.username || 'your_account'
  const avatar = account?.avatar_url

  return (
    <div className="w-full max-w-[375px] mx-auto bg-white rounded-2xl overflow-hidden text-black font-sans shadow-xl">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div
          className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 p-0.5 flex-shrink-0"
        >
          <div className="w-full h-full rounded-full bg-white overflow-hidden">
            {avatar ? (
              <img src={avatar} alt={username} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white text-[10px] font-bold uppercase">
                {username.charAt(0)}
              </div>
            )}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold leading-none truncate">{username}</div>
          <div className="text-[11px] text-gray-500 mt-0.5">Sponsored</div>
        </div>
        <MoreHorizontal size={18} className="text-gray-500 flex-shrink-0" />
      </div>

      {/* Media */}
      <MediaFrame
        mediaUrl={mediaUrl}
        mediaType={mediaType}
        aspectRatio={postAspect === '1:1' ? '1 / 1' : '4 / 5'}
        bgColor="#f3f4f6"
      />

      {/* Action row */}
      <div className="px-3 pt-2.5 pb-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <Heart size={22} className="text-gray-800" strokeWidth={1.8} />
            <MessageCircle size={22} className="text-gray-800" strokeWidth={1.8} />
            <Send size={22} className="text-gray-800 -rotate-12" strokeWidth={1.8} />
          </div>
          <Bookmark size={22} className="text-gray-800" strokeWidth={1.8} />
        </div>
        <div className="text-[13px] font-semibold mt-2">1,204 likes</div>
        <div className="text-[13px] mt-1 leading-snug line-clamp-2">
          <span className="font-semibold mr-1.5">{username}</span>
          {caption || 'Your caption will appear here…'}
        </div>
        <div className="text-[12px] text-gray-400 mt-1">View all 48 comments</div>
        <div className="text-[11px] text-gray-400 mt-1 uppercase tracking-wider">Just now</div>
      </div>
    </div>
  )
}
