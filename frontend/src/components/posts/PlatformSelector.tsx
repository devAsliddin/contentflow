import { cn } from '@/utils/cn'
import { getPlatformColor, PLATFORM_LABELS } from '@/utils/platform.utils'
import type { Account } from '@/types/account.types'
import type { Platform } from '@/types/post.types'

interface PlatformSelectorProps {
  accounts: Account[]
  selected: string[]
  onChange: (selected: string[]) => void
}

const PLATFORM_ORDER: Platform[] = ['instagram', 'tiktok', 'telegram']

export default function PlatformSelector({ accounts, selected, onChange }: PlatformSelectorProps) {
  const grouped = PLATFORM_ORDER.reduce((acc, platform) => {
    const platformAccounts = accounts.filter((a) => a.platform === platform)
    if (platformAccounts.length > 0) acc[platform] = platformAccounts
    return acc
  }, {} as Record<Platform, Account[]>)

  function toggle(entry: string) {
    if (selected.includes(entry)) {
      onChange(selected.filter((s) => s !== entry))
    } else {
      onChange([...selected, entry])
    }
  }

  if (Object.keys(grouped).length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No connected accounts.{' '}
        <a href="/accounts" className="text-primary hover:underline">Connect accounts</a> first.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {PLATFORM_ORDER.filter((p) => grouped[p]).map((platform) => {
        const color = getPlatformColor(platform)
        return (
          <div key={platform}>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              {PLATFORM_LABELS[platform]}
            </p>
            <div className="flex flex-wrap gap-2">
              {grouped[platform].map((account) => {
                const entry = `${platform}:${account.id}`
                const isSelected = selected.includes(entry)
                return (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => toggle(entry)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border transition-all',
                      isSelected
                        ? 'border-transparent text-white'
                        : 'border-border text-muted-foreground hover:border-primary/50'
                    )}
                    style={isSelected ? { backgroundColor: color, borderColor: color } : {}}
                  >
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: isSelected ? 'white' : color }}
                    />
                    {account.account_name}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
