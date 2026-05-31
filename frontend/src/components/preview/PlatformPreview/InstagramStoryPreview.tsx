import { X } from 'lucide-react'
import type { PreviewProps } from '../types'
import { MediaFrame, AvatarCircle } from './shared'

export default function InstagramStoryPreview({ mediaUrl, mediaType, account }: PreviewProps) {
  const username = account?.username || 'your_account'

  return (
    <div
      className="relative mx-auto overflow-hidden rounded-2xl shadow-xl bg-black"
      style={{ aspectRatio: '9 / 16', maxWidth: 270 }}
    >
      <MediaFrame mediaUrl={mediaUrl} mediaType={mediaType} aspectRatio="9 / 16" bgColor="#1a1a2e" />

      {/* Segmented progress bar */}
      <div className="absolute top-3 left-3 right-3 flex gap-1 z-20">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex-1 h-0.5 rounded-full bg-white/30">
            {i === 1 && <div className="h-full w-3/5 bg-white rounded-full" />}
          </div>
        ))}
      </div>

      {/* Top bar */}
      <div className="absolute top-6 left-3 right-3 flex items-center gap-2 z-20">
        <AvatarCircle src={account?.avatar_url} name={username} size={32} ring ringColor="#fff" />
        <div className="flex-1 min-w-0">
          <div className="text-white text-[12px] font-semibold leading-none truncate">{username}</div>
          <div className="text-white/60 text-[10px] mt-0.5">Just now</div>
        </div>
        <X size={18} className="text-white flex-shrink-0" />
      </div>

      {/* Reply input */}
      <div className="absolute bottom-4 left-3 right-3 z-20 flex items-center gap-2">
        <div className="flex-1 border border-white/50 rounded-full px-3 py-1.5 text-[11px] text-white/70">
          Send message
        </div>
        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="white" strokeWidth="2">
            <path d="M22 2L11 13" /><path d="M22 2L15 22 11 13 2 9l20-7z" />
          </svg>
        </div>
      </div>
    </div>
  )
}
