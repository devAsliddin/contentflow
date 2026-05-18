import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Sparkles, ChevronDown, Loader2, AlertCircle, RefreshCw, Zap, CheckCircle, Calendar, ExternalLink, LayoutGrid } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { aiService } from '@/services/ai.service'
import type { AgentAction, PlannedPost } from '@/services/ai.service'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  action?: AgentAction
}

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

  if (action.type === 'create_post' && action.result) {
    const caption = action.result.caption as string | undefined
    const platforms = action.result.platforms as string[] | undefined
    const scheduled_at = action.result.scheduled_at as string | undefined
    const status = action.result.status as string | undefined
    return (
      <div className="mt-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300 space-y-1">
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
        {caption && (
          <div className="text-ink/70">"{caption}"</div>
        )}
        <div className="flex items-center gap-3 text-faint">
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
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
            isUser
              ? 'bg-indigo-500 text-white rounded-tr-sm'
              : 'bg-surface border border-line text-ink rounded-tl-sm'
          }`}
        >
          {msg.content}
        </div>
        {msg.action && <ActionCard action={msg.action} onViewCalendar={onViewCalendar} />}
      </div>
    </div>
  )
}

export default function AiChatPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedModel, setSelectedModel] = useState('qwen2.5:0.5b')
  const [modelDropOpen, setModelDropOpen] = useState(false)
  const [agentMode, setAgentMode] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const { data: modelsData, isError: modelsError } = useQuery({
    queryKey: ['ollama-models'],
    queryFn: () => aiService.listModels(),
    retry: false,
    staleTime: 60_000,
  })

  useEffect(() => {
    if (modelsData?.default) setSelectedModel(modelsData.default)
  }, [modelsData])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const ollamaOnline = modelsData?.status === 'ok'

  async function sendMessage(text?: string) {
    const content = (text ?? input).trim()
    if (!content || loading) return

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }))

      if (agentMode) {
        const result = await aiService.agentChat(history, selectedModel)
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

  const models = modelsData?.models ?? ['qwen2.5:0.5b']
  const quickPrompts = agentMode ? QUICK_PROMPTS_AGENT : QUICK_PROMPTS_CHAT

  return (
    <div className="page-in flex flex-col h-[calc(100vh-64px)] max-w-[900px] mx-auto px-4 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center">
              <Bot size={16} className="text-indigo-400" />
            </div>
            <h1 className="font-display text-xl text-ink tracking-tight">AI SMM Menejer</h1>
            <span className="text-[10px] uppercase tracking-[0.16em] text-faint border border-line rounded px-2 py-0.5">Local · Ollama</span>
          </div>
          <p className="text-sm text-mute mt-0.5 ml-10">SMM maslahatchi — internet talab qilmaydi</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Agent mode toggle */}
          <button
            onClick={() => { setAgentMode((v) => !v); setMessages([]) }}
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
              {agentMode ? 'AI SMM menejer tayyor' : 'ContentFlow AI bilan suhbat'}
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
          <MessageBubble key={msg.id} msg={msg} onViewCalendar={() => navigate('/calendar')} />
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
        <div className="flex items-end gap-2 bg-surface border border-line rounded-2xl px-4 py-3 focus-within:border-indigo-500/50 transition">
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
                onClick={() => setMessages([])}
                title="Suhbatni tozalash"
                className="p-1.5 rounded-md text-faint hover:text-ink hover:bg-surface2 transition"
              >
                <RefreshCw size={14} />
              </button>
            )}
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              className="p-2 rounded-xl bg-indigo-500 text-white hover:bg-indigo-400 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
        <div className="mt-1.5 text-[11px] text-faint text-center">
          {agentMode
            ? `Agent rejimi · Ollama · ${selectedModel} · Postlar va jadval boshqaruvi`
            : `Barcha ma'lumotlar mahalliy qurilmangizda qayta ishlanadi · Ollama · ${selectedModel}`}
        </div>
      </div>
    </div>
  )
}
