import axios from 'axios'
import { api } from './api'
import type { Account, AddTelegramChannelRequest, ConnectAccountRequest, TelegramBotSettings } from '@/types/account.types'

function getV2BaseUrl() {
  return (import.meta.env.VITE_API_URL || '/api/v1').replace('/v1', '/v2')
}

export const accountsService = {
  async list(platform?: string): Promise<Account[]> {
    const { data } = await api.get<Account[]>('/accounts', { params: platform ? { platform } : undefined })
    return data
  },

  async connect(payload: ConnectAccountRequest): Promise<Account> {
    const { data } = await api.post<Account>('/accounts', payload)
    return data
  },

  async connectInstagram(payload: { username: string; password: string; account_name?: string }): Promise<Account> {
    const { data } = await api.post<Account>('/accounts/instagram/login', payload)
    return data
  },

  async disconnect(id: string): Promise<void> {
    await api.delete(`/accounts/${id}`)
  },

  async verify(id: string): Promise<{ valid: boolean; message: string }> {
    const { data } = await api.post(`/accounts/${id}/verify`)
    return data
  },

  async rename(id: string, account_name: string): Promise<Account> {
    const { data } = await api.patch<Account>(`/accounts/${id}`, { account_name })
    return data
  },

  async telegramValidateToken(bot_token: string): Promise<{
    valid: boolean
    bot_id: number
    bot_name: string
    bot_username: string
  }> {
    const { data } = await api.post('/accounts/telegram/validate-token', { bot_token })
    return data
  },

  async telegramSettings(accountId: string): Promise<TelegramBotSettings> {
    const { data } = await api.get<TelegramBotSettings>(`/accounts/telegram/${accountId}/settings`)
    return data
  },

  async telegramAddChannel(accountId: string, payload: AddTelegramChannelRequest): Promise<TelegramBotSettings> {
    const { data } = await api.post<TelegramBotSettings>(`/accounts/telegram/${accountId}/channels`, payload)
    return data
  },

  async telegramUpdateToken(accountId: string, bot_token: string): Promise<TelegramBotSettings> {
    const { data } = await api.patch<TelegramBotSettings>(`/accounts/telegram/${accountId}/token`, { bot_token })
    return data
  },

  async tiktokOAuthInit(): Promise<{ url: string }> {
    const BASE_URL = getV2BaseUrl()
    const token = localStorage.getItem('access_token')
    const { data } = await axios.get<{ url: string }>(`${BASE_URL}/oauth/tiktok/init`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    return data
  },
}
