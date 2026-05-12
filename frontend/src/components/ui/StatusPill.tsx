type StatusKind = 'live' | 'scheduled' | 'draft' | 'failed' | 'queued'

const MAP: Record<StatusKind, { dot: string; bg: string; color: string; ring: string }> = {
  live:      { dot: '#00F5A0', bg: 'rgba(0,245,160,0.10)',   color: '#7CFFC8', ring: 'rgba(0,245,160,0.25)' },
  scheduled: { dot: '#FFB347', bg: 'rgba(255,179,71,0.10)',  color: '#FFD49E', ring: 'rgba(255,179,71,0.25)' },
  draft:     { dot: '#8A8AA0', bg: 'rgba(138,138,160,0.10)', color: '#C2C2D0', ring: 'rgba(138,138,160,0.20)' },
  failed:    { dot: '#FF5C8A', bg: 'rgba(255,92,138,0.10)',  color: '#FFB5CC', ring: 'rgba(255,92,138,0.25)' },
  queued:    { dot: '#5BE8FF', bg: 'rgba(91,232,255,0.10)',  color: '#B3F3FF', ring: 'rgba(91,232,255,0.22)' },
}

interface Props {
  kind: StatusKind | string
  children: React.ReactNode
}

export default function StatusPill({ kind, children }: Props) {
  const s = MAP[kind as StatusKind] || MAP.draft
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] tracking-wide uppercase font-medium"
      style={{ background: s.bg, color: s.color, boxShadow: `inset 0 0 0 1px ${s.ring}` }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full dot-pulse"
        style={{ background: s.dot, ['--dot' as string]: s.ring }}
      />
      {children}
    </span>
  )
}
