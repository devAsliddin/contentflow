import { useState } from 'react'
import { toast } from 'sonner'
import { Sparkles, Loader2, RefreshCw, Shuffle, Check, ArrowRight, Info, ChevronDown, Tag, Repeat } from 'lucide-react'
import { aiService } from '@/services/ai.service'
import { postsService } from '@/services/posts.service'
import PlatformChip, { PLATFORM_META, type PlatformKind } from '@/components/ui/PlatformChip'
import ImgPlaceholder from '@/components/ui/ImgPlaceholder'
import type { WeeklyPlan } from '@/types/api.types'

const NICHES = ['Fitness', 'Food & Cooking', 'Travel', 'Fashion', 'Technology', 'Business', 'Education', 'Entertainment', 'Health & Wellness', 'Photography', 'Art & Design', 'Music']
const TONES  = ['casual', 'professional', 'humorous', 'educational', 'inspirational']
const FREQS  = ['3 / week', '5 / week', 'Daily']
const PLATFORMS: PlatformKind[] = ['instagram', 'tiktok', 'telegram']
const DAYS   = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const DAY_COLORS = ['#FF5C8A', '#FFB347', '#5BE8FF', '#6C63FF', '#5BE8FF', '#FF5C8A', '#00F5A0']

function ChipSelect({ label, value, options, onChange, icon: Icon }: {
  label: string; value: string; options: string[];
  onChange: (v: string) => void; icon: any
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <div className="text-[10px] uppercase tracking-[0.14em] text-faint mb-1.5">{label}</div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-bg border border-line text-sm text-ink hover:border-line2 transition"
      >
        <Icon size={13} className="text-mute" />
        <span className="flex-1 text-left">{value || `Select ${label.toLowerCase()}…`}</span>
        <ChevronDown size={13} className="text-mute" />
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1.5 z-20 rounded-lg bg-surface border border-line shadow-xl p-1 max-h-60 overflow-auto">
          {options.map((o) => (
            <button
              key={o}
              onClick={() => { onChange(o); setOpen(false) }}
              className={`w-full text-left px-3 py-1.5 rounded-md text-sm ${o === value ? 'bg-indigo-500/10 text-ink' : 'text-mute hover:text-ink hover:bg-surface2'}`}
            >
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function DistroBar({ kind, count, total }: { kind: PlatformKind; count: number; total: number }) {
  const p = PLATFORM_META[kind]
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <PlatformChip kind={kind} size={16} />
          <span className="text-sm text-ink">{p.label}</span>
        </div>
        <div className="text-xs text-mute tnum">{count} / {total}</div>
      </div>
      <div className="h-1.5 rounded-full bg-line/60 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: p.bg }} />
      </div>
    </div>
  )
}

export default function AiPlanPage() {
  const [strategy, setStrategy] = useState('')
  const [niche, setNiche]       = useState('')
  const [freq, setFreq]         = useState('5 / week')
  const [tone, setTone]         = useState('educational')
  const [selPlatforms, setSelPlatforms] = useState<PlatformKind[]>(['instagram'])
  const [plan, setPlan]         = useState<WeeklyPlan | null>(null)
  const [loading, setLoading]   = useState(false)
  const [addingAll, setAddingAll] = useState(false)

  function togglePlatform(p: PlatformKind) {
    setSelPlatforms((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p])
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    if (selPlatforms.length === 0) { toast.error('Select at least one platform'); return }
    setLoading(true)
    try {
      const result = await aiService.generatePlan({
        niche: niche.toLowerCase(),
        frequency: freq === 'Daily' ? 7 : freq === '5 / week' ? 5 : 3,
        tone,
        platforms: selPlatforms,
      })
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
    <div className="page-in px-8 py-6 max-w-[1280px]">
      <div className="grid grid-cols-12 gap-6">
        {/* Form */}
        <div className="col-span-12 lg:col-span-5">
          <form onSubmit={handleGenerate} className="rounded-2xl bg-surface border border-line p-6 relative overflow-hidden">
            <div
              className="absolute inset-x-0 -top-px h-px"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(108,99,255,0.6), transparent)' }}
            />
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] uppercase tracking-[0.18em] text-indigo-400 font-medium">AI Studio</span>
            </div>
            <h2 className="font-display text-2xl text-ink tracking-tight mb-1">Describe your content strategy</h2>
            <p className="text-sm text-mute mb-4">
              The more specific, the better the plan. We'll mix formats and platforms based on your niche and audience.
            </p>

            <div className="relative">
              <textarea
                value={strategy}
                onChange={(e) => setStrategy(e.target.value)}
                rows={7}
                className="w-full bg-bg border border-line rounded-xl p-4 text-[14px] text-ink leading-relaxed focus:outline-none focus:border-indigo-500/50 transition resize-none placeholder:text-faint"
                placeholder="Who are you talking to? What change do you want them to make? What's your point of view?"
              />
              <div className="absolute bottom-3 right-3 text-[10px] text-faint font-mono tnum">{strategy.length} / 600</div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <ChipSelect label="Niche"     value={niche} options={NICHES} onChange={setNiche} icon={Tag}    />
              <ChipSelect label="Frequency" value={freq}  options={FREQS}  onChange={setFreq}  icon={Repeat} />
            </div>

            <div className="mt-3">
              <div className="text-[10px] uppercase tracking-[0.14em] text-faint mb-2">Tone</div>
              <div className="flex flex-wrap gap-1.5">
                {TONES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTone(t)}
                    className={`px-3 py-1.5 rounded-full text-xs capitalize transition ${
                      tone === t
                        ? 'bg-indigo-500/15 text-ink border border-indigo-500/40'
                        : 'bg-bg border border-line text-mute hover:text-ink hover:border-line2'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3">
              <div className="text-[10px] uppercase tracking-[0.14em] text-faint mb-2">Platforms</div>
              <div className="flex gap-2">
                {PLATFORMS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePlatform(p)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border transition ${
                      selPlatforms.includes(p)
                        ? 'bg-surface2 text-ink border-line2'
                        : 'bg-bg text-mute border-line hover:border-line2'
                    }`}
                  >
                    <PlatformChip kind={p} size={14} />
                    {PLATFORM_META[p].label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-5 w-full py-3.5 rounded-xl bg-indigo-500 text-white font-medium shadow-glow-indigo hover:bg-indigo-400 transition flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {loading
                ? <Loader2 size={16} className="animate-spin" />
                : <Sparkles size={16} />}
              {loading ? 'Generating your plan…' : 'Generate Plan'}
              {!loading && <ArrowRight size={14} />}
            </button>

            <div className="mt-4 flex items-center gap-2 text-[11px] text-faint">
              <Info size={12} />
              Uses 12 credits · Plans regenerate any time
            </div>
          </form>

          {/* AI tips */}
          <div className="mt-5 rounded-2xl border border-line bg-surface p-5 relative overflow-hidden">
            <div className="absolute inset-0 orbit opacity-30 pointer-events-none" />
            <div className="relative">
              <div className="text-[10px] uppercase tracking-[0.18em] text-faint mb-2">How we think</div>
              <ul className="space-y-2 text-sm text-ink">
                <li className="flex gap-2">
                  <Check size={14} className="text-mint-500 shrink-0 mt-1" />
                  Balance hooks, depth, and recap formats across the week
                </li>
                <li className="flex gap-2">
                  <Check size={14} className="text-mint-500 shrink-0 mt-1" />
                  Match each idea to the platform where it lands best
                </li>
                <li className="flex gap-2">
                  <Check size={14} className="text-mint-500 shrink-0 mt-1" />
                  Leave room for one experiment per week
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Plan results */}
        <div className="col-span-12 lg:col-span-7">
          {!plan ? (
            <div className="rounded-2xl border border-dashed border-line2/60 p-10 text-center min-h-[420px] flex flex-col items-center justify-center">
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mb-4">
                <Sparkles size={22} className="text-indigo-400" />
              </div>
              <div className="font-display text-xl text-ink">Your plan will appear here</div>
              <div className="text-sm text-mute mt-1 max-w-sm">
                Describe what you want to build and we'll lay out a week of original ideas across your connected accounts.
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.16em] text-faint">Generated plan</div>
                  <div className="font-display text-xl text-ink tracking-tight">
                    {tone} · {niche.toLowerCase() || 'your niche'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleGenerate({ preventDefault: () => {} } as any)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-surface border border-line text-ink hover:border-line2 hover:bg-surface2 transition"
                  >
                    <RefreshCw size={12} /> Regenerate
                  </button>
                  <button
                    onClick={addAllToQueue}
                    disabled={addingAll}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-mint-500 text-bg hover:bg-mint-400 transition disabled:opacity-50"
                  >
                    {addingAll ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                    Apply all
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-2.5">
                {plan.days.map((day, i) => (
                  <div
                    key={day.day}
                    className="lift rounded-xl bg-surface border border-line p-3 flex flex-col min-h-[200px] relative overflow-hidden"
                  >
                    <div
                      className="absolute inset-x-0 top-0 h-0.5"
                      style={{ background: DAY_COLORS[i % DAY_COLORS.length] }}
                    />
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[10px] uppercase tracking-wider text-faint">{day.day}</div>
                    </div>
                    {day.posts.map((post, idx) => (
                      <div key={idx} className="flex-1">
                        <ImgPlaceholder
                          label={post.platform || 'post'}
                          aspect="4 / 3"
                          hue={(i * 47 + 30) % 360}
                          className="w-full mb-2"
                        />
                        <div className="text-[12.5px] text-ink leading-snug text-balance line-clamp-3">
                          {post.content_idea}
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <PlatformChip kind={post.platform as PlatformKind} size={14} />
                          <span className="text-[10px] text-faint tnum">{post.best_time}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* Distribution */}
              <div className="mt-6 rounded-2xl bg-surface border border-line p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-faint">Distribution</div>
                    <div className="font-display text-lg text-ink">
                      {plan.days.reduce((a, d) => a + d.posts.length, 0)} posts · {selPlatforms.length} platforms
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {selPlatforms.map((kind) => {
                    const count = plan.days.reduce(
                      (a, d) => a + d.posts.filter((p) => p.platform === kind).length,
                      0,
                    )
                    const total = plan.days.reduce((a, d) => a + d.posts.length, 0)
                    return <DistroBar key={kind} kind={kind} count={count} total={total} />
                  })}
                </div>
              </div>

              <div className="mt-5 flex items-center gap-3 px-4 py-3 rounded-xl bg-indigo-500/[0.06] border border-indigo-500/20">
                <Sparkles size={16} className="text-indigo-400 shrink-0" />
                <div className="text-sm text-ink flex-1">
                  <span className="text-indigo-400 font-medium">AI note · </span>
                  Plan generated based on your {tone} tone strategy. Adjust any post before adding to queue.
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
