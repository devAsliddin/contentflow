import { useState } from 'react'
import { toast } from 'sonner'
import { Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react'
import { api } from '@/services/api'

function passwordIssues(pw: string): string | null {
  if (pw.length < 8) return 'Kamida 8 ta belgi'
  if (!/[A-Z]/.test(pw)) return 'Kamida bitta katta harf'
  if (!/[0-9]/.test(pw)) return 'Kamida bitta raqam'
  if (!/[!@#$%^&*(),.?":{}|<>_\-]/.test(pw)) return 'Kamida bitta maxsus belgi'
  return null
}

export default function SettingsPage() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [saving, setSaving] = useState(false)

  const issue = next ? passwordIssues(next) : null
  const mismatch = confirm.length > 0 && next !== confirm
  const canSubmit =
    current.length > 0 && next.length > 0 && confirm.length > 0 && !issue && !mismatch && !saving

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSaving(true)
    try {
      await api.post('/auth/change-password', {
        current_password: current,
        new_password: next,
      })
      toast.success('Parol o’zgartirildi')
      setCurrent('')
      setNext('')
      setConfirm('')
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Parolni o’zgartirib bo’lmadi')
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    'w-full bg-bg border border-line rounded-lg px-3 py-2 text-sm text-ink placeholder:text-faint focus:outline-none focus:border-indigo-500/50 transition'

  return (
    <div className="page-in px-8 py-6 max-w-xl">
      <div className="rounded-2xl bg-surface border border-line p-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <KeyRound size={16} className="text-indigo-400" />
          </div>
          <div>
            <h2 className="font-display text-lg text-ink leading-tight">Parolni o&rsquo;zgartirish</h2>
            <p className="text-xs text-mute">Hisobingiz xavfsizligi uchun kuchli parol tanlang.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-[11px] uppercase tracking-[0.18em] text-faint mb-1.5">
              Joriy parol
            </label>
            <input
              type={show ? 'text' : 'password'}
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-[0.18em] text-faint mb-1.5">
              Yangi parol
            </label>
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                value={next}
                onChange={(e) => setNext(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-mute hover:text-ink transition"
                title={show ? 'Yashirish' : 'Ko’rsatish'}
              >
                {show ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {issue && <p className="mt-1 text-xs text-rose-400">{issue}</p>}
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-[0.18em] text-faint mb-1.5">
              Yangi parolni tasdiqlang
            </label>
            <input
              type={show ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              className={inputClass}
            />
            {mismatch && <p className="mt-1 text-xs text-rose-400">Parollar mos kelmadi</p>}
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg font-medium bg-indigo-500 text-white hover:bg-indigo-400 shadow-glow-indigo transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Parolni yangilash
          </button>
        </form>
      </div>
    </div>
  )
}
