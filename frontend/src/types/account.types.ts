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

export interface TelegramChannel {
  id: string
  account_name: string
  channel_id: string
  created_at: string
}

export interface TelegramBotSettings {
  bot_name: string | null
  bot_username: string | null
  bot_valid: boolean
  channels: TelegramChannel[]
  max_channels: number
  can_add: boolean
}

export interface AddTelegramChannelRequest {
  channel_id: string
  label?: string
}
