export type AutoReplyTarget = 'dm' | 'comment'
export type AutoReplyMatchType = 'contains' | 'exact' | 'starts_with' | 'any'
export type CommentAction = 'reply_public' | 'reply_private' | 'both'

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
}
