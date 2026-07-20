/**
 * V5 — Analysis types matching backend schemas (app/schemas/analysis.py)
 */

// ---------------------------------------------------------------------------
// AnalysisJob — GET /analysis/status response (AnalysisJobOut)
// ---------------------------------------------------------------------------

export type AnalysisJobStatus =
  | 'queued'
  | 'fetching'
  | 'computing'
  | 'classifying'
  | 'profiling'
  | 'done'
  | 'failed'

export interface AnalysisJob {
  id: string
  account_id: string
  job_type: 'initial_analysis' | 'weekly_refresh'
  status: AnalysisJobStatus
  progress_pct: number
  error_message: string | null
  started_at: string | null
  finished_at: string | null
}

// ---------------------------------------------------------------------------
// StartAnalysisResponse — POST /analysis/start response
// ---------------------------------------------------------------------------

export interface StartAnalysisResponse {
  job_id: string
  status: string
}

// ---------------------------------------------------------------------------
// StatsSummary — GET /analysis/stats response
// ---------------------------------------------------------------------------

export interface HourScore {
  weekday: number   // 0=Monday … 6=Sunday
  hour: number
  avg_er: number
  posts: number
}

export interface FormatScore {
  media_type: string  // IMAGE | VIDEO | CAROUSEL_ALBUM | REELS
  avg_er: number
  post_count: number
}

export interface HashtagScore {
  hashtag: string
  avg_er: number
  post_count: number
}

export type ErBasis = 'reach' | 'followers'

export interface TopPost {
  media_item_id: string
  ig_media_id: string
  permalink: string | null
  posted_at: string
  engagement_rate: number
  er_basis: ErBasis
}

export interface DateValue {
  date: string
  value: number
}

export interface StatsSummary {
  period_days: number
  total_posts: number
  avg_engagement_rate: number
  best_posting_hours: HourScore[]
  format_performance: FormatScore[]
  top_hashtags: HashtagScore[]
  top_posts: TopPost[]
  worst_posts: TopPost[]
  follower_trend: DateValue[]
  posting_frequency_per_week: number
}

// ---------------------------------------------------------------------------
// AccountProfile — GET /analysis/profile response (AccountProfileSchema §4.4)
// ---------------------------------------------------------------------------

export type EmojiUsage = 'none' | 'light' | 'heavy'
export type ContentPerformance = 'strong' | 'average' | 'weak'

export interface ToneOfVoice {
  primary: string
  description: string
  emoji_usage: EmojiUsage
}

export interface ContentPillar {
  name: string
  share_pct: number
  performance: ContentPerformance
}

export interface AudiencePortrait {
  summary: string
  likely_interests: string[]
}

export interface AccountProfile {
  niche: string
  sub_niches: string[]
  tone_of_voice: ToneOfVoice
  content_pillars: ContentPillar[]
  audience_portrait: AudiencePortrait
  language_strategy: string
  strengths: string[]
  weaknesses: string[]
  summary_one_liner: string
}

// ---------------------------------------------------------------------------
// Recommendations — GET /analysis/recommendations response (§4.5)
// ---------------------------------------------------------------------------

export type ActionPriority = 'high' | 'medium' | 'low'

export interface PostingScheduleItem {
  day: string   // monday, tuesday, etc.
  hour: number
  reason: string
}

export interface GrowthAction {
  action: string
  priority: ActionPriority
  expected_impact: string
}

export interface Recommendations {
  posting_schedule: PostingScheduleItem[]
  format_advice: string
  content_ideas_directions: string[]
  hashtag_advice: string
  growth_actions: GrowthAction[]
}

// ---------------------------------------------------------------------------
// ContentIdea — POST /analysis/content-ideas item
// ---------------------------------------------------------------------------

export type MediaFormat = 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM' | 'REELS'

export interface ContentIdea {
  title: string
  caption_draft: string
  format: MediaFormat
  hashtags: string[]
}

export interface ContentIdeasRequest {
  count: number   // 1-5
  topic_hint?: string
}

export interface ContentIdeasResponse {
  ideas: ContentIdea[]
}
