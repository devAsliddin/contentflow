import { api } from './api'
import type { ConnectedAccount } from '@/components/preview/types'

export const previewService = {
  async getConnected(): Promise<ConnectedAccount[]> {
    const { data } = await api.get<ConnectedAccount[]>('/accounts/connected')
    return data
  },
}
