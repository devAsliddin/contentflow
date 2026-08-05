import { api } from './api'

export interface NewsItem {
  title: string
  summary: string
  source: string
  url: string
  published: string | null
}

export interface NewsCategory {
  key: string
  label: string
}

export const newsService = {
  async categories(): Promise<NewsCategory[]> {
    const { data } = await api.get<NewsCategory[]>('/news/categories')
    return data
  },

  async list(params: { topic?: string; category?: string; limit?: number }): Promise<NewsItem[]> {
    const { data } = await api.get<{ items: NewsItem[] }>('/news', { params })
    return data.items
  },

  async generatePost(item: NewsItem, platform = 'instagram', language = 'uz'): Promise<string> {
    const { data } = await api.post<{ caption: string }>('/news/generate-post', {
      title: item.title,
      summary: item.summary,
      source: item.source,
      url: item.url,
      platform,
      language,
    })
    return data.caption
  },
}
