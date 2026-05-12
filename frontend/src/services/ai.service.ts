import axios from 'axios'
import { api } from './api'
import type {
  GeneratePlanRequest, WeeklyPlan,
  GenerateCaptionRequest, CaptionResponse,
  HashtagRequest, HashtagResponse,
  IdeasResponse,
  ToneAnalyzeRequest, ToneAnalyzeResponse,
} from '@/types/api.types'

function getV2BaseUrl() {
  return (import.meta.env.VITE_API_URL || '/api/v1').replace('/v1', '/v2')
}

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

  async suggestHashtags(payload: HashtagRequest): Promise<HashtagResponse> {
    const BASE_URL = getV2BaseUrl()
    const token = localStorage.getItem('access_token')
    const { data } = await axios.post<HashtagResponse>(
      `${BASE_URL}/ai/hashtags`,
      payload,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }
    )
    return data
  },

  async analyzeTone(payload: ToneAnalyzeRequest): Promise<ToneAnalyzeResponse> {
    const BASE_URL = getV2BaseUrl()
    const token = localStorage.getItem('access_token')
    const { data } = await axios.post<ToneAnalyzeResponse>(
      `${BASE_URL}/ai/analyze-tone`,
      payload,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }
    )
    return data
  },
}
