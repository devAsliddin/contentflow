/**
 * V5 — Analysis service: 6 endpoints for AI Analyst feature.
 * Uses the existing `api` axios instance (with auth + token refresh).
 *
 * Base path: /api/v1/accounts/{accountId}/analysis/...
 * (api instance baseURL = /api/v1)
 */

import { api } from './api'
import type {
  AnalysisJob,
  StartAnalysisResponse,
  StatsSummary,
  AccountProfile,
  Recommendations,
  ContentIdeasRequest,
  ContentIdeasResponse,
} from '@/types/analysis.types'

export const analysisService = {
  /**
   * POST /accounts/{id}/analysis/start
   * Enqueue initial analysis. Returns 409 if already in progress.
   */
  async startAnalysis(accountId: string): Promise<StartAnalysisResponse> {
    const { data } = await api.post<StartAnalysisResponse>(
      `/accounts/${accountId}/analysis/start`
    )
    return data
  },

  /**
   * GET /accounts/{id}/analysis/status
   * Returns the most recent job. 404 if no job exists yet.
   */
  async getStatus(accountId: string): Promise<AnalysisJob> {
    const { data } = await api.get<AnalysisJob>(
      `/accounts/${accountId}/analysis/status`
    )
    return data
  },

  /**
   * GET /accounts/{id}/analysis/stats
   * Returns statistical summary (AI-free). 404 if no data yet.
   */
  async getStats(accountId: string): Promise<StatsSummary> {
    const { data } = await api.get<StatsSummary>(
      `/accounts/${accountId}/analysis/stats`
    )
    return data
  },

  /**
   * GET /accounts/{id}/analysis/profile
   * Returns the latest ready account profile (AI-generated). 404 if not ready.
   */
  async getProfile(accountId: string): Promise<AccountProfile> {
    const { data } = await api.get<AccountProfile>(
      `/accounts/${accountId}/analysis/profile`
    )
    return data
  },

  /**
   * GET /accounts/{id}/analysis/recommendations
   * Returns the latest weekly recommendations. 404 if not ready.
   */
  async getRecommendations(accountId: string): Promise<Recommendations> {
    const { data } = await api.get<Recommendations>(
      `/accounts/${accountId}/analysis/recommendations`
    )
    return data
  },

  /**
   * POST /accounts/{id}/analysis/content-ideas
   * Generate content ideas synchronously. Rate limited: 10/hour per user.
   * Returns 429 when limit exceeded.
   */
  async generateContentIdeas(
    accountId: string,
    payload: ContentIdeasRequest
  ): Promise<ContentIdeasResponse> {
    const { data } = await api.post<ContentIdeasResponse>(
      `/accounts/${accountId}/analysis/content-ideas`,
      payload
    )
    return data
  },
}
