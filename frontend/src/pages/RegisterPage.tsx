import { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Loader2, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react'
import { useAuthStore } from '@/store'

type Rule = { label: string; test: (p: string) => boolean }

const PASSWORD_RULES: Rule[] = [
  { label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { label: 'One uppercase letter (A–Z)', test: (p) => /[A-Z]/.test(p) },
  { label: 'One number (0–9)', test: (p) => /[0-9]/.test(p) },
  { label: 'One special character (!@#…)', test: (p) => /[!@#$%^&*(),.?":{}|<>_\-]/.test(p) },
]

function strengthScore(password: string): number {
  return PASSWORD_RULES.filter((r) => r.test(password)).length
}

const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong']
const STRENGTH_COLORS = ['', 'bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-emerald-500']

export default function RegisterPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [loading, setLoading] = useState(false)
  const register = useAuthStore((s) => s.register)
  const navigate = useNavigate()

  const score = useMemo(() => strengthScore(password), [password])
  const allRulesPassed = score === PASSWORD_RULES.length

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const trimmedName = fullName.trim()
    const trimmedEmail = email.trim().toLowerCase()

    if (trimmedName.length < 2) {
      toast.error('Full name must be at least 2 characters')
      return
    }
    if (!allRulesPassed) {
      toast.error('Password does not meet requirements')
      return
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      await register(trimmedEmail, password, trimmedName)
      navigate('/dashboard')
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      if (err?.response?.status === 429) {
        toast.error('Too many attempts. Please wait a minute.')
      } else if (Array.isArray(detail)) {
        toast.error(detail.map((d: any) => d.msg).join(', '))
      } else {
        toast.error(typeof detail === 'string' ? detail : 'Registration failed')
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
          <h2 className="font-display text-2xl text-ink tracking-tight mb-1">Get started</h2>
          <p className="text-sm text-mute mb-6">Create your account</p>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Full name */}
            <div>
              <label className="block text-[10px] uppercase tracking-[0.14em] text-faint mb-1.5">
                Full name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoComplete="name"
                placeholder="John Doe"
                className="w-full px-3.5 py-2.5 bg-bg border border-line rounded-lg text-ink placeholder:text-faint text-sm focus:outline-none focus:border-indigo-500/50 transition"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-[10px] uppercase tracking-[0.14em] text-faint mb-1.5">
                Email <span className="text-red-400">*</span>
              </label>
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

            {/* Password */}
            <div>
              <label className="block text-[10px] uppercase tracking-[0.14em] text-faint mb-1.5">
                Password <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  required
                  autoComplete="new-password"
                  placeholder="Create a strong password"
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

              {/* Strength bar */}
              {password.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  <div className="flex gap-1">
                    {PASSWORD_RULES.map((_, i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                          i < score ? STRENGTH_COLORS[score] : 'bg-line'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-[10px] text-faint">
                    Strength:{' '}
                    <span className={score >= 3 ? 'text-emerald-400' : score >= 2 ? 'text-yellow-400' : 'text-red-400'}>
                      {STRENGTH_LABELS[score]}
                    </span>
                  </p>
                </div>
              )}

              {/* Rules checklist */}
              {(passwordFocused || password.length > 0) && (
                <ul className="mt-2 space-y-1">
                  {PASSWORD_RULES.map((rule) => {
                    const passed = rule.test(password)
                    return (
                      <li key={rule.label} className="flex items-center gap-1.5">
                        {passed ? (
                          <CheckCircle2 size={11} className="text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle size={11} className="text-faint shrink-0" />
                        )}
                        <span className={`text-[10px] ${passed ? 'text-emerald-400' : 'text-faint'}`}>
                          {rule.label}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            {/* Confirm password */}
            <div>
              <label className="block text-[10px] uppercase tracking-[0.14em] text-faint mb-1.5">
                Confirm password <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="Repeat your password"
                  className={`w-full px-3.5 py-2.5 pr-10 bg-bg border rounded-lg text-ink placeholder:text-faint text-sm focus:outline-none transition ${
                    confirmPassword.length > 0
                      ? password === confirmPassword
                        ? 'border-emerald-500/50 focus:border-emerald-500/70'
                        : 'border-red-500/50 focus:border-red-500/70'
                      : 'border-line focus:border-indigo-500/50'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-faint hover:text-mute transition"
                  tabIndex={-1}
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                >
                  {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {confirmPassword.length > 0 && password !== confirmPassword && (
                <p className="mt-1 text-[10px] text-red-400">Passwords do not match</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !allRulesPassed || password !== confirmPassword}
              className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-500 text-white rounded-xl font-medium text-sm hover:bg-indigo-400 shadow-glow-indigo disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              Create account
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-mute">
            Already have an account?{' '}
            <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
