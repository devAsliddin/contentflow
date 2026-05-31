import { useState } from 'react'
import type { ContentType, PostAspect, ConnectedAccount } from './types'
import InstagramPostPreview from './PlatformPreview/InstagramPostPreview'
import InstagramStoryPreview from './PlatformPreview/InstagramStoryPreview'
import TikTokPreview from './PlatformPreview/TikTokPreview'
import TelegramPreview from './PlatformPreview/TelegramPreview'
import FacebookPreview from './PlatformPreview/FacebookPreview'
import LinkedInPreview from './PlatformPreview/LinkedInPreview'
import YouTubePreview from './PlatformPreview/YouTubePreview'
import XTwitterPreview from './PlatformPreview/XTwitterPreview'
import PlatformChip, { type PlatformKind } from '@/components/ui/PlatformChip'

interface Props {
  platforms: string[]           // selected platform IDs: ["instagram", "tiktok", …]
  connectedAccounts: ConnectedAccount[]
  contentType: ContentType
  postAspect: PostAspect
  mediaUrl?: string
  mediaType?: 'image' | 'video'
  caption?: string
}

const PLATFORM_ORDER: PlatformKind[] = [
  'instagram', 'tiktok', 'telegram', 'facebook', 'linkedin', 'youtube', 'twitter',
]

const PLATFORM_LABEL: Record<string, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  telegram: 'Telegram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  twitter: 'X',
}

function getAccountForPlatform(platform: string, connectedAccounts: ConnectedAccount[]): ConnectedAccount | undefined {
  return connectedAccounts.find((a) => a.platform === platform)
}

function renderPreview(
  platform: string,
  props: { mediaUrl?: string; mediaType?: 'image' | 'video'; caption?: string; account?: ConnectedAccount; contentType: ContentType; postAspect: PostAspect }
) {
  const { mediaUrl, mediaType, caption, account, contentType, postAspect } = props
  switch (platform) {
    case 'instagram':
      return contentType === 'story'
        ? <InstagramStoryPreview mediaUrl={mediaUrl} mediaType={mediaType} caption={caption} account={account} />
        : <InstagramPostPreview mediaUrl={mediaUrl} mediaType={mediaType} caption={caption} account={account} postAspect={postAspect} />
    case 'tiktok':
      return <TikTokPreview mediaUrl={mediaUrl} mediaType={mediaType} caption={caption} account={account} />
    case 'telegram':
      return <TelegramPreview mediaUrl={mediaUrl} mediaType={mediaType} caption={caption} account={account} />
    case 'facebook':
      return <FacebookPreview mediaUrl={mediaUrl} mediaType={mediaType} caption={caption} account={account} />
    case 'linkedin':
      return <LinkedInPreview mediaUrl={mediaUrl} mediaType={mediaType} caption={caption} account={account} />
    case 'youtube':
      return <YouTubePreview mediaUrl={mediaUrl} mediaType={mediaType} caption={caption} account={account} contentType={contentType} />
    case 'twitter':
      return <XTwitterPreview mediaUrl={mediaUrl} mediaType={mediaType} caption={caption} account={account} />
    default:
      return null
  }
}

export default function PreviewSwitcher({ platforms, connectedAccounts, contentType, postAspect, mediaUrl, mediaType, caption }: Props) {
  // Only show platforms that are selected (or show all if none selected for preview purposes)
  const activePlatforms = platforms.length > 0
    ? PLATFORM_ORDER.filter((p) => platforms.includes(p))
    : []

  const [active, setActive] = useState<string>(() => activePlatforms[0] || 'instagram')

  const displayPlatforms: PlatformKind[] = activePlatforms.length > 0 ? activePlatforms : PLATFORM_ORDER

  if (activePlatforms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center px-6">
        <div className="text-4xl mb-3">👁</div>
        <div className="text-sm font-medium text-ink mb-1">Select platforms to preview</div>
        <div className="text-xs text-faint">Choose at least one platform on the left to see a live preview</div>
      </div>
    )
  }

  const currentPlatform: PlatformKind = (activePlatforms.includes(active as PlatformKind) ? active : activePlatforms[0]) as PlatformKind

  return (
    <div className="flex flex-col gap-4">
      {/* Tab bar */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {displayPlatforms.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setActive(p)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition ${
              currentPlatform === p
                ? 'bg-indigo-500/15 border-indigo-500/40 text-ink'
                : 'bg-bg/40 border-line text-mute hover:border-line2 hover:text-ink'
            }`}
          >
            <PlatformChip kind={p} size={16} />
            {PLATFORM_LABEL[p]}
          </button>
        ))}
      </div>

      {/* Preview */}
      <div className="flex justify-center py-2">
        {renderPreview(currentPlatform, {
          mediaUrl,
          mediaType,
          caption,
          account: getAccountForPlatform(currentPlatform, connectedAccounts),
          contentType,
          postAspect,
        })}
      </div>

      <div className="text-center text-[11px] text-faint">
        Display-only mockup — interactions are not functional
      </div>
    </div>
  )
}
