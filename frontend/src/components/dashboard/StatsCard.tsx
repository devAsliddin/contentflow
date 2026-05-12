import { TrendingUp, TrendingDown } from 'lucide-react'
import Sparkline from '@/components/ui/Sparkline'

interface Props {
  label: string
  value: string | number
  delta?: string
  deltaKind?: 'up' | 'down'
  sparkValues?: number[]
  sparkColor?: string
  sparkFill?: string
  // legacy props (ignored)
  title?: string
  icon?: any
  trend?: number[]
  color?: string
}

export default function StatsCard({
  label,
  value,
  delta,
  deltaKind = 'up',
  sparkValues,
  sparkColor = '#6C63FF',
  sparkFill = 'rgba(108,99,255,0.18)',
}: Props) {
  const deltaColor = deltaKind === 'up' ? '#00F5A0' : '#FF5C8A'
  return (
    <div className="lift relative rounded-2xl bg-surface border border-line p-5 overflow-hidden shadow-card">
      <div
        className="absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl opacity-30"
        style={{ background: sparkColor }}
      />
      <div className="relative flex items-start justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-mute font-medium">{label}</div>
          <div className="mt-3 flex items-baseline gap-2">
            <div className="font-display text-3xl text-ink tnum tracking-tight">{value}</div>
            {delta && (
              <div className="flex items-center gap-1 text-xs tnum font-medium" style={{ color: deltaColor }}>
                {deltaKind === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {delta}
              </div>
            )}
          </div>
        </div>
        {sparkValues && (
          <Sparkline values={sparkValues} color={sparkColor} fill={sparkFill} w={92} h={36} />
        )}
      </div>
    </div>
  )
}
