import { create } from 'zustand'
import type { Post, PostStatus } from '@/types/post.types'

interface PostsState {
  posts: Post[]
  selectedStatus: PostStatus | 'all'
  setPosts: (posts: Post[]) => void
  addPost: (post: Post) => void
  updatePost: (id: string, updates: Partial<Post>) => void
  removePost: (id: string) => void
  setFilter: (status: PostStatus | 'all') => void
  filteredPosts: () => Post[]
}

export const usePostsStore = create<PostsState>((set, get) => ({
  posts: [],
  selectedStatus: 'all',

  setPosts: (posts) => set({ posts }),

  addPost: (post) => set((state) => ({ posts: [post, ...state.posts] })),

  updatePost: (id, updates) =>
    set((state) => ({
      posts: state.posts.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    })),

  removePost: (id) =>
    set((state) => ({ posts: state.posts.filter((p) => p.id !== id) })),

  setFilter: (status) => set({ selectedStatus: status }),

  filteredPosts: () => {
    const { posts, selectedStatus } = get()
    if (selectedStatus === 'all') return posts
    return posts.filter((p) => p.status === selectedStatus)
  },
}))
