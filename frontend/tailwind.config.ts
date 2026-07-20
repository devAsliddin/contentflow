import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:       'var(--cf-bg)',
        surface:  'var(--cf-surface)',
        surface2: 'var(--cf-surface2)',
        line:     'var(--cf-line)',
        line2:    'var(--cf-line2)',
        ink:      'var(--cf-ink)',
        mute:     'var(--cf-mute)',
        faint:    'var(--cf-faint)',
        indigo: {
          400: '#8B85FF',
          500: '#6C63FF',
          600: '#564EE0',
        },
        mint: {
          400: '#4DFFC0',
          500: '#00F5A0',
        },
        amber: {
          400: '#FFC675',
          500: '#FFB347',
        },
        rose: {
          500: '#FF5C8A',
        },
        cyan: {
          500: '#5BE8FF',
        },
        // keep legacy vars for login/register pages
        border: 'hsl(var(--border))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      fontFamily: {
        sans:    ['"DM Sans"', 'system-ui', 'sans-serif'],
        display: ['"Fraunces"', 'Georgia', 'serif'],
        mono:    ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'glow-indigo': '0 0 0 1px rgba(108,99,255,0.35), 0 20px 60px -20px rgba(108,99,255,0.45)',
        'glow-mint':   '0 0 0 1px rgba(0,245,160,0.32), 0 20px 60px -20px rgba(0,245,160,0.40)',
        'glow-amber':  '0 0 0 1px rgba(255,179,71,0.30), 0 20px 60px -20px rgba(255,179,71,0.40)',
        'card':        '0 1px 0 rgba(255,255,255,0.04) inset, 0 20px 50px -30px rgba(0,0,0,0.8)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
