import type { Platform } from '@/types/post.types'

export const PLATFORM_COLORS: Record<Platform, string> = {
  instagram: '#E1306C',
  tiktok: '#69C9D0',
  telegram: '#229ED9',
  facebook: '#1877F2',
  linkedin: '#0077B5',
  youtube: '#FF0000',
  twitter: '#000000',
}

export const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  telegram: 'Telegram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  twitter: 'X / Twitter',
}

export function parsePlatformEntry(entry: string): { platform: Platform; accountId: string } {
  const [platform, accountId] = entry.split(':')
  return { platform: platform as Platform, accountId }
}

export function getPlatformFromEntry(entry: string): Platform {
  return entry.split(':')[0] as Platform
}

export function getPlatformColor(platform: string): string {
  return PLATFORM_COLORS[platform as Platform] || '#888'
}
