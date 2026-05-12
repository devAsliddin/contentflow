interface Props {
  label?: string
  className?: string
  aspect?: string
  hue?: number
}

export default function ImgPlaceholder({ label = 'thumbnail', className = '', aspect = '1 / 1', hue = 250 }: Props) {
  return (
    <div
      className={`relative overflow-hidden rounded-md ${className}`}
      style={{
        aspectRatio: aspect,
        background: `repeating-linear-gradient(135deg, oklch(0.28 0.04 ${hue}), oklch(0.28 0.04 ${hue}) 6px, oklch(0.24 0.04 ${hue}) 6px, oklch(0.24 0.04 ${hue}) 12px)`,
      }}
    >
      <div className="absolute inset-0 flex items-end p-1.5">
        <span className="text-[9px] font-mono text-white/70 bg-black/40 px-1 rounded">{label}</span>
      </div>
    </div>
  )
}
