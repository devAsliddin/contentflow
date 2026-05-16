export type PlatformKind =
  | 'telegram'
  | 'instagram'
  | 'tiktok'
  | 'facebook'
  | 'linkedin'
  | 'youtube'
  | 'twitter'

export const PLATFORM_META: Record<
  PlatformKind,
  { letter: string; label: string; fg: string; bg: string; ring: string }
> = {
  telegram: {
    letter: 'tg',
    label: 'Telegram',
    fg: '#5BE8FF',
    bg: 'linear-gradient(135deg,#0a3a52,#0d6e8f)',
    ring: 'rgba(91,232,255,0.45)',
  },
  instagram: {
    letter: 'ig',
    label: 'Instagram',
    fg: '#FFD2EA',
    bg: 'linear-gradient(135deg,#7a1a5a,#f0427a 60%,#ffb056)',
    ring: 'rgba(255,92,138,0.45)',
  },
  tiktok: {
    letter: 'tt',
    label: 'TikTok',
    fg: '#fff',
    bg: 'linear-gradient(135deg,#0e0e12 0%,#ff2a55 50%,#25f4ee 100%)',
    ring: 'rgba(91,232,255,0.45)',
  },
  facebook: {
    letter: 'fb',
    label: 'Facebook',
    fg: '#E8F4FF',
    bg: 'linear-gradient(135deg,#0a3a7a,#1877f2)',
    ring: 'rgba(24,119,242,0.45)',
  },
  linkedin: {
    letter: 'in',
    label: 'LinkedIn',
    fg: '#E8F6FF',
    bg: 'linear-gradient(135deg,#003a5c,#0077b5)',
    ring: 'rgba(0,119,181,0.45)',
  },
  youtube: {
    letter: 'yt',
    label: 'YouTube',
    fg: '#FFE8E8',
    bg: 'linear-gradient(135deg,#4a0000,#ff0000)',
    ring: 'rgba(255,0,0,0.45)',
  },
  twitter: {
    letter: 'x',
    label: 'X / Twitter',
    fg: '#fff',
    bg: 'linear-gradient(135deg,#111,#333)',
    ring: 'rgba(255,255,255,0.25)',
  },
}

interface Props {
  kind: PlatformKind
  size?: number
  ring?: boolean
  className?: string
}

export default function PlatformChip({ kind, size = 22, ring = false, className = '' }: Props) {
  const p = PLATFORM_META[kind]
  if (!p) return null
  return (
    <span
      className={`inline-flex items-center justify-center rounded-md font-mono text-[10px] font-semibold ${className}`}
      style={{
        width: size,
        height: size,
        background: p.bg,
        color: p.fg,
        boxShadow: ring
          ? `inset 0 0 0 1px ${p.ring}, 0 6px 16px -6px ${p.ring}`
          : 'inset 0 0 0 1px rgba(255,255,255,0.08)',
        letterSpacing: '0.02em',
        flexShrink: 0,
      }}
    >
      {p.letter}
    </span>
  )
}
