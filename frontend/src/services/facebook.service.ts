/**
 * V6 — Facebook service
 * Backend: /api/accounts/facebook/...
 *
 * oauth/start uses window.location (JWT via query param — same as Instagram V4 pattern).
 * Pages list and select-page use the authenticated `v4` axios instance.
 */

import axios from 'axios'
import type {
  FacebookPagesSessionResponse,
  SelectPageResponse,
} from '@/types/facebook.types'

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

export const facebookService = {
  /**
   * Build the OAuth start URL and navigate to it (full page redirect).
   * JWT is passed as query param because window.location navigation
   * can't carry an Authorization header.
   */
  oauthStartUrl(): string {
    const token = localStorage.getItem('access_token') || ''
    return `${apiBase()}/accounts/facebook/oauth/start?token=${encodeURIComponent(token)}`
  },

  /**
   * GET /accounts/facebook/pages?session_key=…
   * Returns page metadata (id, name, picture) from Redis session.
   * Access tokens are NEVER included in the response.
   */
  async getPages(sessionKey: string): Promise<FacebookPagesSessionResponse> {
    const { data } = await v4.get<FacebookPagesSessionResponse>(
      `/accounts/facebook/pages`,
      { params: { session_key: sessionKey } }
    )
    return data
  },

  /**
   * POST /accounts/facebook/select-page
   * Attach the chosen Facebook page.
   */
  async selectPage(sessionKey: string, pageId: string): Promise<SelectPageResponse> {
    const { data } = await v4.post<SelectPageResponse>(
      `/accounts/facebook/select-page`,
      { session_key: sessionKey, page_id: pageId }
    )
    return data
  },
}
