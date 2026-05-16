export type Platform = 'instagram' | 'tiktok' | 'telegram'
export type MediaType = 'image' | 'video'
export type PostStatus = 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed'
export type PlatformPlacement = 'feed' | 'reel' | 'story' | 'post'
export type AspectRatio = '1:1' | '4:5' | '16:9' | '9:16'

export interface PlatformPublishOptions {
  placement?: PlatformPlacement
  aspect_ratio?: AspectRatio
}

export type PlatformOptions = Partial<Record<Platform, PlatformPublishOptions>>

export interface Post {
  id: string
  user_id: string
  caption: string | null
  media_url: string | null
  media_type: MediaType | null
  platforms: string[]          // ["instagram:acc_id", "telegram:acc_id"]
  platform_options: PlatformOptions
  scheduled_at: string | null  // ISO 8601
  status: PostStatus
  created_at: string
  updated_at: string
}

export interface CreatePostRequest {
  caption?: string
  media_url?: string
  media_type?: MediaType
  platforms: string[]
  platform_options?: PlatformOptions
  scheduled_at?: string | null
}

export interface UpdatePostRequest {
  caption?: string
  media_url?: string
  media_type?: MediaType
  platforms?: string[]
  platform_options?: PlatformOptions
  scheduled_at?: string | null
  status?: PostStatus
}

export interface PostReviewTarget {
  platform: string
  account_id: string | null
  account_name: string | null
  status: 'ready' | 'blocked'
  placement: string | null
  aspect_ratio: string | null
  notes: string[]
}

export interface PostReview {
  ok: boolean
  errors: string[]
  warnings: string[]
  targets: PostReviewTarget[]
}
