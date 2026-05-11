import { api } from './api'
import type {
  GeneratePlanRequest, WeeklyPlan,
  GenerateCaptionRequest, CaptionResponse,
  IdeasResponse,
} from '@/types/api.types'

export const aiService = {
  async generatePlan(payload: GeneratePlanRequest): Promise<WeeklyPlan> {
    const { data } = await api.post<WeeklyPlan>('/ai/generate-plan', payload)
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
}
