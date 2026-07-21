import { api, apiV2 } from './api'
import type {
  GeneratePlanRequest, WeeklyPlan,
  GenerateCaptionsRequest, CaptionsResponse,
  GenerateCaptionRequest, CaptionResponse,
  HashtagRequest, HashtagResponse,
  IdeasResponse,
  ToneAnalyzeRequest, ToneAnalyzeResponse,
} from '@/types/api.types'

export interface PlannedPost {
  post_id: string
  caption: string
  platforms: string[]
  scheduled_at: string | null
  format?: string
  topic?: string
  status: string
}

export interface AgentAction {
  type: 'create_post' | 'create_plan' | 'schedule_post' | 'list_posts' | 'list_schedule' | 'preview_image' | 'delete_post' | 'reschedule_post' | 'none'
  result?: Record<string, unknown> & { posts?: PlannedPost[]; count?: number; image_url?: string; media_url?: string }
  error?: string
}

export interface AgentChatResponse {
  message: { role: string; content: string }
  model: string
  action?: AgentAction
}

export const aiService = {
  async generatePlan(payload: GeneratePlanRequest): Promise<WeeklyPlan> {
    const { data } = await api.post<WeeklyPlan>('/ai/generate-plan', payload)
    return data
  },

  async generateCaptions(payload: GenerateCaptionsRequest): Promise<CaptionsResponse> {
    const { data } = await api.post<CaptionsResponse>('/ai/generate-captions', payload)
    return data
  },

  async generateCaption(payload: GenerateCaptionRequest): Promise<CaptionResponse> {
    const { data } = await api.post<CaptionResponse>('/ai/generate-caption', payload)
    return data
  },

  async suggestIdeas(): Promise<IdeasResponse> {
    const { data } = await api.post<IdeasResponse>('/ai/suggest-ideas')
    return data
  },

  async suggestHashtags(payload: HashtagRequest): Promise<HashtagResponse> {
    const { data } = await apiV2.post<HashtagResponse>('/ai/hashtags', payload)
    return data
  },

  async analyzeTone(payload: ToneAnalyzeRequest): Promise<ToneAnalyzeResponse> {
    const { data } = await apiV2.post<ToneAnalyzeResponse>('/ai/analyze-tone', payload)
    return data
  },

  async chat(messages: { role: string; content: string }[], model?: string): Promise<{ message: { role: string; content: string }; model: string }> {
    const { data } = await apiV2.post('/ai/chat', { messages, model: model || 'qwen2.5:0.5b' })
    return data
  },

  async planChat(messages: { role: string; content: string }[], model?: string): Promise<{ message: { role: string; content: string }; model: string }> {
    const { data } = await apiV2.post('/ai/plan-chat', { messages, model: model || 'qwen2.5:0.5b' })
    return data
  },

  async agentChat(
    messages: { role: string; content: string }[],
    model?: string,
    media?: { media_url?: string; media_type?: string },
    opts?: { content_type?: 'post' | 'story' | 'reel'; want_image?: boolean },
  ): Promise<AgentChatResponse> {
    const { data } = await apiV2.post('/ai/agent-chat', {
      messages,
      model: model || 'qwen2.5:0.5b',
      media_url: media?.media_url,
      media_type: media?.media_type,
      content_type: opts?.content_type ?? 'post',
      want_image: opts?.want_image ?? false,
    })
    return data
  },

  async listModels(): Promise<{ models: string[]; default: string; status: string; provider?: string }> {
    const { data } = await apiV2.get('/ai/models')
    return data
  },
}
