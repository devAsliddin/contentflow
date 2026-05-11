import type { Platform } from './post.types'

export interface Account {
  id: string
  user_id: string
  platform: Platform
  account_name: string
  is_active: boolean
  created_at: string
}

export interface AccountCredentials {
  // Telegram
  bot_token?: string
  channel_id?: string
  // Instagram / TikTok
  access_token?: string
  account_id?: string
  open_id?: string
}

export interface ConnectAccountRequest {
  platform: Platform
  account_name: string
  credentials: AccountCredentials
}
