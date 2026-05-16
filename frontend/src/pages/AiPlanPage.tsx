import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Sparkles, Loader2, AlertCircle, RefreshCw, ChevronDown, Copy, Check } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { aiService } from '@/services/ai.service'
import { accountsService } from '@/services/accounts.service'
import PlatformChip, { type PlatformKind } from '@/components/ui/PlatformChip'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const QUICK_PROMPTS = [
  'Instagram va Telegram kanalim uchun 1 oylik kontent reja tuzing',
  'TikTok uchun viral video g\'oyalar bering',
  'Texnologiya mavzusida haftalik kontent strategiyasi',
  'Biznes kontent uchun eng yaxshi hashtag\'lar',
  'Kanalimni qanday o\'stirishim mumkin?',
  'Telegram post uchun qiziqarli kontent yozing',
]

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {})
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user'
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    copyToClipboard(msg.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Simple markdown-like rendering: bold, line breaks, code blocks
  const renderContent = (text: string) => {
    const lines = text.split('\n')
    return lines.map((line, i) => {
      // Code block line
      if (line.startsWith('```')) return <div key={i} className="h-1" />
      // Heading-like lines starting with #
      if (line.startsWith('### ')) return <div key={i} className="font-semibold text-ink mt-3 mb-1">{line.slice(4)}</div>
      if (line.startsWith('## ')) return <div key={i} className="font-bold text-ink mt-3 mb-1 text-[15px]">{line.slice(3)}</div>
      if (line.startsWith('# ')) return <div key={i} className="font-bold text-ink mt-3 mb-1 text-[16px]">{line.slice(2)}</div>
      // Bullet lines
      if (line.startsWith('- ') || line.startsWith('• ')) {
        return (
          <div key={i} className="flex gap-2 my-0.5">
            <span className="text-indigo-400 shrink-0 mt-0.5">•</span>
            <span>{renderInline(line.slice(2))}</span>
          </div>
        )
      }
      // Numbered lines
      const numMatch = line.match(/^(\d+)\.\s(.+)/)
      if (numMatch) {
        return (
          <div key={i} className="flex gap-2 my-0.5">
            <span className="text-indigo-400 shrink-0 font-mono text-[12px] mt-0.5">{numMatch[1]}.</span>
            <span>{renderInline(numMatch[2])}</span>
          </div>
        )
      }
      // Horizontal rule
      if (line.trim() === '---') return <hr key={i} className="border-line my-2" />
      // Empty line
      if (!line.trim()) return <div key={i} className="h-2" />
      // Normal line
      return <div key={i}>{renderInline(line)}</div>
    })
  }

  const renderInline = (text: string) => {
    // Bold **text**
    const parts = text.split(/(\*\*[^*]+\*\*)/g)
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-semibold text-ink">{part.slice(2, -2)}</strong>
      }
      return <span key={i}>{part}</span>
    })
  }

  if (isUser) {
    return (
      <div className="flex gap-3 flex-row-reverse">
        <div className="w-8 h-8 rounded-xl shrink-0 flex items-center justify-center bg-indigo-500 text-white">
          <User size={14} />
        </div>
        <div className="max-w-[75%] rounded-2xl rounded-tr-sm px-4 py-3 bg-indigo-500 text-white text-[14px] leading-relaxed">
          {msg.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-3 group">
      <div className="w-8 h-8 rounded-xl shrink-0 flex items-center justify-center bg-surface2 border border-line">
        <Bot size={14} className="text-indigo-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="rounded-2xl rounded-tl-sm px-4 py-3 bg-surface border border-line text-[14px] leading-relaxed text-ink">
          {renderContent(msg.content)}
        </div>
        <button
          onClick={handleCopy}
          className="mt-1 flex items-center gap-1.5 text-[11px] text-faint hover:text-ink transition opacity-0 group-hover:opacity-100"
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? 'Nusxalandi' : 'Nusxalash'}
        </button>
      </div>
    </div>
  )
}

export default function AiPlanPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedModel, setSelectedModel] = useState('llama3.2')
  const [modelDropOpen, setModelDropOpen] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const { data: modelsData } = useQuery({
    queryKey: ['ollama-models'],
    queryFn: () => aiService.listModels(),
    retry: false,
    staleTime: 60_000,
  })

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountsService.list(),
    staleTime: 30_000,
  })

  useEffect(() => {
    if (modelsData?.default) setSelectedModel(modelsData.default)
  }, [modelsData])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const ollamaOnline = modelsData?.status === 'ok'
  const models = modelsData?.models ?? ['llama3.2']

  // Group accounts by platform for display
  const platformGroups = accounts.reduce<Record<string, typeof accounts>>((acc, a) => {
    if (!acc[a.platform]) acc[a.platform] = []
    acc[a.platform].push(a)
    return acc
  }, {})

  async function sendMessage(text?: string) {
    const content = (text ?? input).trim()
    if (!content || loading) return

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content }
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setInput('')
    setLoading(true)

    try {
      const history = updatedMessages.map((m) => ({ role: m.role, content: m.content }))
      const result = await aiService.planChat(history, selectedModel)
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: result.message.content },
      ])
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'AI javob bermadi'
      toast.error(detail)
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: `Xato: ${detail}` },
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

  return (
    <div className="page-in flex flex-col h-[calc(100vh-64px)] max-w-[860px] mx-auto px-4 py-4">

      {/* Header */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center">
            <Sparkles size={17} className="text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-[18px] text-ink tracking-tight">AI Kontent Menejeri</h1>
              <span className="text-[10px] uppercase tracking-[0.14em] text-faint border border-line rounded px-2 py-0.5">
                Ollama · Local
              </span>
            </div>
            {accounts.length > 0 && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[11px] text-faint">Platformalar:</span>
                {Object.keys(platformGroups).map((p) => (
                  <PlatformChip key={p} kind={p as PlatformKind} size={14} />
                ))}
                <span className="text-[11px] text-faint">{accounts.length} ta hisob</span>
              </div>
            )}
          </div>
        </div>

        {/* Model selector */}
        <div className="relative">
          <button
            onClick={() => setModelDropOpen((v) => !v)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface border border-line text-[13px] text-ink hover:bg-surface2 transition"
          >
            <div className={`w-1.5 h-1.5 rounded-full ${ollamaOnline ? 'bg-mint-500' : 'bg-rose-500'}`} />
            <span className="max-w-[130px] truncate">{selectedModel}</span>
            <ChevronDown size={12} className={`text-faint transition-transform ${modelDropOpen ? 'rotate-180' : ''}`} />
          </button>
          {modelDropOpen && (
            <div className="absolute right-0 top-full mt-1.5 z-20 min-w-[190px] rounded-xl bg-surface border border-line shadow-xl py-1.5">
              {models.map((m) => (
                <button
                  key={m}
                  onClick={() => { setSelectedModel(m); setModelDropOpen(false) }}
                  className={`w-full text-left px-3 py-2 text-[13px] transition ${
                    m === selectedModel ? 'text-ink bg-indigo-500/10' : 'text-mute hover:text-ink hover:bg-surface2'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Ollama offline warning */}
      {modelsData && !ollamaOnline && (
        <div className="mb-3 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[13px] text-amber-300 shrink-0">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <div>
            <span className="font-medium">Ollama ishlamayapti.</span>{' '}
            Terminal oching:{' '}
            <code className="bg-black/30 rounded px-1.5 py-0.5">ollama serve</code>
            {' · '}
            <code className="bg-black/30 rounded px-1.5 py-0.5">ollama pull llama3.2</code>
          </div>
        </div>
      )}

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto rounded-2xl bg-bg border border-line p-5 space-y-5 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-full text-center py-8">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
              style={{ background: 'linear-gradient(135deg, rgba(108,99,255,0.2), rgba(0,245,160,0.1))', border: '1px solid rgba(108,99,255,0.3)' }}
            >
              <Sparkles size={26} className="text-indigo-400" />
            </div>
            <h2 className="font-display text-2xl text-ink tracking-tight">Kontent menejeri tayyor</h2>
            <p className="text-[14px] text-mute mt-2 max-w-[420px] leading-relaxed">
              Kanallaringiz uchun reja tuzing, postlar yozing, strategiya ishlab chiqing.
              {accounts.length > 0
                ? ` ${accounts.length} ta hisobingiz ulangan.`
                : ' Boshlash uchun savolingizni yozing.'}
            </p>

            {/* Quick prompts */}
            <div className="mt-7 grid grid-cols-2 gap-2 w-full max-w-[600px]">
              {QUICK_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => sendMessage(p)}
                  disabled={loading}
                  className="text-left px-4 py-3 rounded-xl border border-line bg-surface hover:bg-surface2 hover:border-indigo-500/40 transition text-[13px] text-mute hover:text-ink disabled:opacity-50"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-xl shrink-0 flex items-center justify-center bg-surface2 border border-line">
              <Bot size={14} className="text-indigo-400" />
            </div>
            <div className="bg-surface border border-line rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2.5">
              <Loader2 size={14} className="animate-spin text-indigo-400" />
              <span className="text-[13px] text-mute">Tayyorlanmoqda…</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="mt-3 shrink-0">
        <div className="flex items-end gap-2 bg-surface border border-line rounded-2xl px-4 py-3 focus-within:border-indigo-500/40 transition">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Savolingizni yozing… (Enter — yuborish, Shift+Enter — yangi qator)"
            className="flex-1 bg-transparent text-[14px] text-ink placeholder:text-faint resize-none focus:outline-none leading-relaxed max-h-36 overflow-y-auto"
            style={{ fieldSizing: 'content' } as any}
          />
          <div className="flex items-center gap-1.5 shrink-0 pb-0.5">
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                title="Suhbatni tozalash"
                className="p-1.5 rounded-lg text-faint hover:text-ink hover:bg-surface2 transition"
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
          Barcha ma'lumotlar mahalliy qurilmangizda · Ollama · {selectedModel}
        </div>
      </div>
    </div>
  )
}
