export interface User {
  id: string
  email: string
  full_name: string | null
  is_active: boolean
  is_admin: boolean
  created_at: string
}

export interface AuthResponse {
  access_token: string
  refresh_token: string
  token_type: 'bearer'
  user: User
}

export interface ApiError {
  detail: string
}

export interface UploadResponse {
  url: string
  filename: string
  media_type: 'image' | 'video'
  size_bytes: number
}

export interface AnalyticsOverview {
  total_posts: number
  scheduled: number
  published: number
  failed: number
  week_start: string
  week_end: string
}

export interface PlatformAnalytics {
  platform: string
  total: number
  published: number
  failed: number
}

// AI Plan types
export interface DayPost {
  platform: string
  content_idea: string
  caption_suggestion: string
  hashtags: string[]
  best_time: string
}

export interface PlanDay {
  day: string
  posts: DayPost[]
}

export interface WeeklyPlan {
  week_start: string
  days: PlanDay[]
}

export interface GeneratePlanRequest {
  niche: string
  frequency: number
  tone: string
  platforms: string[]
  language?: string
}

export interface GenerateCaptionRequest {
  topic: string
  platform: string
  tone: string
  language?: string
}

export interface CaptionResponse {
  caption: string
  hashtags: string[]
  character_count: number
}

export interface PostIdea {
  title: string
  description: string
  platform: string
  content_type: string
}

export interface IdeasResponse {
  ideas: PostIdea[]
}

// V2 analytics types

export interface PlatformDayCount {
  date: string         // "2026-05-06"
  telegram: number
  instagram: number
  tiktok: number
}

export interface PlatformComparison {
  date: string
  telegram: number
  instagram: number
  tiktok: number
}

export interface PostPerformance {
  id: string
  platform: string
  caption: string | null
  published_at: string
  views: number
  likes: number
  reach: number
}

export interface FollowerGrowthPoint {
  date: string
  telegram: number
  instagram: number
  tiktok: number
  total: number
}

export interface FollowerAccountPoint {
  date: string
  followers: number
}

export interface FollowerAccountSeries {
  account_id: string | null
  account_name: string
  platform: string
  latest_count: number
  delta: number
  series: FollowerAccountPoint[]
}

export interface FollowerGrowthResponse {
  days: number
  platform: string | null
  account_id: string | null
  series: FollowerGrowthPoint[]
  accounts: FollowerAccountSeries[]
}
