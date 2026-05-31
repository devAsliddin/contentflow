import type { ContentType, PostAspect } from './types'

interface Props {
  value: ContentType
  postAspect: PostAspect
  onChange: (type: ContentType) => void
  onAspectChange: (aspect: PostAspect) => void
}

const TYPES: { key: ContentType; label: string; sub: string }[] = [
  { key: 'post',  label: 'Post',         sub: '1:1 or 4:5' },
  { key: 'story', label: 'Story',        sub: '9:16' },
  { key: 'reel',  label: 'Reels / Short', sub: '9:16' },
]

export default function ContentTypeSelector({ value, postAspect, onChange, onAspectChange }: Props) {
  return (
    <div className="rounded-2xl bg-surface border border-line p-5">
      <div className="text-[11px] uppercase tracking-[0.16em] text-faint mb-3">Content type</div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {TYPES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={`rounded-xl border px-3 py-2.5 text-left transition ${
              value === t.key
                ? 'bg-indigo-500/15 border-indigo-500/40 text-ink'
                : 'bg-bg/40 border-line text-mute hover:border-line2 hover:text-ink'
            }`}
          >
            <div className="text-sm font-medium">{t.label}</div>
            <div className="text-[10px] text-faint mt-0.5">{t.sub}</div>
          </button>
        ))}
      </div>

      {value === 'post' && (
        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-faint mb-2">Aspect ratio</div>
          <div className="flex gap-2">
            {(['1:1', '4:5'] as PostAspect[]).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => onAspectChange(a)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition ${
                  postAspect === a
                    ? 'bg-indigo-500/15 border-indigo-500/40 text-ink'
                    : 'bg-bg/40 border-line text-mute hover:border-line2 hover:text-ink'
                }`}
              >
                <span
                  className="inline-block border border-current rounded-sm"
                  style={{
                    width: a === '1:1' ? 16 : 13,
                    height: a === '1:1' ? 16 : 16,
                  }}
                />
                {a}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
