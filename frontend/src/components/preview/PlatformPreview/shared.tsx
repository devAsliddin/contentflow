interface MediaFrameProps {
  mediaUrl?: string
  mediaType?: 'image' | 'video'
  aspectRatio: string
  bgColor?: string
  className?: string
}

export function MediaFrame({ mediaUrl, mediaType, aspectRatio, bgColor = '#111', className = '' }: MediaFrameProps) {
  return (
    <div
      className={`w-full overflow-hidden ${className}`}
      style={{ aspectRatio, background: bgColor }}
    >
      {mediaUrl ? (
        mediaType === 'video' ? (
          <video
            src={mediaUrl}
            className="w-full h-full object-cover"
            muted
            loop
            autoPlay
            playsInline
          />
        ) : (
          <img src={mediaUrl} alt="preview" className="w-full h-full object-cover" />
        )
      ) : (
        <div
          className="w-full h-full flex items-center justify-center"
          style={{ background: bgColor }}
        >
          <div className="text-center opacity-30">
            <div className="text-4xl mb-2">🖼</div>
            <div className="text-xs font-mono text-white">{aspectRatio.replace(' / ', ':')}</div>
          </div>
        </div>
      )}
    </div>
  )
}

interface AvatarCircleProps {
  src?: string | null
  name: string
  size?: number
  ring?: boolean
  ringColor?: string
}

export function AvatarCircle({ src, name, size = 32, ring = false, ringColor = '#fff' }: AvatarCircleProps) {
  return (
    <div
      className="rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center font-bold uppercase"
      style={{
        width: size,
        height: size,
        outline: ring ? `2px solid ${ringColor}` : 'none',
        outlineOffset: 1,
        background: src ? 'transparent' : 'linear-gradient(135deg,#6C63FF,#00F5A0)',
        color: '#fff',
        fontSize: size * 0.38,
      }}
    >
      {src ? (
        <img src={src} alt={name} className="w-full h-full object-cover" />
      ) : (
        name.charAt(0)
      )}
    </div>
  )
}
