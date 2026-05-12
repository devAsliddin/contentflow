import { useState } from 'react'
import { Sparkles, Loader2, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { aiService } from '@/services/ai.service'
import PlatformChip, { type PlatformKind } from '@/components/ui/PlatformChip'
import type { PostIdea } from '@/types/api.types'

export default function AiSuggestions() {
  const navigate = useNavigate()
  const [ideas, setIdeas] = useState<PostIdea[]>([])
  const [loading, setLoading] = useState(false)

  async function loadIdeas() {
    setLoading(true)
    try {
      const result = await aiService.suggestIdeas()
      setIdeas(result.ideas)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-surface rounded-xl animate-pulse border border-line" />
        ))}
      </div>
    )
  }

  if (ideas.length === 0) {
    return (
      <div className="rounded-2xl bg-surface border border-line p-5 text-center">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mx-auto mb-3">
          <Sparkles size={18} className="text-indigo-400" />
        </div>
        <p className="text-sm text-ink mb-1">AI Suggestions</p>
        <p className="text-[12px] text-mute mb-4">Get AI-powered content ideas for your audience.</p>
        <button
          onClick={loadIdeas}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-sm font-medium hover:bg-indigo-500/15 transition"
        >
          <Sparkles size={13} />
          Generate ideas
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <Sparkles size={11} className="text-indigo-400" />
          <span className="text-[10px] uppercase tracking-[0.18em] text-faint">AI Studio</span>
        </div>
        <button
          onClick={loadIdeas}
          className="text-[11px] text-mute hover:text-ink uppercase tracking-wider"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : 'Refresh'}
        </button>
      </div>

      {ideas.map((idea, idx) => (
        <div
          key={idx}
          className="lift relative rounded-xl border border-line bg-surface p-4 overflow-hidden"
        >
          <div
            className="absolute inset-x-0 -top-px h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(108,99,255,0.6), transparent)' }}
          />
          <div className="text-[10px] uppercase tracking-[0.16em] text-indigo-400 font-medium mb-2">
            {idea.platform}
          </div>
          <div className="font-display text-[15px] text-ink leading-snug mb-2">{idea.title}</div>
          <div className="text-[12px] text-mute leading-relaxed mb-3 line-clamp-2">{idea.description}</div>
          <div className="flex items-center justify-between">
            <PlatformChip kind={idea.platform as PlatformKind} size={18} />
            <button
              onClick={() => navigate('/new-post')}
              className="text-[12px] font-medium text-indigo-400 hover:text-indigo-500 inline-flex items-center gap-1 group"
            >
              Use this idea
              <ArrowRight size={12} className="group-hover:translate-x-0.5 transition" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
