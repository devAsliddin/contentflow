export type ContentType = 'post' | 'story' | 'reel'

export interface ConnectedAccount {
  platform: string
  username: string
  avatar_url: string | null
}

export interface PreviewProps {
  mediaUrl?: string
  mediaType?: 'image' | 'video'
  caption?: string
  account?: ConnectedAccount
}

export const CONTENT_TYPE_ASPECT: Record<ContentType, string> = {
  post: '1 / 1',
  story: '9 / 16',
  reel: '9 / 16',
}

// Alternate square vs portrait for post
export type PostAspect = '1:1' | '4:5'
