import { api } from './api'
import type { Post, CreatePostRequest, UpdatePostRequest, PostReview } from '@/types/post.types'

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

  async review(payload: CreatePostRequest): Promise<PostReview> {
    const { data } = await api.post<PostReview>('/posts/review', payload)
    return data
  },

  async update(id: string, payload: UpdatePostRequest): Promise<Post> {
    const { data } = await api.put<Post>(`/posts/${id}`, payload)
    return data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/posts/${id}`)
  },

  async triggerNow(id: string): Promise<{
    task_id: string | null
    message: string
    status: 'published' | 'failed'
    errors: string[]
    results: Array<{
      platform: string
      account_id: string | null
      account_name: string | null
      status: 'success' | 'failed'
      external_id?: string | null
      error?: string
    }>
  }> {
    const { data } = await api.post(`/scheduler/trigger/${id}`)
    return data
  },
}
