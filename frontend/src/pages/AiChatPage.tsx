import { useState, useRef, useEffect, type ReactNode } from 'react'
import { Send, Bot, User, Sparkles, ChevronDown, Loader2, AlertCircle, RefreshCw, Zap, CheckCircle, Calendar, ExternalLink, LayoutGrid, Paperclip, X, Image as ImageIcon, Film, Plus, Trash2, MessageSquare, Smartphone } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { aiService } from '@/services/ai.service'
import { api } from '@/services/api'
import type { AgentAction, PlannedPost } from '@/services/ai.service'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  action?: AgentAction
}

interface ChatSession {
  id: string
  title: string
  messages: Message[]
  updatedAt: number
}

type ContentType = 'post' | 'story' | 'reel'

const CONTENT_TYPES: { id: ContentType; label: string; icon: typeof LayoutGrid }[] = [
  { id: 'post', label: 'Post', icon: LayoutGrid },
  { id: 'story', label: 'Story', icon: Smartphone },
  { id: 'reel', label: 'Reels', icon: Film },
]

const QUICK_PROMPTS_CHAT = [
  'Instagram uchun viral post yozing',
  'TikTok uchun hook yozing',
  'Haftaga content reja tuzing',
  'Hashtag tavsiyalar bering',
  'Kontent strategiyasi haqida maslahat bering',
]

const QUICK_PROMPTS_AGENT = [
  'Keyingi 7 kun uchun to\'liq SMM reja tuz va kalendarga qo\'sh',
  'Instagram uchun haftasiga 5 post rejasi tuz va schedulla',
  'Telegram + Instagram uchun haftalik content plan yaratib, barcha postlarni qo\'sh',
  'Mening jadvalimni ko\'rib, bo\'sh kunlarga post reja qiling',
  'Ertaga eng yaxshi vaqtda Instagram post yarating: "Yangi mahsulotimiz chiqdi!"',
]

const PLATFORM_COLORS: Record<string, string> = {
  instagram: '#E1306C',
  tiktok: '#010101',
  telegram: '#2AABEE',
}

// ─── Lightweight markdown renderer ─────────────────────────────────────────────
// The agent replies with GFM markdown (weekly-plan tables, **bold**, headings,
// bullet lists, `---` rules). The chat bubble used to show this raw, so a plan
// table looked like "| Kun | Platforma | ...". This renders it properly without
// pulling in a markdown dependency.

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const regex = /\*\*([^*]+)\*\*|`([^`]+)`/g
  let last = 0
  let key = 0
  let m: RegExpExecArray | null
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    if (m[1] !== undefined) {
      nodes.push(
        <strong key={key++} className="font-semibold text-ink">
          {m[1]}
        </strong>,
      )
    } else if (m[2] !== undefined) {
      nodes.push(
        <code key={key++} className="rounded bg-black/20 px-1 py-0.5 font-mono text-[0.85em]">
          {m[2]}
        </code>,
      )
    }
    last = m.index + m[0].length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

function splitRow(row: string): string[] {
  return row
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim())
}

const isTableSep = (s: string) => s.includes('-') && /^\s*\|?[\s:|-]+\|?\s*$/.test(s)

function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const blocks: ReactNode[] = []
  let i = 0
  let key = 0

  while (i < lines.length) {
    const line = lines[i]

    // Table: a "| … |" header row followed by a "|---|---|" separator.
    if (line.trim().startsWith('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const header = splitRow(line)
      i += 2
      const rows: string[][] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(splitRow(lines[i]))
        i++
      }
      blocks.push(
        <div key={key++} className="my-2 overflow-x-auto">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr>
                {header.map((h, hi) => (
                  <th
                    key={hi}
                    className="border border-line bg-surface2 px-2 py-1 text-left font-semibold text-ink"
                  >
                    {renderInline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, ci) => (
                    <td key={ci} className="border border-line px-2 py-1 align-top text-ink/80">
                      {renderInline(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      )
      continue
    }

    // Heading (#, ##, ###…)
    const h = line.match(/^(#{1,6})\s+(.*)$/)
    if (h) {
      const lvl = h[1].length
      blocks.push(
        <div
          key={key++}
          className={`font-semibold text-ink ${lvl <= 2 ? 'mt-3 text-sm' : 'mt-2 text-[13px]'}`}
        >
          {renderInline(h[2])}
        </div>,
      )
      i++
      continue
    }

    // Horizontal rule
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      blocks.push(<hr key={key++} className="my-2 border-line" />)
      i++
      continue
    }

    // Bullet list
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''))
        i++
      }
      blocks.push(
        <ul key={key++} className="my-1 list-disc space-y-0.5 pl-4">
          {items.map((it, ii) => (
            <li key={ii}>{renderInline(it)}</li>
          ))}
        </ul>,
      )
      continue
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''))
        i++
      }
      blocks.push(
        <ol key={key++} className="my-1 list-decimal space-y-0.5 pl-4">
          {items.map((it, ii) => (
            <li key={ii}>{renderInline(it)}</li>
          ))}
        </ol>,
      )
      continue
    }

    // Blank line
    if (line.trim() === '') {
      i++
      continue
    }

    // Paragraph: gather consecutive plain lines.
    const para: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trim().startsWith('|') &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^(#{1,6})\s+/.test(lines[i]) &&
      !/^\s*([-*_])\1{2,}\s*$/.test(lines[i])
    ) {
      para.push(lines[i])
      i++
    }
    blocks.push(
      <p key={key++} className="my-1 leading-relaxed">
        {para.map((p, pi) => (
          <span key={pi}>
            {renderInline(p)}
            {pi < para.length - 1 && <br />}
          </span>
        ))}
      </p>,
    )
  }

  return <div className="space-y-0.5">{blocks}</div>
}

function PlatformDot({ platform }: { platform: string }) {
  const color = PLATFORM_COLORS[platform.toLowerCase()] || '#888'
  return (
    <span
      className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
      style={{ background: color }}
      title={platform}
    />
  )
}

function PlanPostRow({ post, idx }: { post: PlannedPost; idx: number }) {
  const date = post.scheduled_at ? post.scheduled_at.replace('T', ' ').slice(0, 16) : '—'
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-white/5 last:border-0">
      <span className="text-faint tnum font-mono text-[10px] w-3 shrink-0 mt-0.5">{idx + 1}</span>
      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
        <div className="text-ink/80 text-[11px] leading-snug truncate">
          {post.caption.slice(0, 55)}{post.caption.length > 55 ? '…' : ''}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-faint">
          <span className="flex items-center gap-1">
            <Calendar size={8} />
            {date}
          </span>
          {post.format && <span className="capitalize">{post.format}</span>}
          <span className="flex items-center gap-0.5">
            {(post.platforms || []).map((p) => (
              <PlatformDot key={p} platform={p} />
            ))}
            {(post.platforms || []).join(', ')}
          </span>
        </div>
      </div>
    </div>
  )
}

function ActionCard({ action, onViewCalendar }: { action: AgentAction; onViewCalendar?: () => void }) {
  if (!action || action.type === 'none') return null

  if (action.error) {
    return (
      <div className="mt-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
        Amal bajarilmadi: {action.error}
      </div>
    )
  }

  if (action.type === 'preview_image' && action.result) {
    const imageUrl = action.result.image_url as string | undefined
    return (
      <div className="mt-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 p-2 text-xs space-y-2 max-w-xs">
        <div className="flex items-center gap-1.5 font-medium text-indigo-400">
          <ImageIcon size={12} />
          Rasm preview
        </div>
        {imageUrl && (
          <img
            src={imageUrl}
            alt="AI rasm preview"
            className="w-full rounded-md border border-line object-cover"
          />
        )}
      </div>
    )
  }

  if (action.type === 'create_post' && action.result) {
    const caption = action.result.caption as string | undefined
    const platforms = action.result.platforms as string[] | undefined
    const scheduled_at = action.result.scheduled_at as string | undefined
    const status = action.result.status as string | undefined
    const contentType = action.result.content_type as string | undefined
    const imageGenerated = action.result.image_generated as boolean | undefined
    const mediaUrl = action.result.media_url as string | undefined
    return (
      <div className="mt-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300 space-y-1 max-w-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-medium text-emerald-400">
            <CheckCircle size={12} />
            Post yaratildi va kalendarga qo'shildi
          </div>
          {onViewCalendar && (
            <button
              onClick={onViewCalendar}
              className="flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 transition"
            >
              <ExternalLink size={9} />
              Kalendarda ko'rish
            </button>
          )}
        </div>
        {mediaUrl && (
          <img
            src={mediaUrl}
            alt="Post rasmi"
            className="w-full rounded-md border border-emerald-500/20 object-cover"
          />
        )}
        {caption && (
          <div className="text-ink/70">"{caption}"</div>
        )}
        <div className="flex items-center gap-3 text-faint flex-wrap">
          {contentType && <span className="capitalize">{contentType}</span>}
          {imageGenerated && (
            <span className="flex items-center gap-1 text-indigo-300">
              <ImageIcon size={10} /> AI rasm
            </span>
          )}
          {platforms && (
            <span className="flex items-center gap-1">
              {platforms.map((p) => <PlatformDot key={p} platform={p} />)}
              {platforms.join(', ')}
            </span>
          )}
          {scheduled_at && (
            <span className="flex items-center gap-1">
              <Calendar size={10} />
              {scheduled_at.replace('T', ' ').slice(0, 16)}
            </span>
          )}
          {status && <span className="capitalize">{status}</span>}
        </div>
      </div>
    )
  }

  if (action.type === 'create_plan' && action.result) {
    const posts = action.result.posts as PlannedPost[] | undefined
    const count = action.result.count as number | undefined
    return (
      <div className="mt-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 pt-2 pb-3 text-xs space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-medium text-indigo-400">
            <LayoutGrid size={12} />
            <span>{count ?? posts?.length ?? 0} ta post kalendarga qo'shildi</span>
          </div>
          {onViewCalendar && (
            <button
              onClick={onViewCalendar}
              className="flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 border border-indigo-500/40 rounded px-2 py-0.5 transition hover:bg-indigo-500/10"
            >
              <Calendar size={9} />
              Kalendarda ko'rish
            </button>
          )}
        </div>
        {posts && posts.length > 0 && (
          <div className="mt-1 max-h-48 overflow-y-auto">
            {posts.map((p, i) => (
              <PlanPostRow key={p.post_id} post={p} idx={i} />
            ))}
          </div>
        )}
      </div>
    )
  }

  if (action.type === 'delete_post' && action.result) {
    const caption = action.result.caption as string | undefined
    return (
      <div className="mt-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300 flex items-center gap-1.5">
        <Trash2 size={12} />
        <span>Post o'chirildi{caption ? `: "${caption}"` : ''}</span>
      </div>
    )
  }

  if (action.type === 'reschedule_post' && action.result) {
    const caption = action.result.caption as string | undefined
    const scheduledAt = action.result.scheduled_at as string | undefined
    return (
      <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300 space-y-1">
        <div className="flex items-center gap-1.5 font-medium">
          <Calendar size={12} />
          <span>Post vaqti o'zgartirildi</span>
        </div>
        {caption && <div className="text-ink/70">"{caption}"</div>}
        {scheduledAt && (
          <div className="flex items-center gap-1 text-faint">
            <Calendar size={10} />
            {scheduledAt}
          </div>
        )}
      </div>
    )
  }

  return null
}

function MessageBubble({ msg, onViewCalendar }: { msg: Message; onViewCalendar: () => void }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div
        className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center text-white ${
          isUser ? 'bg-indigo-500' : 'bg-surface2 border border-line'
        }`}
      >
        {isUser ? <User size={14} /> : <Bot size={14} className="text-indigo-400" />}
      </div>
      <div className="max-w-[75%] flex flex-col">
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? 'bg-indigo-500 text-white rounded-tr-sm whitespace-pre-wrap'
              : 'bg-surface border border-line text-ink rounded-tl-sm'
          }`}
        >
          {isUser ? msg.content : <Markdown text={msg.content} />}
        </div>
        {msg.action && <ActionCard action={msg.action} onViewCalendar={onViewCalendar} />}
      </div>
    </div>
  )
}

// ─── Multi-session chat history (localStorage) ──────────────────────────────────

const SESSIONS_KEY = 'cf_ai_chat_sessions'
const LEGACY_HISTORY_KEY = 'cf_ai_chat_history'

function newSession(): ChatSession {
  return { id: crypto.randomUUID(), title: 'Yangi suhbat', messages: [], updatedAt: Date.now() }
}

function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as ChatSession[]
      if (Array.isArray(parsed) && parsed.length) return parsed
    }
    // Migrate the old single-conversation history, if any.
    const legacy = localStorage.getItem(LEGACY_HISTORY_KEY)
    if (legacy) {
      const msgs = JSON.parse(legacy) as Message[]
      if (Array.isArray(msgs) && msgs.length) {
        const s = newSession()
        s.messages = msgs
        s.title = deriveTitle(msgs)
        localStorage.removeItem(LEGACY_HISTORY_KEY)
        return [s]
      }
    }
  } catch {
    /* ignore corrupt storage */
  }
  return [newSession()]
}

function deriveTitle(messages: Message[]): string {
  const firstUser = messages.find((m) => m.role === 'user')
  if (!firstUser) return 'Yangi suhbat'
  const t = firstUser.content.trim().replace(/\s+/g, ' ')
  return t.length > 38 ? t.slice(0, 38) + '…' : t || 'Yangi suhbat'
}

export default function AiChatPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Multi-session chat history.
  const [sessions, setSessions] = useState<ChatSession[]>(loadSessions)
  const [currentId, setCurrentId] = useState<string>(() => sessions[0].id)
  const current = sessions.find((s) => s.id === currentId) ?? sessions[0]
  const messages = current.messages

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedModel, setSelectedModel] = useState('qwen2.5:0.5b')
  const [modelDropOpen, setModelDropOpen] = useState(false)
  const [agentMode, setAgentMode] = useState(true)
  const [contentType, setContentType] = useState<ContentType>('post')
  const [wantImage, setWantImage] = useState(false)
  const [attachedMedia, setAttachedMedia] = useState<{ url: string; type: string; name: string } | null>(null)
  const [uploadingMedia, setUploadingMedia] = useState(false)
  // Last AI-generated preview image — reused (not regenerated) if the user
  // confirms the post right after seeing it, mirroring how a user-attached
  // file is carried into the next message.
  const [pendingPreviewMedia, setPendingPreviewMedia] = useState<{ url: string; type: string } | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Persist sessions whenever they change.
  useEffect(() => {
    try {
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions))
    } catch {
      /* storage unavailable — ignore */
    }
  }, [sessions])

  // Update the current session's messages (and its title + timestamp).
  function setMessages(updater: (prev: Message[]) => Message[]) {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== currentId) return s
        const nextMsgs = updater(s.messages)
        return {
          ...s,
          messages: nextMsgs,
          title: s.title === 'Yangi suhbat' || s.title === '' ? deriveTitle(nextMsgs) : s.title,
          updatedAt: Date.now(),
        }
      })
    )
  }

  function startNewChat() {
    const s = newSession()
    setSessions((prev) => [s, ...prev])
    setCurrentId(s.id)
    setInput('')
    setAttachedMedia(null)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function deleteSession(id: string) {
    setSessions((prev) => {
      const remaining = prev.filter((s) => s.id !== id)
      const next = remaining.length ? remaining : [newSession()]
      if (id === currentId) setCurrentId(next[0].id)
      return next
    })
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (e.target) e.target.value = ''  // allow re-selecting the same file
    if (!file) return
    const isImage = file.type.startsWith('image/')
    const isVideo = file.type.startsWith('video/')
    if (!isImage && !isVideo) {
      toast.error('Faqat rasm yoki video yuklash mumkin')
      return
    }
    setUploadingMedia(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await api.post('/upload/media', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setAttachedMedia({ url: data.url, type: data.media_type, name: file.name })
      toast.success('Fayl biriktirildi — endi qaysi kunga rejalashtirishni yozing')
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Yuklashda xato')
    } finally {
      setUploadingMedia(false)
    }
  }

  const { data: modelsData, isError: modelsError } = useQuery({
    queryKey: ['ollama-models'],
    queryFn: () => aiService.listModels(),
    retry: false,
    staleTime: 60_000,
  })

  useEffect(() => {
    // Use whatever model the backend actually serves (OpenRouter, Grok, or Ollama).
    if (modelsData?.default) setSelectedModel(modelsData.default)
  }, [modelsData])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const ollamaOnline = modelsData?.status === 'ok'

  async function sendMessage(text?: string) {
    const content = (text ?? input).trim()
    // Allow sending with just an attached file (e.g. "schedule for Monday 18:00").
    if ((!content && !attachedMedia) || loading) return

    // Prefer an explicit attachment; otherwise carry the last previewed AI
    // image into this turn so confirming a preview reuses it instead of
    // generating a fresh (different) one.
    const mediaForSend = attachedMedia ?? (pendingPreviewMedia ? { ...pendingPreviewMedia, name: 'AI rasm' } : null)
    const displayContent = content || (mediaForSend ? `📎 ${mediaForSend.name}` : '')
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: displayContent }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setAttachedMedia(null)
    setPendingPreviewMedia(null)
    setLoading(true)

    try {
      const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }))

      if (agentMode) {
        const result = await aiService.agentChat(
          history,
          selectedModel,
          mediaForSend ? { media_url: mediaForSend.url, media_type: mediaForSend.type } : undefined,
          { content_type: contentType, want_image: wantImage },
        )
        const assistantMsg: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: result.message.content,
          action: result.action ?? undefined,
        }
        setMessages((prev) => [...prev, assistantMsg])
        if (result.action?.type === 'create_post' && !result.action.error) {
          toast.success('Post muvaffaqiyatli yaratildi va kalendarga qo\'shildi!')
          queryClient.invalidateQueries({ queryKey: ['posts', 'calendar'] })
        }
        if (result.action?.type === 'create_plan' && !result.action.error) {
          const count = result.action.result?.count ?? 0
          toast.success(`${count} ta post yaratildi va kalendarga qo'shildi!`)
          queryClient.invalidateQueries({ queryKey: ['posts', 'calendar'] })
        }
        if (result.action?.type === 'preview_image') {
          const imageUrl = result.action.result?.image_url as string | undefined
          if (!result.action.error && imageUrl) {
            setPendingPreviewMedia({ url: imageUrl, type: 'image' })
          } else {
            toast.error('Rasmni generatsiya qilib bo\'lmadi')
          }
        }
        if (result.action?.type === 'delete_post' && !result.action.error) {
          toast.success('Post o\'chirildi')
          queryClient.invalidateQueries({ queryKey: ['posts', 'calendar'] })
        }
        if (result.action?.type === 'reschedule_post' && !result.action.error) {
          toast.success('Post vaqti o\'zgartirildi')
          queryClient.invalidateQueries({ queryKey: ['posts', 'calendar'] })
        }
      } else {
        const result = await aiService.chat(history, selectedModel)
        const assistantMsg: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: result.message.content,
        }
        setMessages((prev) => [...prev, assistantMsg])
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'AI javob bermadi'
      toast.error(detail)
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `Xato: ${detail}`,
        },
      ])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const models = modelsData?.models ?? [selectedModel]
  const quickPrompts = agentMode ? QUICK_PROMPTS_AGENT : QUICK_PROMPTS_CHAT
  // Label that reflects the AI provider the backend actually uses.
  const provider = modelsData?.provider
  const providerLabel =
    provider === 'openrouter' ? 'Cloud · OpenRouter'
    : provider === 'grok' ? 'Cloud · Grok'
    : provider === 'ollama' ? 'Local · Ollama'
    : 'AI'

  const sortedSessions = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt)

  return (
    <div className="page-in flex h-[calc(100vh-64px)] max-w-[1180px] mx-auto gap-4 px-4 py-4">
      {/* ── Sessions sidebar ──────────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 rounded-2xl bg-surface border border-line overflow-hidden">
        <button
          onClick={startNewChat}
          className="flex items-center gap-2 m-3 px-3 py-2 rounded-xl bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-400 transition"
        >
          <Plus size={15} />
          Yangi suhbat
        </button>
        <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
          {sortedSessions.map((s) => (
            <div
              key={s.id}
              onClick={() => setCurrentId(s.id)}
              className={`group flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition ${
                s.id === currentId ? 'bg-indigo-500/15 text-ink' : 'text-mute hover:bg-surface2 hover:text-ink'
              }`}
            >
              <MessageSquare size={14} className="shrink-0 text-faint" />
              <span className="flex-1 min-w-0 truncate text-[13px]">{s.title || 'Yangi suhbat'}</span>
              <button
                onClick={(e) => { e.stopPropagation(); deleteSession(s.id) }}
                className="p-0.5 rounded text-faint opacity-0 group-hover:opacity-100 hover:text-rose-400 transition shrink-0"
                title="O'chirish"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* ── Chat column ───────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center">
              <Bot size={16} className="text-indigo-400" />
            </div>
            <h1 className="font-display text-xl text-ink tracking-tight">AI SMM Menejer</h1>
            <span className="text-[10px] uppercase tracking-[0.16em] text-faint border border-line rounded px-2 py-0.5">{providerLabel}</span>
          </div>
          <p className="text-sm text-mute mt-0.5 ml-10">SMM maslahatchingiz — reja tuzadi, post yozadi, jadvalga qo'shadi</p>
        </div>

        <div className="flex items-center gap-2">
          {/* New chat (mobile, where sidebar is hidden) */}
          <button
            onClick={startNewChat}
            className="md:hidden flex items-center gap-1.5 px-3 py-2 rounded-lg border border-line text-mute hover:text-ink hover:bg-surface2 transition text-xs"
            title="Yangi suhbat"
          >
            <Plus size={14} />
          </button>

          {/* Agent mode toggle */}
          <button
            onClick={() => setAgentMode((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition ${
              agentMode
                ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300'
                : 'bg-surface border-line text-mute hover:text-ink hover:bg-surface2'
            }`}
            title="Agent rejimi — postlarni boshqarish"
          >
            <Zap size={12} />
            Menejer
          </button>

          {/* Model selector */}
          <div className="relative">
            <button
              onClick={() => setModelDropOpen((v) => !v)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-line text-sm text-ink hover:bg-surface2 transition"
            >
              <div className={`w-1.5 h-1.5 rounded-full ${ollamaOnline ? 'bg-mint-500' : 'bg-rose-500'}`} />
              <span className="max-w-[120px] truncate">{selectedModel}</span>
              <ChevronDown size={12} className={`text-faint transition-transform ${modelDropOpen ? 'rotate-180' : ''}`} />
            </button>
            {modelDropOpen && (
              <div className="absolute right-0 top-full mt-1.5 z-20 min-w-[180px] rounded-xl bg-surface border border-line shadow-xl py-1.5">
                {models.map((m) => (
                  <button
                    key={m}
                    onClick={() => { setSelectedModel(m); setModelDropOpen(false) }}
                    className={`w-full text-left px-3 py-2 text-sm transition ${
                      m === selectedModel ? 'text-ink bg-indigo-500/10' : 'text-mute hover:text-ink hover:bg-surface2'
                    }`}
                  >
                    {m}
                  </button>
                ))}
                {modelsError && (
                  <div className="px-3 py-2 text-xs text-rose-400">Ollama offline</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Agent mode banner */}
      {agentMode && (
        <div className="mb-3 flex items-start gap-3 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-3 text-sm text-indigo-300 shrink-0">
          <Zap size={15} className="shrink-0 mt-0.5 text-indigo-400" />
          <div>
            <span className="font-medium">AI SMM menejer ishlayapti.</span>{' '}
            U jadvalingizni ko'radi, eng yaxshi kunlarni tanlaydi, formatlar beradi va kerak bo'lsa post yaratadi.
          </div>
        </div>
      )}

      {/* Ollama offline warning */}
      {(modelsError || modelsData?.status === 'offline') && (
        <div className="mb-3 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300 shrink-0">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <div>
            <span className="font-medium">Ollama ishlamayapti.</span>{' '}
            Terminalda <code className="bg-black/30 rounded px-1">ollama serve</code> ni ishga tushiring, so'ng{' '}
            <code className="bg-black/30 rounded px-1">ollama pull qwen2.5:0.5b</code> yoki boshqa model yuklab oling.
          </div>
        </div>
      )}

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto rounded-2xl bg-bg border border-line p-4 space-y-4 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-10">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mb-4">
              {agentMode ? <Zap size={22} className="text-indigo-400" /> : <Sparkles size={22} className="text-indigo-400" />}
            </div>
            <div className="font-display text-lg text-ink">
              {agentMode ? 'AI SMM Menejer tayyor' : 'ContentFlow AI bilan suhbat'}
            </div>
            <div className="text-sm text-mute mt-1 max-w-sm">
              {agentMode
                ? 'Haftasiga nechta post, qaysi kunlari va qaysi formatlarda chiqishni rejalashtiradi.'
                : 'SMM strategiyasi, caption yozish, hashtag tavsiyalari va boshqa masalalarda yordam beraman.'}
            </div>
            <div className="mt-6 flex flex-wrap gap-2 justify-center max-w-lg">
              {quickPrompts.map((p) => (
                <button
                  key={p}
                  onClick={() => sendMessage(p)}
                  className="px-3 py-1.5 rounded-full text-xs bg-surface border border-line text-mute hover:text-ink hover:border-line2 transition text-left"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} onViewCalendar={() => navigate('/dashboard/calendar')} />
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-xl shrink-0 flex items-center justify-center bg-surface2 border border-line">
              <Bot size={14} className="text-indigo-400" />
            </div>
            <div className="bg-surface border border-line rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin text-indigo-400" />
              <span className="text-sm text-mute">{agentMode ? 'Bajarayapman…' : 'O\'ylayapman…'}</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="mt-3 shrink-0">
        {/* Post type + image controls (agent mode) — what to create when you ask for a post */}
        {agentMode && (
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-faint">Post turi:</span>
            <div className="inline-flex rounded-lg border border-line p-0.5 bg-surface">
              {CONTENT_TYPES.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setContentType(id)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition ${
                    contentType === id ? 'bg-indigo-500 text-white' : 'text-mute hover:text-ink'
                  }`}
                >
                  <Icon size={12} />
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setWantImage((v) => !v)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition ${
                wantImage
                  ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300'
                  : 'bg-surface border-line text-mute hover:text-ink'
              }`}
              title="Post yaratilganda AI rasm ham generatsiya qilsin"
            >
              <ImageIcon size={12} />
              AI rasm {wantImage ? 'yoqilgan' : 'o\'chiq'}
            </button>
          </div>
        )}

        {/* Attached media chip */}
        {(attachedMedia || uploadingMedia) && (
          <div className="mb-2 flex items-center gap-2 bg-surface border border-indigo-500/30 rounded-xl px-3 py-2 w-fit max-w-full">
            {uploadingMedia ? (
              <>
                <Loader2 size={14} className="animate-spin text-indigo-400 shrink-0" />
                <span className="text-[12px] text-mute">Yuklanmoqda…</span>
              </>
            ) : attachedMedia ? (
              <>
                {attachedMedia.type === 'video'
                  ? <Film size={14} className="text-indigo-400 shrink-0" />
                  : <ImageIcon size={14} className="text-indigo-400 shrink-0" />}
                <span className="text-[12px] text-ink truncate max-w-[220px]">{attachedMedia.name}</span>
                <button
                  onClick={() => setAttachedMedia(null)}
                  className="p-0.5 rounded text-faint hover:text-rose-400 transition shrink-0"
                  title="Olib tashlash"
                >
                  <X size={13} />
                </button>
              </>
            ) : null}
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          onChange={handleFileUpload}
          className="hidden"
        />
        <div className="flex items-end gap-2 bg-surface border border-line rounded-2xl px-4 py-3 focus-within:border-indigo-500/50 transition">
          {agentMode && (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingMedia || loading}
              title="Rasm yoki video biriktirish"
              className="p-1.5 rounded-md text-faint hover:text-indigo-400 hover:bg-surface2 transition shrink-0 disabled:opacity-40"
            >
              <Paperclip size={16} />
            </button>
          )}
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={agentMode
              ? 'Post yarating yoki jadval ko\'ring… (Enter — yuborish)'
              : 'Xabar yozing… (Enter — yuborish, Shift+Enter — yangi qator)'}
            className="flex-1 bg-transparent text-sm text-ink placeholder:text-faint resize-none focus:outline-none leading-relaxed max-h-32 overflow-y-auto"
            style={{ fieldSizing: 'content' } as any}
          />
          <div className="flex items-center gap-2 shrink-0">
            {messages.length > 0 && (
              <button
                onClick={startNewChat}
                title="Yangi suhbat"
                className="p-1.5 rounded-md text-faint hover:text-ink hover:bg-surface2 transition"
              >
                <RefreshCw size={14} />
              </button>
            )}
            <button
              onClick={() => sendMessage()}
              disabled={(!input.trim() && !attachedMedia) || loading}
              className="p-2 rounded-xl bg-indigo-500 text-white hover:bg-indigo-400 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
        <div className="mt-1.5 text-[11px] text-faint text-center">
          {agentMode
            ? `Agent rejimi · ${selectedModel} · Postlar va jadval boshqaruvi`
            : `${providerLabel} · ${selectedModel}`}
        </div>
      </div>
      </div>
    </div>
  )
}
