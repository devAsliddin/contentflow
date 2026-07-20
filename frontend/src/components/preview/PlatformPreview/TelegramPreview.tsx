import { Eye, Forward } from 'lucide-react'
import type { PreviewProps } from '../types'
import { MediaFrame, AvatarCircle } from './shared'

export default function TelegramPreview({ mediaUrl, mediaType, caption, account }: PreviewProps) {
  const username = account?.username || 'Your Channel'

  return (
    <div className="w-full max-w-[375px] mx-auto font-sans shadow-xl rounded-2xl overflow-hidden"
      style={{ background: '#17212b' }}
    >
      {/* Channel header */}
      <div className="flex items-center gap-2.5 px-3.5 py-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <AvatarCircle src={account?.avatar_url} name={username} size={36} />
        <div className="flex-1 min-w-0">
          <div className="text-white text-[13px] font-semibold truncate">{username}</div>
          <div className="text-[11px]" style={{ color: '#5f9cc5' }}>Channel</div>
        </div>
      </div>

      {/* Message bubble */}
      <div className="px-2.5 py-2">
        <div className="rounded-xl overflow-hidden" style={{ background: '#1e2d3b' }}>
          {mediaUrl && (
            <MediaFrame mediaUrl={mediaUrl} mediaType={mediaType} aspectRatio="auto" bgColor="#0e1621" />
          )}
          <div className="px-3 py-2.5">
            <div className="text-white text-[13px] leading-snug">
              {caption || <span style={{ color: 'rgba(255,255,255,0.4)' }}>Caption will appear here…</span>}
            </div>

            {/* Reactions */}
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {['👍 24', '❤️ 12', '🔥 8'].map((r) => (
                <span
                  key={r}
                  className="text-[11px] px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}
                >
                  {r}
                </span>
              ))}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                <Eye size={12} />
                <span className="text-[10px]">1.2k views</span>
              </div>
              <div className="flex items-center gap-3" style={{ color: 'rgba(255,255,255,0.35)' }}>
                <Forward size={14} />
                <span className="text-[10px]">Just now</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
