import { useState } from 'react'

interface MediaFrameProps {
  mediaUrl?: string
  mediaType?: 'image' | 'video'
  // A fixed CSS aspect-ratio (e.g. "9 / 16"), or "auto" to follow the actual
  // media's natural aspect ratio so a cropped image is shown as-is (no re-crop).
  aspectRatio: string
  bgColor?: string
  className?: string
}

export function MediaFrame({ mediaUrl, mediaType, aspectRatio, bgColor = '#111', className = '' }: MediaFrameProps) {
  const auto = aspectRatio === 'auto'
  // When in auto mode, measure the loaded media so the frame matches it exactly.
  const [naturalAspect, setNaturalAspect] = useState<string | undefined>(undefined)

  // In auto mode the frame already matches the media's ratio, so object-contain
  // shows the whole image without cropping (and avoids letterboxing once sized).
  const fit = auto ? 'object-contain' : 'object-cover'
  const effectiveAspect = auto ? (naturalAspect ?? '1 / 1') : aspectRatio

  return (
    <div
      className={`w-full overflow-hidden ${className}`}
      style={{ aspectRatio: effectiveAspect, background: bgColor }}
    >
      {mediaUrl ? (
        mediaType === 'video' ? (
          <video
            src={mediaUrl}
            className={`w-full h-full ${fit}`}
            muted
            loop
            autoPlay
            playsInline
            onLoadedMetadata={auto ? (e) => {
              const v = e.currentTarget
              if (v.videoWidth && v.videoHeight) setNaturalAspect(`${v.videoWidth} / ${v.videoHeight}`)
            } : undefined}
          />
        ) : (
          <img
            src={mediaUrl}
            alt="preview"
            className={`w-full h-full ${fit}`}
            onLoad={auto ? (e) => {
              const img = e.currentTarget
              if (img.naturalWidth && img.naturalHeight) setNaturalAspect(`${img.naturalWidth} / ${img.naturalHeight}`)
            } : undefined}
          />
        )
      ) : (
        <div
          className="w-full h-full flex items-center justify-center"
          style={{ background: bgColor }}
        >
          <div className="text-center opacity-30">
            <div className="text-4xl mb-2">🖼</div>
            <div className="text-xs font-mono text-white">{auto ? 'auto' : aspectRatio.replace(' / ', ':')}</div>
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
