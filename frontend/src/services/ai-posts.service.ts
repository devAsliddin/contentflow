/**
 * V6 — AI Post Creator service
 * Backend: /api/ai-posts/...
 *
 * Uses the same `v4` axios instance pattern (base URL without /v1).
 */

import axios from 'axios'
import type {
  AiPostDraft,
  AiPostDraftListResponse,
  GeneratePostRequest,
  RegenerateCaptionRequest,
  RegenerateImageRequest,
  GenerateImageResponse,
  ImageJobStatusResponse,
  SendToComposerResponse,
} from '@/types/ai-posts.types'

function apiBase(): string {
  return (import.meta.env.VITE_API_URL || '/api/v1').replace('/v1', '')
}

const v4 = axios.create({ headers: { 'Content-Type': 'application/json' } })
v4.interceptors.request.use((config) => {
  config.baseURL = apiBase()
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export const aiPostsService = {
  /**
   * POST /api/ai-posts/generate
   * Synchronously generate 3 caption variants + image seed idea.
   * Returns a new AiPostDraft with status='ready'.
   */
  async generate(payload: GeneratePostRequest): Promise<AiPostDraft> {
    const { data } = await v4.post<AiPostDraft>('/ai-posts/generate', payload)
    return data
  },

  /**
   * POST /api/ai-posts/{id}/regenerate-caption
   * Regenerate captions with optional user feedback.
   */
  async regenerateCaption(
    draftId: string,
    payload: RegenerateCaptionRequest
  ): Promise<AiPostDraft> {
    const { data } = await v4.post<AiPostDraft>(
      `/ai-posts/${draftId}/regenerate-caption`,
      payload
    )
    return data
  },

  /**
   * POST /api/ai-posts/{id}/generate-image
   * Start async image generation job. Returns image_job_id.
   * HTTP 202 Accepted.
   */
  async generateImage(draftId: string): Promise<GenerateImageResponse> {
    const { data } = await v4.post<GenerateImageResponse>(
      `/ai-posts/${draftId}/generate-image`
    )
    return data
  },

  /**
   * GET /api/ai-posts/image-jobs/{job_id}
   * Poll image job status.
   */
  async getImageJob(jobId: string): Promise<ImageJobStatusResponse> {
    const { data } = await v4.get<ImageJobStatusResponse>(
      `/ai-posts/image-jobs/${jobId}`
    )
    return data
  },

  /**
   * POST /api/ai-posts/{id}/regenerate-image
   * Create new image job with optional style hint.
   * HTTP 202 Accepted.
   */
  async regenerateImage(
    draftId: string,
    payload: RegenerateImageRequest
  ): Promise<GenerateImageResponse> {
    const { data } = await v4.post<GenerateImageResponse>(
      `/ai-posts/${draftId}/regenerate-image`,
      payload
    )
    return data
  },

  /**
   * POST /api/ai-posts/{id}/send-to-composer
   * Convert AI draft → Post draft. Returns post_id and draft_id.
   * HTTP 201 Created.
   */
  async sendToComposer(draftId: string): Promise<SendToComposerResponse> {
    const { data } = await v4.post<SendToComposerResponse>(
      `/ai-posts/${draftId}/send-to-composer`
    )
    return data
  },

  /**
   * GET /api/ai-posts?page=&page_size=
   * List user's non-discarded AI post drafts (paginated).
   */
  async list(page = 1, pageSize = 20): Promise<AiPostDraftListResponse> {
    const { data } = await v4.get<AiPostDraftListResponse>('/ai-posts', {
      params: { page, page_size: pageSize },
    })
    return data
  },

  /**
   * DELETE /api/ai-posts/{id}
   * Soft-delete: status → 'discarded'.
   * HTTP 204 No Content.
   */
  async delete(draftId: string): Promise<void> {
    await v4.delete(`/ai-posts/${draftId}`)
  },
}
