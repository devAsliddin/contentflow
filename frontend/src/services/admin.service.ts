import { api } from './api'

export interface AdminStats {
  total_users: number
  active_users: number
  total_posts: number
  total_accounts: number
}

export interface AdminUser {
  id: string
  email: string
  full_name: string | null
  is_active: boolean
  is_admin: boolean
  created_at: string
  updated_at: string | null
}

export interface AdminUserUpdate {
  is_active?: boolean
  is_admin?: boolean
  full_name?: string
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
}
