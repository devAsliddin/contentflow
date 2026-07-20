import { api } from './api'

export interface AdminStats {
  total_users: number
  active_users: number
  total_posts: number
  total_accounts: number
  total_credits_used: number
}

export interface AdminUser {
  id: string
  email: string
  full_name: string | null
  is_active: boolean
  is_admin: boolean
  ai_credits: number
  ai_credits_limit: number
  created_at: string
  updated_at: string | null
}

export interface AdminUserUpdate {
  is_active?: boolean
  is_admin?: boolean
  full_name?: string
  ai_credits?: number
  ai_credits_limit?: number
}

export interface AdminCreditsUpdate {
  amount?: number   // +add / -remove
  set_to?: number   // absolute balance
  limit?: number    // absolute limit
}

export const adminService = {
  getStats: async (): Promise<AdminStats> => {
    const { data } = await api.get('/admin/stats')
    return data
  },

  getUsers: async (skip = 0, limit = 50): Promise<AdminUser[]> => {
    const { data } = await api.get('/admin/users', { params: { skip, limit } })
    return data
  },

  updateUser: async (userId: string, payload: AdminUserUpdate): Promise<AdminUser> => {
    const { data } = await api.put(`/admin/users/${userId}`, payload)
    return data
  },

  deleteUser: async (userId: string): Promise<void> => {
    await api.delete(`/admin/users/${userId}`)
  },

  adjustCredits: async (userId: string, payload: AdminCreditsUpdate): Promise<AdminUser> => {
    const { data } = await api.post(`/admin/users/${userId}/credits`, payload)
    return data
  },
}
