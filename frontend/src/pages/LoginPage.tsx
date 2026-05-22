import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Loader2, Eye, EyeOff } from 'lucide-react'
import { useAuthStore } from '@/store'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const login = useAuthStore((s) => s.login)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail || !password) {
      toast.error('Please fill in all fields')
      return
    }

    setLoading(true)
    try {
      await login(trimmedEmail, password)
      navigate('/dashboard')
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      if (err?.response?.status === 429) {
        toast.error('Too many attempts. Please wait a minute.')
      } else {
        toast.error(typeof detail === 'string' ? detail : 'Invalid email or password')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4 grain">
      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <div
            className="relative w-10 h-10 rounded-xl overflow-hidden shrink-0"
            style={{
              background: 'linear-gradient(135deg, #6C63FF 0%, #00F5A0 100%)',
              boxShadow: '0 8px 22px -8px rgba(108,99,255,0.6)',
            }}
          >
            <div className="absolute inset-[1px] rounded-[10px] bg-bg flex items-center justify-center">
              <span className="font-display text-[17px] font-semibold tracking-tight text-grad-indigo">CF</span>
            </div>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-display text-[17px] text-ink tracking-tight">ContentFlow</span>
            <span className="text-[10px] text-faint tracking-[0.14em] uppercase">v 2.4 · alpha</span>
          </div>
        </div>

        <div className="bg-surface border border-line rounded-2xl p-8 shadow-card">
          <h2 className="font-display text-2xl text-ink tracking-tight mb-1">Welcome back</h2>
          <p className="text-sm text-mute mb-6">Sign in to your account</p>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label className="block text-[10px] uppercase tracking-[0.14em] text-faint mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="w-full px-3.5 py-2.5 bg-bg border border-line rounded-lg text-ink placeholder:text-faint text-sm focus:outline-none focus:border-indigo-500/50 transition"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-[0.14em] text-faint mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 pr-10 bg-bg border border-line rounded-lg text-ink placeholder:text-faint text-sm focus:outline-none focus:border-indigo-500/50 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-faint hover:text-mute transition"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-500 text-white rounded-xl font-medium text-sm hover:bg-indigo-400 shadow-glow-indigo disabled:opacity-50 transition"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              Sign in
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-mute">
            Don't have an account?{' '}
            <Link to="/register" className="text-indigo-400 hover:text-indigo-300 font-medium">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
