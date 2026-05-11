import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Sparkles, Loader2, Send, Clock } from 'lucide-react'
import UploadZone from '@/components/posts/UploadZone'
import PlatformSelector from '@/components/posts/PlatformSelector'
import { accountsService } from '@/services/accounts.service'
import { postsService } from '@/services/posts.service'
import { aiService } from '@/services/ai.service'

export default function NewPostPage() {
  const navigate = useNavigate()
  const [caption, setCaption] = useState('')
  const [mediaUrl, setMediaUrl] = useState('')
  const [mediaType, setMediaType] = useState<'image' | 'video' | undefined>()
  const [platforms, setPlatforms] = useState<string[]>([])
  const [scheduledAt, setScheduledAt] = useState('')
  const [postNow, setPostNow] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [generatingCaption, setGeneratingCaption] = useState(false)
  const [captionTopic, setCaptionTopic] = useState('')

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountsService.list(),
  })

  async function handleGenerateCaption() {
    if (!captionTopic) {
      toast.error('Enter a topic for caption generation')
      return
    }
    setGeneratingCaption(true)
    try {
      const firstPlatform = platforms[0]?.split(':')[0] || 'instagram'
      const result = await aiService.generateCaption({
        topic: captionTopic,
        platform: firstPlatform,
        tone: 'casual',
      })
      setCaption(result.caption + '\n\n' + result.hashtags.map((h) => `#${h}`).join(' '))
      toast.success('Caption generated')
    } catch {
      toast.error('Failed to generate caption')
    } finally {
      setGeneratingCaption(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (platforms.length === 0) {
      toast.error('Select at least one platform account')
      return
    }

    setSubmitting(true)
    try {
      const post = await postsService.create({
        caption,
        media_url: mediaUrl || undefined,
        media_type: mediaType,
        platforms,
        scheduled_at: postNow ? null : scheduledAt || null,
      })

      if (postNow) {
        await postsService.triggerNow(post.id)
        toast.success('Post queued for immediate publishing')
      } else {
        toast.success('Post scheduled successfully')
      }
      navigate('/')
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to create post')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">New Post</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Create and schedule content across your platforms</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Upload */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <label className="text-sm font-semibold text-foreground">Media</label>
          <UploadZone
            value={mediaUrl}
            mediaType={mediaType}
            onUpload={(url, type) => {
              setMediaUrl(url)
              setMediaType(url ? type : undefined)
            }}
          />
        </div>

        {/* Caption */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <label className="text-sm font-semibold text-foreground">Caption</label>

          {/* AI assist */}
          <div className="flex gap-2">
            <input
              type="text"
              value={captionTopic}
              onChange={(e) => setCaptionTopic(e.target.value)}
              placeholder="Topic for AI caption (e.g. sunrise yoga)"
              className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <button
              type="button"
              onClick={handleGenerateCaption}
              disabled={generatingCaption}
              className="flex items-center gap-1.5 px-3 py-2 bg-primary/10 text-primary rounded-lg text-sm font-medium hover:bg-primary/20 transition-colors disabled:opacity-50"
            >
              {generatingCaption ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              AI
            </button>
          </div>

          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Write your caption..."
            rows={5}
            className="w-full px-3.5 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
          />
          <p className="text-xs text-muted-foreground text-right">{caption.length} chars</p>
        </div>

        {/* Platforms */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <label className="text-sm font-semibold text-foreground">Post to</label>
          <PlatformSelector accounts={accounts} selected={platforms} onChange={setPlatforms} />
        </div>

        {/* Schedule */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <label className="text-sm font-semibold text-foreground">Timing</label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setPostNow(true)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                postNow
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:border-primary/50'
              }`}
            >
              <Send size={14} /> Post Now
            </button>
            <button
              type="button"
              onClick={() => setPostNow(false)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                !postNow
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:border-primary/50'
              }`}
            >
              <Clock size={14} /> Schedule
            </button>
          </div>

          {!postNow && (
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {submitting && <Loader2 size={16} className="animate-spin" />}
          {postNow ? 'Publish Now' : 'Schedule Post'}
        </button>
      </form>
    </div>
  )
}
