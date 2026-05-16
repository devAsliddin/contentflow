import { api, apiV2 } from './api'
import type { Post } from '@/types/post.types'

export interface StatusTransitionRequest {
  status: string
  scheduled_at?: string | null
}

export interface RecycleRequest {
  scheduled_at: string
}

export interface BulkUploadItem {
  url: string
  filename: string
  media_type: string
  size_bytes: number
  error?: string | null
}

export interface BulkUploadResponse {
  uploaded: number
  failed: number
  items: BulkUploadItem[]
}

export interface PostTemplate {
  id: string
  name: string
  caption: string | null
  platforms: string[]
  platform_options: Record<string, unknown>
  hashtags: string[]
  media_type: string | null
  created_at: string
  updated_at: string
}

export interface TemplateCreateRequest {
  name: string
  caption?: string
  platforms?: string[]
  platform_options?: Record<string, unknown>
  hashtags?: string[]
  media_type?: string
}

export interface MigrationStatusItem {
  account_id: string
  account_name: string
  platform: string
  oauth_migrated: boolean
  oauth_migrated_at: string | null
  needs_reconnect: boolean
}

export interface MigrationStatusResponse {
  total: number
  migrated: number
  needs_reconnect: number
  accounts: MigrationStatusItem[]
}

export interface ABVariant {
  label: string
  caption: string
  char_count: number
  hashtags: string[]
  hook: string
  rationale: string
}

export interface ABCaptionResponse {
  topic: string
  platform: string
  variants: ABVariant[]
  recommendation: string
}

export interface BestTimeResponse {
  hour: number
  day_of_week: number
  day_name: string
  sample_size: number
  score: number
  hourly_distribution: { hour: number; count: number; label: string }[]
  daily_distribution: { day: number; day_name: string; count: number }[]
  recommendation: string
}

export const workflowsService = {
  async transitionStatus(postId: string, payload: StatusTransitionRequest): Promise<Post> {
    const { data } = await apiV2.put<Post>(`/posts/${postId}/status`, payload)
    return data
  },

  async recyclePost(postId: string, payload: RecycleRequest): Promise<Post> {
    const { data } = await apiV2.post<Post>(`/posts/${postId}/recycle`, payload)
    return data
  },

  async bulkUpload(files: File[]): Promise<BulkUploadResponse> {
    const form = new FormData()
    for (const file of files) {
      form.append('files', file)
    }
    const { data } = await apiV2.post<BulkUploadResponse>('/upload/bulk', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  },

  async listTemplates(): Promise<PostTemplate[]> {
    const { data } = await apiV2.get<PostTemplate[]>('/templates')
    return data
  },

  async createTemplate(payload: TemplateCreateRequest): Promise<PostTemplate> {
    const { data } = await apiV2.post<PostTemplate>('/templates', payload)
    return data
  },

  async deleteTemplate(id: string): Promise<void> {
    await apiV2.delete(`/templates/${id}`)
  },

  async getMigrationStatus(): Promise<MigrationStatusResponse> {
    const { data } = await apiV2.get<MigrationStatusResponse>('/accounts/migration-status')
    return data
  },

  async markAllMigrated(): Promise<void> {
    await apiV2.post('/accounts/mark-all-migrated')
  },

  async getABCaptions(payload: {
    topic: string
    platform?: string
    tone?: string
    language?: string
    variants?: number
    existing_caption?: string
  }): Promise<ABCaptionResponse> {
    const { data } = await apiV2.post<ABCaptionResponse>('/ai/ab-captions', payload)
    return data
  },

  async getBestTime(): Promise<BestTimeResponse> {
    const { data } = await apiV2.get<BestTimeResponse>('/analytics/best-time')
    return data
  },

  async downloadReport(): Promise<Blob> {
    const response = await apiV2.post('/analytics/report', {}, { responseType: 'blob' })
    return response.data as Blob
  },
}
