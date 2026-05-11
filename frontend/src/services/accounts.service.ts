import { api } from './api'
import type { Account, ConnectAccountRequest } from '@/types/account.types'

export const accountsService = {
  async list(platform?: string): Promise<Account[]> {
    const { data } = await api.get<Account[]>('/accounts', { params: platform ? { platform } : undefined })
    return data
  },

  async connect(payload: ConnectAccountRequest): Promise<Account> {
    const { data } = await api.post<Account>('/accounts', payload)
    return data
  },

  async disconnect(id: string): Promise<void> {
    await api.delete(`/accounts/${id}`)
  },

  async verify(id: string): Promise<{ valid: boolean; message: string }> {
    const { data } = await api.post(`/accounts/${id}/verify`)
    return data
  },
}
