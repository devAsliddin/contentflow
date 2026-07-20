import { MessageCircle, Repeat2, Heart, BarChart2, Bookmark, Share } from 'lucide-react'
import type { PreviewProps } from '../types'
import { MediaFrame, AvatarCircle } from './shared'

export default function XTwitterPreview({ mediaUrl, mediaType, caption, account }: PreviewProps) {
  const username = account?.username || 'yourhandle'
  const displayName = username.replace(/[^a-zA-Z0-9_]/g, '')

  return (
    <div
      className="w-full max-w-[375px] mx-auto rounded-2xl overflow-hidden shadow-xl font-sans"
      style={{ background: '#000', color: '#e7e9ea' }}
    >
      <div className="flex gap-2.5 px-3.5 pt-3.5 pb-2">
        <AvatarCircle src={account?.avatar_url} name={displayName} size={40} />
        <div className="flex-1 min-w-0">
          {/* Name row */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[14px] font-bold truncate">{displayName}</span>
            <svg viewBox="0 0 24 24" width="15" height="15" className="fill-[#1d9bf0] flex-shrink-0">
              <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91C2.88 9.33 2 10.57 2 12s.88 2.67 2.19 3.34c-.46 1.39-.2 2.9.81 3.91s2.52 1.26 3.91.8c.67 1.31 1.91 2.19 3.34 2.19s2.67-.88 3.33-2.19c1.39.46 2.9.2 3.91-.81s1.27-2.52.81-3.91C21.37 14.67 22.25 13.43 22.25 12z" />
            </svg>
            <span className="text-[13px]" style={{ color: '#71767b' }}>@{displayName}</span>
            <span className="text-[13px]" style={{ color: '#71767b' }}>· Just now</span>
          </div>

          {/* Caption */}
          <div className="text-[14px] leading-snug mt-1 whitespace-pre-line">
            {caption || <span style={{ color: '#71767b' }}>Your tweet will appear here…</span>}
          </div>

          {/* Media */}
          {mediaUrl && (
            <div className="mt-2 rounded-xl overflow-hidden border" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <MediaFrame mediaUrl={mediaUrl} mediaType={mediaType} aspectRatio="auto" bgColor="#16181c" />
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between mt-3 max-w-xs" style={{ color: '#71767b' }}>
            <ActionItem icon={<MessageCircle size={17} strokeWidth={1.8} />} count="24" />
            <ActionItem icon={<Repeat2 size={17} strokeWidth={1.8} />} count="148" />
            <ActionItem icon={<Heart size={17} strokeWidth={1.8} />} count="1.2k" />
            <ActionItem icon={<BarChart2 size={17} strokeWidth={1.8} />} count="8.4k" />
            <div className="flex items-center gap-3">
              <Bookmark size={17} strokeWidth={1.8} />
              <Share size={17} strokeWidth={1.8} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ActionItem({ icon, count }: { icon: React.ReactNode; count: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[12px]">
      {icon}
      <span>{count}</span>
    </div>
  )
}
