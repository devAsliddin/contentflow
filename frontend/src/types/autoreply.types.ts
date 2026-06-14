export type AutoReplyTarget = 'dm' | 'comment'
export type AutoReplyMatchType = 'contains' | 'exact' | 'starts_with' | 'any'
export type CommentAction = 'reply_public' | 'reply_private' | 'both'
// V6: reply_mode — 'template' = tayyor matn, 'ai' = AI javob
export type ReplyMode = 'template' | 'ai'

export type AutoReplyStatus =
  | 'sent'
  | 'skipped_no_match'
  | 'skipped_rate_limit'
  | 'skipped_24h'
  | 'skipped_self'
  | 'failed'

export interface AutoReplyRule {
  id: string
  account_id: string
  user_id: string
  name: string
  target: AutoReplyTarget
  match_type: AutoReplyMatchType
  keywords: string[]
  case_sensitive: boolean
  reply_text: string
  comment_action: CommentAction | null
  priority: number
  is_active: boolean
  created_at: string
  updated_at: string | null
  // V6 fields
  platform?: string          // 'instagram' | 'facebook', default 'instagram'
  reply_mode?: ReplyMode     // 'template' | 'ai', default 'template'
  ai_context?: string | null
}

export interface AutoReplyRuleInput {
  name: string
  target: AutoReplyTarget
  match_type: AutoReplyMatchType
  keywords: string[]
  case_sensitive: boolean
  reply_text: string
  comment_action?: CommentAction | null
  priority: number
  is_active: boolean
  // V6 fields
  platform?: string
  reply_mode?: ReplyMode
  ai_context?: string | null
}

export interface AutoReplyLog {
  id: string
  account_id: string
  rule_id: string | null
  event_type: AutoReplyTarget
  ig_object_id: string
  sender_ig_id: string | null
  incoming_text: string | null
  matched_keyword: string | null
  reply_text: string | null
  status: AutoReplyStatus
  error_detail: string | null
  created_at: string
  // V6 fields
  platform?: string | null
  reply_mode?: ReplyMode | null
}
