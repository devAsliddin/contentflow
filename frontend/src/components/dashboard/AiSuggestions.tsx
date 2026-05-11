import { useState } from 'react'
import { Sparkles, Loader2, RefreshCw } from 'lucide-react'
import { aiService } from '@/services/ai.service'
import { getPlatformColor } from '@/utils/platform.utils'
import type { PostIdea } from '@/types/api.types'

export default function AiSuggestions() {
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

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-primary" />
          <h3 className="text-sm font-semibold text-foreground">AI Suggestions</h3>
        </div>
        <button
          onClick={loadIdeas}
          disabled={loading}
          className="p-1.5 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        </button>
      </div>

      {ideas.length === 0 && !loading && (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground mb-3">Get AI-powered content ideas</p>
          <button
            onClick={loadIdeas}
            className="px-4 py-2 bg-primary/10 text-primary rounded-lg text-sm font-medium hover:bg-primary/20 transition-colors"
          >
            Generate ideas
          </button>
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {!loading && ideas.length > 0 && (
        <div className="space-y-2">
          {ideas.map((idea, idx) => (
            <div key={idx} className="p-3 bg-accent/30 rounded-xl border border-border/50">
              <div className="flex items-center gap-2 mb-1">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: getPlatformColor(idea.platform) }}
                />
                <span className="text-xs text-muted-foreground capitalize">{idea.platform}</span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground capitalize">{idea.content_type}</span>
              </div>
              <p className="text-sm font-medium text-foreground">{idea.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{idea.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
