/**
 * V7 — Yangiliklar sahifasi
 * Route: /dashboard/news
 *
 * Ishonchli manbalardan (RSS) so'nggi yangiliklarni ko'rsatadi. Har bir
 * yangilikdan bir bosishda AI post yozdirib, New Post sahifasiga o'tkazadi.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ExternalLink, Loader2, Newspaper, Search, Sparkles, WandSparkles } from 'lucide-react'
import { newsService, type NewsItem } from '@/services/news.service'

function timeAgo(published: string | null): string {
  if (!published) return ''
  const ms = Date.now() - new Date(published).getTime()
  const mins = Math.floor(ms / 60_000)
  if (mins < 60) return `${Math.max(1, mins)} daqiqa oldin`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} soat oldin`
  const days = Math.floor(hours / 24)
  return `${days} kun oldin`
}

function NewsCard({
  item,
  generating,
  onGenerate,
}: {
  item: NewsItem
  generating: boolean
  onGenerate: () => void
}) {
  return (
    <div className="bg-surface border border-line rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-[11px] text-faint">
        <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
          {item.source}
        </span>
        <span className="tnum">{timeAgo(item.published)}</span>
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto p-1 rounded-md text-faint hover:text-ink hover:bg-surface2 transition"
          aria-label="Manbani ochish"
        >
          <ExternalLink size={13} />
        </a>
      </div>

      <h3 className="text-sm text-ink font-medium leading-snug">{item.title}</h3>
      {item.summary && (
        <p className="text-xs text-mute line-clamp-3">{item.summary}</p>
      )}

      <div className="mt-auto pt-2">
        <button
          onClick={onGenerate}
          disabled={generating}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs hover:bg-indigo-500/20 transition disabled:opacity-50"
        >
          {generating ? <Loader2 size={12} className="animate-spin" /> : <WandSparkles size={12} />}
          {generating ? 'Yozilmoqda…' : 'AI post yozish'}
        </button>
      </div>
    </div>
  )
}

export default function NewsPage() {
  const navigate = useNavigate()
  const [category, setCategory] = useState('uzbekistan')
  const [search, setSearch] = useState('')
  const [topic, setTopic] = useState('')
  const [generatingUrl, setGeneratingUrl] = useState<string | null>(null)

  const { data: categories = [] } = useQuery({
    queryKey: ['news-categories'],
    queryFn: () => newsService.categories(),
    staleTime: Infinity,
  })

  const { data: items = [], isLoading, isFetching } = useQuery({
    queryKey: ['news', category, topic],
    queryFn: () => newsService.list({ category: category || undefined, topic: topic || undefined, limit: 12 }),
    staleTime: 5 * 60_000,
  })

  const generateMutation = useMutation({
    mutationFn: (item: NewsItem) => newsService.generatePost(item),
    onSuccess: (caption) => {
      toast.success('Post tayyor — tahrirlab yuborishingiz mumkin')
      navigate('/dashboard/new-post', { state: { caption } })
    },
    onError: (err: any) => {
      if (err?.response?.status !== 402) toast.error('Post yozishda xato — qayta urinib ko\'ring')
    },
    onSettled: () => setGeneratingUrl(null),
  })

  function handleGenerate(item: NewsItem) {
    setGeneratingUrl(item.url)
    generateMutation.mutate(item)
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setTopic(search.trim())
    if (search.trim()) setCategory('')
  }

  return (
    <div className="page-in px-4 sm:px-8 py-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
          <Newspaper size={18} className="text-indigo-400" />
        </div>
        <div>
          <h1 className="font-display text-lg text-ink">Yangiliklar</h1>
          <p className="text-xs text-mute">Ishonchli manbalardan so'nggi yangiliklar — bir bosishda AI post</p>
        </div>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Mavzu bo'yicha qidirish (masalan: startup, iqlim, futbol)…"
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-surface border border-line text-sm text-ink placeholder:text-faint focus:border-indigo-500/40 focus:outline-none transition"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 rounded-xl bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-400 transition"
        >
          Qidirish
        </button>
      </form>

      {/* Category chips */}
      <div className="flex gap-2 flex-wrap mb-6">
        {categories.map((cat) => (
          <button
            key={cat.key}
            onClick={() => {
              setCategory(cat.key)
              setTopic('')
              setSearch('')
            }}
            className={`px-3 py-1.5 rounded-full text-xs border transition ${
              category === cat.key
                ? 'bg-indigo-500/15 text-ink border-indigo-500/40'
                : 'bg-surface text-mute border-line hover:border-line2 hover:text-ink'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-mute text-sm py-16 justify-center">
          <Loader2 size={16} className="animate-spin" /> Yangiliklar yuklanmoqda…
        </div>
      ) : items.length === 0 ? (
        <div className="bg-surface border border-line rounded-2xl p-12 text-center">
          <Sparkles size={32} className="text-indigo-400 mx-auto mb-3" />
          <p className="text-mute text-sm">
            Yangilik topilmadi. Boshqa kategoriya yoki mavzuni sinab ko'ring.
          </p>
        </div>
      ) : (
        <div className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 ${isFetching ? 'opacity-60' : ''}`}>
          {items.map((item) => (
            <NewsCard
              key={item.url}
              item={item}
              generating={generatingUrl === item.url}
              onGenerate={() => handleGenerate(item)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
