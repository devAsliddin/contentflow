import { useState } from 'react'
import { toast } from 'sonner'
import { Sparkles, Loader2, Plus, ChevronDown } from 'lucide-react'
import { aiService } from '@/services/ai.service'
import { postsService } from '@/services/posts.service'
import { getPlatformColor } from '@/utils/platform.utils'
import type { WeeklyPlan, DayPost } from '@/types/api.types'

const NICHES = ['Fitness', 'Food & Cooking', 'Travel', 'Fashion', 'Technology', 'Business', 'Education', 'Entertainment', 'Health & Wellness', 'Photography', 'Art & Design', 'Music']
const TONES = ['casual', 'professional', 'humorous', 'educational', 'inspirational']
const PLATFORMS = ['instagram', 'tiktok', 'telegram']

export default function AiPlanPage() {
  const [niche, setNiche] = useState('')
  const [frequency, setFrequency] = useState(5)
  const [tone, setTone] = useState('casual')
  const [platforms, setPlatforms] = useState<string[]>(['instagram'])
  const [plan, setPlan] = useState<WeeklyPlan | null>(null)
  const [loading, setLoading] = useState(false)
  const [addingAll, setAddingAll] = useState(false)

  function togglePlatform(p: string) {
    setPlatforms((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p])
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    if (platforms.length === 0) {
      toast.error('Select at least one platform')
      return
    }
    setLoading(true)
    try {
      const result = await aiService.generatePlan({ niche, frequency, tone, platforms })
      setPlan(result)
      toast.success('Content plan generated')
    } catch {
      toast.error('Failed to generate plan. Check your AI configuration.')
    } finally {
      setLoading(false)
    }
  }

  async function addAllToQueue() {
    if (!plan) return
    setAddingAll(true)
    let count = 0
    try {
      for (const day of plan.days) {
        for (const post of day.posts) {
          await postsService.create({
            caption: `${post.caption_suggestion}\n\n${post.hashtags.map((h) => `#${h}`).join(' ')}`,
            platforms: [post.platform],
            scheduled_at: null,
          })
          count++
        }
      }
      toast.success(`${count} posts added to drafts`)
    } catch {
      toast.error('Some posts failed to add')
    } finally {
      setAddingAll(false)
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">AI Content Plan</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Generate a weekly content calendar with AI</p>
      </div>

      {/* Config form */}
      <form onSubmit={handleGenerate} className="bg-card border border-border rounded-2xl p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Niche</label>
            <div className="relative">
              <select
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none"
              >
                <option value="">Select niche...</option>
                {NICHES.map((n) => <option key={n} value={n.toLowerCase()}>{n}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-3 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Posts per week: {frequency}</label>
            <input
              type="range"
              min={1}
              max={21}
              value={frequency}
              onChange={(e) => setFrequency(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>1</span><span>7</span><span>14</span><span>21</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Tone</label>
            <div className="flex flex-wrap gap-2">
              {TONES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTone(t)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors capitalize ${
                    tone === t
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Platforms</label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => {
                const color = getPlatformColor(p)
                const selected = platforms.includes(p)
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePlatform(p)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium border transition-all capitalize"
                    style={selected
                      ? { backgroundColor: color, borderColor: color, color: 'white' }
                      : { borderColor: `${color}40`, color: 'hsl(215.4 16.3% 56.9%)' }
                    }
                  >
                    {p}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {loading ? 'Generating plan...' : 'Generate Plan'}
        </button>
      </form>

      {/* Plan results */}
      {plan && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground">Your Weekly Plan</h3>
            <button
              onClick={addAllToQueue}
              disabled={addingAll}
              className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-lg text-sm font-medium hover:bg-primary/20 transition-colors disabled:opacity-50"
            >
              {addingAll ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Add all to drafts
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {plan.days.map((day) => (
              <div key={day.day} className="bg-card border border-border rounded-2xl p-4 space-y-3">
                <h4 className="text-sm font-bold text-foreground">{day.day}</h4>
                {day.posts.map((post, idx) => {
                  const color = getPlatformColor(post.platform)
                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-xl border"
                      style={{ borderColor: `${color}30`, backgroundColor: `${color}08` }}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-xs font-medium capitalize" style={{ color }}>{post.platform}</span>
                        <span className="text-xs text-muted-foreground ml-auto">{post.best_time}</span>
                      </div>
                      <p className="text-xs font-medium text-foreground line-clamp-2">{post.content_idea}</p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{post.caption_suggestion}</p>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
