import { api } from './api'
import type { Post, CreatePostRequest, UpdatePostRequest } from '@/types/post.types'

export const postsService = {
  async list(params?: { skip?: number; limit?: number; status?: string }): Promise<Post[]> {
    const { data } = await api.get<Post[]>('/posts', { params })
    return data
  },

  async get(id: string): Promise<Post> {
    const { data } = await api.get<Post>(`/posts/${id}`)
    return data
  },

  async create(payload: CreatePostRequest): Promise<Post> {
    const { data } = await api.post<Post>('/posts', payload)
    return data
  },

  async update(id: string, payload: UpdatePostRequest): Promise<Post> {
    const { data } = await api.put<Post>(`/posts/${id}`, payload)
    return data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/posts/${id}`)
  },

  async triggerNow(id: string): Promise<{ task_id: string; message: string }> {
    const { data } = await api.post(`/scheduler/trigger/${id}`)
    return data
  },
}
