/**
 * V6 — AI Post Creator types
 * Matches backend: app/schemas/ai_posts.py and app/routers/ai_posts.py
 */

// ─── Caption generation ───────────────────────────────────────────────────────

export interface CaptionVariant {
  caption: string
  description: string
  hashtags: string[]
  cta: string
}

// ─── Draft (AiPostDraftOut) ───────────────────────────────────────────────────

export type AiPostStatus = 'generating' | 'ready' | 'sent_to_composer' | 'discarded'

export interface GenerationMeta {
  variants?: CaptionVariant[]
  image_prompt_seed_idea?: string
  profile_used?: boolean
  platform_targets?: string[]
}

export interface AiPostDraft {
  id: string
  user_id: string
  account_id: string | null
  source: 'user_idea' | 'ai_recommendation'
  topic_input: string | null
  caption: string
  description: string | null
  hashtags: string[]
  image_job_id: string | null
  status: AiPostStatus
  generation_meta: GenerationMeta
  created_at: string
  updated_at: string
}

// ─── List item ────────────────────────────────────────────────────────────────

export interface AiPostDraftListItem {
  id: string
  caption: string
  status: AiPostStatus
  image_job_id: string | null
  created_at: string
}

export interface AiPostDraftListResponse {
  items: AiPostDraftListItem[]
  total: number
  page: number
  page_size: number
}

// ─── Requests ─────────────────────────────────────────────────────────────────

export interface GeneratePostRequest {
  account_id?: string | null
  topic?: string | null
  idea_from_recommendation_id?: string | null
  platform_targets: string[]
}

export interface RegenerateCaptionRequest {
  feedback?: string | null
}

export interface RegenerateImageRequest {
  style_hint?: string | null
}

// ─── Responses ────────────────────────────────────────────────────────────────

export interface GenerateImageResponse {
  image_job_id: string
}

export type ImageJobStatus = 'queued' | 'generating' | 'done' | 'failed'

export interface ImageJobStatusResponse {
  id: string
  status: ImageJobStatus
  image_url: string | null
  error_message: string | null
  provider: string | null  // always null from backend
}

export interface SendToComposerResponse {
  post_id: string
  draft_id: string
}
