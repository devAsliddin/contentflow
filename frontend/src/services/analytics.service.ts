import axios from 'axios'
import { api } from './api'
import type {
  AnalyticsOverview,
  FollowerGrowthResponse,
  PlatformComparison,
  PostPerformance,
} from '@/types/api.types'

type PlatformKey = 'telegram' | 'instagram' | 'tiktok'

type PlatformComparisonEnvelope = {
  days: number
  platforms: Array<{
    platform: string
    dates: string[]
    post_counts?: number[]
    published_counts?: number[]
  }>
}

type PostPerformanceEnvelope = {
  days: number
  platform?: string | null
  total: number
  posts: RawPostPerformance[]
}

type RawPostPerformance = Omit<PostPerformance, 'id' | 'caption'> & {
  id?: string
  post_id?: string
  caption?: string | null
  caption_preview?: string
}

function getV2BaseUrl() {
  return (import.meta.env.VITE_API_URL || '/api/v1').replace('/v1', '/v2')
}

function normalizePlatform(platform: string): PlatformKey | null {
  const value = platform.toLowerCase()
  if (value === 'telegram' || value === 'instagram' || value === 'tiktok') return value
  return null
}

function normalizePlatformComparison(
  payload: PlatformComparison[] | PlatformComparisonEnvelope
): PlatformComparison[] {
  if (Array.isArray(payload)) return payload

  const byDate = new Map<string, PlatformComparison>()

  for (const entry of payload.platforms ?? []) {
    const platform = normalizePlatform(entry.platform)
    if (!platform) continue

    entry.dates.forEach((date, index) => {
      const row = byDate.get(date) ?? { date, telegram: 0, instagram: 0, tiktok: 0 }
      row[platform] = entry.published_counts?.[index] ?? entry.post_counts?.[index] ?? 0
      byDate.set(date, row)
    })
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date))
}

function normalizePostPerformance(
  payload: PostPerformance[] | PostPerformanceEnvelope
): PostPerformance[] {
  const rows: RawPostPerformance[] = Array.isArray(payload) ? payload : payload.posts ?? []

  return rows.map((row) => ({
    id: row.id ?? row.post_id ?? '',
    platform: row.platform,
    caption: row.caption ?? row.caption_preview ?? null,
    published_at: row.published_at,
    views: row.views,
    likes: row.likes,
    reach: row.reach,
  }))
}

export const analyticsService = {
  async getOverview(): Promise<AnalyticsOverview> {
    const { data } = await api.get<AnalyticsOverview>('/analytics/overview')
    return data
  },

  async getPlatformComparison(days = 7): Promise<PlatformComparison[]> {
    const BASE_URL = getV2BaseUrl()
    const token = localStorage.getItem('access_token')
    const { data } = await axios.get<PlatformComparison[] | PlatformComparisonEnvelope>(
      `${BASE_URL}/analytics/platforms/comparison`,
      {
        params: { days },
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }
    )
    return normalizePlatformComparison(data)
  },

  async getPostPerformance(days = 7): Promise<PostPerformance[]> {
    const BASE_URL = getV2BaseUrl()
    const token = localStorage.getItem('access_token')
    const { data } = await axios.get<PostPerformance[] | PostPerformanceEnvelope>(
      `${BASE_URL}/analytics/posts`,
      {
        params: { days },
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }
    )
    return normalizePostPerformance(data)
  },

  async getFollowerGrowth(days = 30): Promise<FollowerGrowthResponse> {
    const BASE_URL = getV2BaseUrl()
    const token = localStorage.getItem('access_token')
    const { data } = await axios.get<FollowerGrowthResponse>(
      `${BASE_URL}/analytics/followers`,
      {
        params: { days },
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }
    )
    return data
  },
}
