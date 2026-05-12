interface Props {
  values: number[]
  color?: string
  fill?: string
  w?: number
  h?: number
}

export default function Sparkline({ values, color = '#6C63FF', fill = 'rgba(108,99,255,0.18)', w = 120, h = 36 }: Props) {
  if (!values || values.length === 0) return null
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1
  const stepX = w / (values.length - 1)
  const pts = values.map((v, i): [number, number] => [i * stepX, h - ((v - min) / range) * (h - 4) - 2])

  let d = `M ${pts[0][0]},${pts[0][1]}`
  for (let i = 1; i < pts.length; i++) {
    const [x, y] = pts[i]
    const [px, py] = pts[i - 1]
    const cx = (x + px) / 2
    d += ` C ${cx},${py} ${cx},${y} ${x},${y}`
  }
  const area = d + ` L ${w},${h} L 0,${h} Z`
  const last = pts[pts.length - 1]

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="spark overflow-visible">
      <path d={area} fill={fill} stroke="none" />
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="2.5" fill={color} />
      <circle cx={last[0]} cy={last[1]} r="6" fill={color} opacity="0.18" />
    </svg>
  )
}
