import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { LucideIcon } from 'lucide-react'

type Variant = 'primary' | 'mint' | 'ghost' | 'quiet' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: LucideIcon
  iconRight?: LucideIcon
  children?: ReactNode
}

const SIZES: Record<Size, string> = {
  sm: 'px-2.5 py-1.5 text-xs gap-1.5',
  md: 'px-3.5 py-2 text-sm gap-2',
  lg: 'px-5 py-3 text-sm gap-2',
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-indigo-500 text-white hover:bg-indigo-400 shadow-glow-indigo',
  mint:    'bg-mint-500 text-bg hover:bg-mint-400 font-medium',
  ghost:   'bg-surface border border-line text-ink hover:border-line2 hover:bg-surface2',
  quiet:   'text-mute hover:text-ink hover:bg-surface2',
  danger:  'bg-rose-500/10 text-rose-500 border border-rose-500/30 hover:bg-rose-500/15',
}

export default function Btn({ variant = 'ghost', size = 'md', icon: Icon, iconRight: IconRight, children, className = '', ...rest }: Props) {
  return (
    <button
      className={`inline-flex items-center rounded-lg font-medium transition ring-focus ${SIZES[size]} ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {Icon && <Icon size={14} />}
      {children}
      {IconRight && <IconRight size={14} />}
    </button>
  )
}
