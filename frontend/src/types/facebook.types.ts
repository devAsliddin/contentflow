/**
 * V6 — Facebook integration types
 * Matches backend: app/routers/facebook_connect.py
 */

export interface FacebookPage {
  id: string
  name: string
  picture?: {
    data?: {
      url?: string
    }
  } | null
}

export interface FacebookPagesSessionResponse {
  pages: FacebookPage[]
}

export interface SelectPageBody {
  session_key: string
  page_id: string
}

export interface SelectPageResponse {
  status: string
  page_name: string
}

/** Extended Account fields for Facebook accounts */
export interface FacebookAccountFields {
  fb_page_id?: string | null
  fb_page_name?: string | null
  fb_user_id?: string | null
  fb_webhook_subscribed?: boolean | null
  token_status?: 'active' | 'expired' | null
}
