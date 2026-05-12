interface Props {
  name: string
  size?: number
  hue?: number
}

export default function Avatar({ name, size = 32, hue = 250 }: Props) {
  const initials = (name || '')
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div
      className="inline-flex items-center justify-center rounded-full font-medium text-ink shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: `linear-gradient(135deg, oklch(0.42 0.14 ${hue}), oklch(0.32 0.10 ${(hue + 40) % 360}))`,
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)',
      }}
    >
      {initials}
    </div>
  )
}
