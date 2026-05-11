export type Platform = 'instagram' | 'tiktok' | 'telegram'
export type MediaType = 'image' | 'video'
export type PostStatus = 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed'

export interface Post {
  id: string
  user_id: string
  caption: string | null
  media_url: string | null
  media_type: MediaType | null
  platforms: string[]          // ["instagram:acc_id", "telegram:acc_id"]
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
  scheduled_at?: string | null
}

export interface UpdatePostRequest {
  caption?: string
  media_url?: string
  media_type?: MediaType
  platforms?: string[]
  scheduled_at?: string | null
  status?: PostStatus
}
