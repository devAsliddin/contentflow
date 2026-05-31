import { Heart, MessageCircle, Bookmark, Share2 } from 'lucide-react'
import type { PreviewProps } from '../types'
import { MediaFrame, AvatarCircle } from './shared'

export default function TikTokPreview({ mediaUrl, mediaType, caption, account }: PreviewProps) {
  const username = account?.username || 'your_account'

  return (
    <div
      className="relative mx-auto overflow-hidden rounded-2xl shadow-xl bg-black"
      style={{ aspectRatio: '9 / 16', maxWidth: 270 }}
    >
      <MediaFrame mediaUrl={mediaUrl} mediaType={mediaType} aspectRatio="9 / 16" bgColor="#0e0e12" />

      {/* Right rail */}
      <div className="absolute right-3 bottom-24 flex flex-col items-center gap-5 z-20">
        {/* Creator avatar */}
        <div className="relative mb-1">
          <AvatarCircle src={account?.avatar_url} name={username} size={40} ring ringColor="#fff" />
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-[#ff2a55] border-2 border-black flex items-center justify-center">
            <span className="text-white text-[8px]">+</span>
          </div>
        </div>

        <RailItem icon={<Heart size={26} />} count="12.4k" />
        <RailItem icon={<MessageCircle size={26} />} count="348" />
        <RailItem icon={<Bookmark size={26} />} count="2.1k" />
        <RailItem icon={<Share2 size={26} />} count="Share" />

        {/* Spinning music disc */}
        <div
          className="w-10 h-10 rounded-full border-2 border-white/20 overflow-hidden relative animate-spin"
          style={{ background: 'linear-gradient(135deg,#0e0e12,#ff2a55,#25f4ee)', animationDuration: '4s' }}
        >
          <div className="w-3 h-3 rounded-full bg-black absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>
      </div>

      {/* Bottom caption */}
      <div className="absolute bottom-0 left-0 right-0 z-20 p-3"
        style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.85))' }}
      >
        <div className="text-white text-[13px] font-semibold mb-1">@{username}</div>
        <div className="text-white/80 text-[12px] leading-snug line-clamp-2">
          {caption || 'Your caption #fyp #trending'}
        </div>
        <div className="flex items-center gap-1.5 mt-2">
          <div className="w-4 h-4 rounded-full bg-[#ff2a55] flex items-center justify-center">
            <span className="text-white text-[7px]">♪</span>
          </div>
          <div className="text-white/60 text-[10px] truncate">original sound · {username}</div>
        </div>
      </div>
    </div>
  )
}

function RailItem({ icon, count }: { icon: React.ReactNode; count: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="text-white">{icon}</div>
      <span className="text-white text-[10px] font-semibold">{count}</span>
    </div>
  )
}
