import { LucideIcon } from 'lucide-react'
import { cn } from '@/utils/cn'
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts'

interface StatsCardProps {
  title: string
  value: number | string
  icon: LucideIcon
  trend?: number[]
  color?: string
  subtitle?: string
}

export default function StatsCard({ title, value, icon: Icon, trend, color = '#3B82F6', subtitle }: StatsCardProps) {
  const trendData = trend?.map((v, i) => ({ i, v })) || []

  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className="text-3xl font-bold text-foreground mt-1">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        <div
          className="flex items-center justify-center w-11 h-11 rounded-xl"
          style={{ backgroundColor: `${color}20` }}
        >
          <Icon size={22} style={{ color }} />
        </div>
      </div>

      {trendData.length > 0 && (
        <div className="h-12">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`grad-${title}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={color}
                strokeWidth={2}
                fill={`url(#grad-${title})`}
                dot={false}
              />
              <Tooltip
                contentStyle={{ background: 'hsl(224 71% 6%)', border: '1px solid hsl(216 34% 17%)', borderRadius: 8, fontSize: 12 }}
                itemStyle={{ color: 'hsl(213 31% 91%)' }}
                labelFormatter={() => ''}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
