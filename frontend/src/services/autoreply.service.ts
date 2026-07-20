import axios from 'axios'
import type {
  AutoReplyRule,
  AutoReplyRuleInput,
  AutoReplyLog,
} from '@/types/autoreply.types'

// V4 routes live at /api/... (not /api/v1 or /api/v2) so they match the Meta
// app config (OAuth redirect + webhook URLs).
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

export const autoreplyService = {
  // Full-page redirect into the Instagram OAuth flow. The JWT travels as a query
  // param because a top-level navigation can't carry an Authorization header.
  instagramOAuthStartUrl(): string {
    const token = localStorage.getItem('access_token') || ''
    return `${apiBase()}/accounts/instagram/oauth/start?token=${encodeURIComponent(token)}`
  },

  async listRules(accountId: string): Promise<AutoReplyRule[]> {
    const { data } = await v4.get<AutoReplyRule[]>(`/accounts/${accountId}/autoreply-rules`)
    return data
  },

  async createRule(accountId: string, payload: AutoReplyRuleInput): Promise<AutoReplyRule> {
    const { data } = await v4.post<AutoReplyRule>(`/accounts/${accountId}/autoreply-rules`, payload)
    return data
  },

  async updateRule(ruleId: string, payload: Partial<AutoReplyRuleInput>): Promise<AutoReplyRule> {
    const { data } = await v4.patch<AutoReplyRule>(`/autoreply-rules/${ruleId}`, payload)
    return data
  },

  async deleteRule(ruleId: string): Promise<void> {
    await v4.delete(`/autoreply-rules/${ruleId}`)
  },

  async listLogs(accountId: string, limit = 50): Promise<AutoReplyLog[]> {
    const { data } = await v4.get<AutoReplyLog[]>(`/accounts/${accountId}/autoreply-logs`, {
      params: { limit },
    })
    return data
  },
}
