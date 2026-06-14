import { useState, useRef, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Link as RouterLink, useSearchParams } from 'react-router-dom'
import { Link, Shield, Loader2 as RadarIcon, Radio, Plus, RefreshCw, Trash2, Eye, EyeOff, KeyRound, MoreHorizontal, Pencil, Check, X, Bot, Settings2, Sparkles, AlertCircle, Wifi, WifiOff, Instagram, MessagesSquare, ChevronDown, ShieldCheck } from 'lucide-react'
import { accountsService } from '@/services/accounts.service'
import { facebookService } from '@/services/facebook.service'
import { autoreplyService } from '@/services/autoreply.service'
import PlatformChip, { PLATFORM_META, type PlatformKind } from '@/components/ui/PlatformChip'
import StatusPill from '@/components/ui/StatusPill'
import Avatar from '@/components/ui/Avatar'
import type { Account } from '@/types/account.types'
import type { FacebookPage } from '@/types/facebook.types'

type PlatformKey = 'tiktok' | 'instagram' | 'telegram' | 'facebook'

function SummaryStat({ label, value, sub, icon: Icon, tint }: { label: string; value: string; sub: string; icon: any; tint: string }) {
  return (
    <div className="rounded-2xl bg-surface border border-line p-4 flex items-center gap-4 lift">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${tint}1A`, color: tint, boxShadow: `inset 0 0 0 1px ${tint}33` }}
      >
        <Icon size={16} />
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-[0.16em] text-faint">{label}</div>
        <div className="font-display text-2xl text-ink tnum">{value}</div>
        <div className="text-[11px] text-mute">{sub}</div>
      </div>
    </div>
  )
}

function AddCard({ kind, label, hint, onClick }: { kind: PlatformKey; label: string; hint: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-2xl border border-dashed border-line2/60 hover:border-indigo-500/60 hover:bg-indigo-500/[0.04] transition p-5 flex flex-col items-center justify-center text-center min-h-[180px] group"
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition"
        style={{ background: 'rgba(108,99,255,0.10)', color: '#8B85FF', boxShadow: 'inset 0 0 0 1px rgba(108,99,255,0.25)' }}
      >
        <Plus size={18} />
      </div>
      <div className="text-sm text-ink">{label}</div>
      <div className="text-[11px] text-faint mt-1">{hint}</div>
    </button>
  )
}

function SocialCard({
  account,
  onDisconnect,
  onVerify,
  onRename,
  onOpenTelegramSettings,
}: {
  account: Account
  onDisconnect: () => void
  onVerify: () => void
  onRename: (newName: string) => void
  onOpenTelegramSettings?: () => void
}) {
  const kind = account.platform as PlatformKind
  const p = PLATFORM_META[kind]
  const isTelegram = kind === 'telegram'

  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [nameValue, setNameValue] = useState(account.account_name)
  const menuRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (renaming) inputRef.current?.focus()
  }, [renaming])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function submitRename() {
    const trimmed = nameValue.trim()
    if (!trimmed || trimmed === account.account_name) { setRenaming(false); return }
    onRename(trimmed)
    setRenaming(false)
  }

  return (
    <div
      className="lift relative rounded-2xl bg-surface border border-line p-5 overflow-hidden"
      style={{ boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.02), 0 0 36px -20px ${p.ring}` }}
    >
      <div className="absolute -right-10 -top-10 w-32 h-32 rounded-full blur-3xl opacity-60" style={{ background: p.ring }} />

      <div className="relative flex items-start justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <Avatar name={account.account_name} hue={250} size={44} />
            {isTelegram && (
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-sky-500 flex items-center justify-center border-2 border-surface">
                <Bot size={10} className="text-white" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            {renaming ? (
              <div className="flex items-center gap-1">
                <input
                  ref={inputRef}
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') { setRenaming(false); setNameValue(account.account_name) } }}
                  className="w-full bg-bg border border-indigo-500/50 rounded px-2 py-0.5 text-[14px] text-ink focus:outline-none"
                />
                <button onClick={submitRename} className="p-0.5 text-mint-500 hover:text-mint-400"><Check size={13} /></button>
                <button onClick={() => { setRenaming(false); setNameValue(account.account_name) }} className="p-0.5 text-faint hover:text-ink"><X size={13} /></button>
              </div>
            ) : (
              <div className="text-[15px] text-ink leading-tight truncate">{account.account_name}</div>
            )}
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="text-[12px] text-mute">{p.label}</div>
              {isTelegram && (
                <span className="text-[10px] text-sky-400 bg-sky-500/10 border border-sky-500/20 rounded px-1.5 py-px">Bot</span>
              )}
            </div>
          </div>
        </div>

        {/* Settings menu */}
        <div className="relative shrink-0" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className={`p-1.5 rounded-md transition ${menuOpen ? 'text-ink bg-surface2' : 'text-faint hover:text-ink hover:bg-surface2'}`}
          >
            <MoreHorizontal size={16} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-8 z-20 w-52 rounded-xl bg-surface border border-line shadow-xl py-1.5 overflow-hidden">
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] text-faint border-b border-line mb-1">
                Sozlamalar
              </div>

              {isTelegram && (
                <button
                  onClick={() => { setMenuOpen(false); onOpenTelegramSettings?.() }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-ink hover:bg-surface2 transition"
                >
                  <Settings2 size={13} className="text-mute" />
                  Bot sozlamalari
                </button>
              )}

              <button
                onClick={() => { setMenuOpen(false); setRenaming(true) }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-ink hover:bg-surface2 transition"
              >
                <Pencil size={13} className="text-mute" />
                Nomni o'zgartirish
              </button>

              <button
                onClick={() => { setMenuOpen(false); onVerify() }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-ink hover:bg-surface2 transition"
              >
                <RefreshCw size={13} className="text-mute" />
                Ulanishni tekshirish
              </button>

              <div className="border-t border-line mt-1 pt-1">
                <button
                  onClick={() => { setMenuOpen(false); onDisconnect() }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-rose-400 hover:bg-rose-500/10 transition"
                >
                  <Trash2 size={13} />
                  Uzish
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="relative mt-5 pt-4 border-t border-line flex items-center justify-between gap-2 flex-wrap">
        <StatusPill kind="live">connected</StatusPill>
        <div className="flex items-center gap-1.5">
          {!isTelegram && (
            <RouterLink
              to={`/dashboard/accounts/${account.id}/ai-analyst`}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition"
              style={{ background: '#E1306C1A', color: '#E1306C', boxShadow: 'inset 0 0 0 1px #E1306C33' }}
              title="AI Tahlil"
            >
              <Sparkles size={11} />
              AI Tahlil
            </RouterLink>
          )}
          <button onClick={onVerify} className="p-1.5 rounded-md text-faint hover:text-ink hover:bg-surface2" title="Tekshirish">
            <RefreshCw size={13} />
          </button>
          <button onClick={onDisconnect} className="p-1.5 rounded-md text-faint hover:text-rose-500 hover:bg-rose-500/10" title="Uzish">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Instagram Connect Panel ──────────────────────────────────────────────────
// Ikki xil ulash usuli:
//   1) OAuth (TAVSIYA) — comment/DM ga avtomatik javob + AI tahlil. Parol so'ralmaydi.
//   2) Parol bilan — faqat post qo'yish uchun (eski instagrapi usuli).
function InstagramConnectPanel({ onSuccess }: { onSuccess: () => void }) {
  const [redirecting, setRedirecting] = useState(false)
  const [showPasswordForm, setShowPasswordForm] = useState(false)

  function connectViaOAuth() {
    setRedirecting(true)
    // To'liq sahifa redirect — JWT query param orqali (Facebook OAuth bilan bir xil).
    window.location.href = autoreplyService.instagramOAuthStartUrl()
  }

  return (
    <div className="mt-3 space-y-3">
      {/* ── Usul 1: OAuth (tavsiya etiladi) ── */}
      <div className="p-4 bg-bg rounded-xl border border-indigo-500/30 space-y-3">
        <div className="flex items-center gap-2">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg,#7a1a5a,#f0427a 60%,#ffb056)' }}
          >
            <Instagram size={17} className="text-white" />
          </div>
          <div>
            <div className="text-sm text-ink font-medium flex items-center gap-2">
              Instagram bilan ulash
              <span className="text-[10px] uppercase tracking-wide text-mint-500 bg-mint-500/10 border border-mint-500/20 rounded px-1.5 py-px">
                Tavsiya
              </span>
            </div>
            <div className="text-[11px] text-faint">Comment va DM larga avtomatik javob + AI tahlil uchun</div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-mint-500 bg-mint-500/10 border border-mint-500/20 rounded-lg px-3 py-2">
          <ShieldCheck size={12} className="shrink-0" />
          Parol so'ralmaydi — ruxsatni Instagram'ning o'zida berasiz, faqat token saqlanadi.
        </div>

        <div className="flex items-start gap-2 text-[12px] text-mute leading-relaxed">
          <MessagesSquare size={13} className="shrink-0 mt-0.5 text-indigo-400" />
          <span>
            Bu usul uchun akkaunt <span className="text-ink">Professional</span> (Business yoki Creator) bo'lishi
            va bitta <span className="text-ink">Facebook sahifasiga</span> ulangan bo'lishi kerak. Ulagandan so'ng
            commentlarga avtomatik javob qoidalarini sozlay olasiz.
          </span>
        </div>

        <button
          onClick={connectViaOAuth}
          disabled={redirecting}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg,#7a1a5a,#f0427a 60%,#ffb056)' }}
        >
          {redirecting ? <RadarIcon size={14} className="animate-spin" /> : <Instagram size={14} />}
          {redirecting ? 'Yo\'naltirilmoqda…' : 'Instagram bilan ulash'}
        </button>
      </div>

      {/* ── Usul 2: parol bilan (faqat post uchun) ── */}
      <div className="rounded-xl border border-line bg-bg overflow-hidden">
        <button
          onClick={() => setShowPasswordForm((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-surface2/40 transition"
        >
          <div>
            <div className="text-sm text-ink">Foydalanuvchi nomi va parol bilan ulash</div>
            <div className="text-[11px] text-faint">Faqat post qo'yish uchun — comment javobini ishlatmaydi</div>
          </div>
          <ChevronDown size={16} className={`text-faint transition ${showPasswordForm ? 'rotate-180' : ''}`} />
        </button>
        {showPasswordForm && <InstagramPasswordForm onSuccess={onSuccess} />}
      </div>
    </div>
  )
}

function InstagramPasswordForm({ onSuccess }: { onSuccess: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [needs2fa, setNeeds2fa] = useState(false)
  const [showPass, setShowPass] = useState(false)

  const mutation = useMutation({
    mutationFn: () => accountsService.connectInstagram({
      username,
      password,
      verification_code: needs2fa ? (verificationCode.trim() || undefined) : undefined,
    }),
    onSuccess: () => { toast.success('Instagram akkaunti ulandi'); onSuccess() },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail
      // 2FA only asked when Instagram actually requires it.
      if (err?.response?.status === 409 && detail?.code === 'two_factor_required') {
        setNeeds2fa(true)
        toast.info(detail.message || 'Enter your 2FA code')
        return
      }
      toast.error((typeof detail === 'string' ? detail : detail?.message) || 'Login failed')
    },
  })

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); mutation.mutate() }}
      className="space-y-3 px-4 pb-4 pt-1 border-t border-line"
    >
      <div className="flex items-center gap-2 text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
        <Shield size={12} className="shrink-0" />
        Parolingiz saqlanmaydi — faqat sessiya tokeni saqlanadi.
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-[0.14em] text-faint">Instagram username</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          autoComplete="username"
          placeholder="@yourhandle"
          className="mt-1.5 w-full px-3 py-2.5 bg-surface border border-line rounded-lg text-sm text-ink placeholder:text-faint focus:outline-none focus:border-indigo-500/50 transition"
        />
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-[0.14em] text-faint">Password</label>
        <div className="relative mt-1.5">
          <input
            type={showPass ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className="w-full px-3 py-2.5 pr-10 bg-surface border border-line rounded-lg text-sm text-ink placeholder:text-faint focus:outline-none focus:border-indigo-500/50 transition"
          />
          <button
            type="button"
            onClick={() => setShowPass((v) => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-faint hover:text-ink transition"
          >
            {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </div>
      {needs2fa && (
        <div>
          <label className="text-[10px] uppercase tracking-[0.14em] text-faint">
            2FA code <span className="text-faint/60 normal-case tracking-normal">— from your authenticator app or SMS</span>
          </label>
          <input
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            required
            placeholder="6-digit code"
            className="mt-1.5 w-full px-3 py-2.5 bg-surface border border-indigo-500/40 rounded-lg text-sm text-ink placeholder:text-faint focus:outline-none focus:border-indigo-500/60 transition tracking-widest"
          />
        </div>
      )}
      <button
        type="submit"
        disabled={mutation.isPending}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-500 text-white hover:bg-indigo-400 transition disabled:opacity-50"
      >
        {mutation.isPending ? <RadarIcon size={14} className="animate-spin" /> : <KeyRound size={14} />}
        {mutation.isPending ? 'Kirilmoqda…' : needs2fa ? '2FA kodni yuborish' : 'Instagram ulash'}
      </button>
    </form>
  )
}

const MAX_TG_CHANNELS = 5

type ChannelRow = { id: string; channelId: string; label: string }

function TelegramConnectForm({ onSuccess, existingCount }: { onSuccess: () => void; existingCount: number }) {
  const [step, setStep] = useState<1 | 2>(1)
  const [botToken, setBotToken] = useState('')
  const [botInfo, setBotInfo] = useState<{ bot_name: string; bot_username: string } | null>(null)
  const [validating, setValidating] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const slotsLeft = MAX_TG_CHANNELS - existingCount
  const [channels, setChannels] = useState<ChannelRow[]>([
    { id: crypto.randomUUID(), channelId: '', label: '' },
  ])

  function addChannel() {
    if (channels.length >= slotsLeft) return
    setChannels((c) => [...c, { id: crypto.randomUUID(), channelId: '', label: '' }])
  }

  function removeChannel(id: string) {
    if (channels.length === 1) return
    setChannels((c) => c.filter((r) => r.id !== id))
  }

  function updateChannel(id: string, field: 'channelId' | 'label', value: string) {
    setChannels((c) => c.map((r) => r.id === id ? { ...r, [field]: value } : r))
  }

  async function handleValidateToken(e: React.FormEvent) {
    e.preventDefault()
    setValidating(true)
    try {
      const info = await accountsService.telegramValidateToken(botToken)
      setBotInfo({ bot_name: info.bot_name, bot_username: info.bot_username })
      setStep(2)
      toast.success(`Bot topildi: @${info.bot_username}`)
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Token yaroqsiz')
    } finally {
      setValidating(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const valid = channels.filter((r) => r.channelId.trim())
    if (valid.length === 0) { toast.error("Kamida 1 ta kanal kiriting"); return }

    setSubmitting(true)
    let successCount = 0
    for (const ch of valid) {
      try {
        await accountsService.connect({
          platform: 'telegram',
          account_name: ch.label.trim() || ch.channelId.trim(),
          credentials: { bot_token: botToken, channel_id: ch.channelId.trim() } as any,
        })
        successCount++
      } catch (err: any) {
        toast.error(`${ch.channelId}: ${err?.response?.data?.detail || 'Xato'}`)
      }
    }
    setSubmitting(false)
    if (successCount > 0) {
      toast.success(`${successCount} ta kanal ulandi`)
      onSuccess()
    }
  }

  return (
    <div className="mt-3 p-4 bg-bg rounded-xl border border-line space-y-4">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        <div className={`flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${step >= 1 ? 'bg-indigo-500 text-white' : 'bg-surface2 text-faint'}`}>1</div>
        <span className={`text-[11px] ${step === 1 ? 'text-ink' : 'text-faint'}`}>Bot token</span>
        <div className="flex-1 h-px bg-line" />
        <div className={`flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${step === 2 ? 'bg-indigo-500 text-white' : 'bg-surface2 text-faint'}`}>2</div>
        <span className={`text-[11px] ${step === 2 ? 'text-ink' : 'text-faint'}`}>Kanallar ({slotsLeft} slot)</span>
      </div>

      {/* ── Step 1: token ── */}
      {step === 1 && (
        <form onSubmit={handleValidateToken} className="space-y-3">
          <div className="flex items-center gap-2 text-[11px] text-sky-400 bg-sky-500/10 border border-sky-500/20 rounded-lg px-3 py-2">
            <KeyRound size={12} className="shrink-0" />
            @BotFather dan olgan tokenni kiriting
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.14em] text-faint">Bot Token</label>
            <input
              type="password"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              required
              placeholder="1234567890:AAH..."
              className="mt-1.5 w-full px-3 py-2.5 bg-surface border border-line rounded-lg text-sm text-ink placeholder:text-faint focus:outline-none focus:border-indigo-500/50 transition"
            />
          </div>
          <button
            type="submit"
            disabled={validating || !botToken.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-500 text-white hover:bg-indigo-400 transition disabled:opacity-50"
          >
            {validating ? <RadarIcon size={14} className="animate-spin" /> : <KeyRound size={14} />}
            {validating ? 'Tekshirilmoqda…' : 'Tokenni tekshirish'}
          </button>
        </form>
      )}

      {/* ── Step 2: channels ── */}
      {step === 2 && botInfo && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Bot info */}
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Bot size={14} />
            </div>
            <div>
              <div className="text-sm text-ink font-medium">{botInfo.bot_name}</div>
              <div className="text-[11px] text-faint">@{botInfo.bot_username}</div>
            </div>
            <button type="button" onClick={() => { setStep(1); setBotInfo(null) }}
              className="ml-auto text-[11px] text-faint hover:text-ink underline">
              O'zgartirish
            </button>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            <Shield size={12} className="shrink-0" />
            Botni har bir kanalga admin sifatida qo'shing
          </div>

          {/* Channel rows */}
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-[10px] uppercase tracking-[0.14em] text-faint px-1">
              <span>Kanal ID</span>
              <span>Tavsif (ixtiyoriy)</span>
              <span />
            </div>
            {channels.map((row, idx) => (
              <div key={row.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                <input
                  type="text"
                  value={row.channelId}
                  onChange={(e) => updateChannel(row.id, 'channelId', e.target.value)}
                  placeholder="@channel yoki -100xxx"
                  className="px-3 py-2 bg-surface border border-line rounded-lg text-sm text-ink placeholder:text-faint focus:outline-none focus:border-indigo-500/50 transition"
                />
                <input
                  type="text"
                  value={row.label}
                  onChange={(e) => updateChannel(row.id, 'label', e.target.value)}
                  placeholder={`Kanal ${idx + 1}`}
                  className="px-3 py-2 bg-surface border border-line rounded-lg text-sm text-ink placeholder:text-faint focus:outline-none focus:border-indigo-500/50 transition"
                />
                <button
                  type="button"
                  onClick={() => removeChannel(row.id)}
                  disabled={channels.length === 1}
                  className="p-2 rounded-md text-faint hover:text-rose-400 hover:bg-rose-500/10 transition disabled:opacity-30"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>

          {/* Add row */}
          {channels.length < slotsLeft && (
            <button
              type="button"
              onClick={addChannel}
              className="flex items-center gap-2 text-[12px] text-indigo-400 hover:text-indigo-300 transition"
            >
              <Plus size={13} />
              Kanal qo'shish
              <span className="text-faint">({channels.length}/{slotsLeft})</span>
            </button>
          )}

          <button
            type="submit"
            disabled={submitting || channels.every((r) => !r.channelId.trim())}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-500 text-white hover:bg-indigo-400 transition disabled:opacity-50"
          >
            {submitting ? <RadarIcon size={14} className="animate-spin" /> : <Check size={14} />}
            {submitting ? 'Ulanmoqda…' : `${channels.filter(r => r.channelId.trim()).length} ta kanalni ulash`}
          </button>
        </form>
      )}
    </div>
  )
}

function TelegramConnectModal({
  open,
  existingCount,
  onClose,
  onSuccess,
}: {
  open: boolean
  existingCount: number
  onClose: () => void
  onSuccess: () => void
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm mask-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,680px)] max-h-[88vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-line bg-surface p-5 shadow-card focus:outline-none mask-in">
          <div className="mb-4 flex items-start justify-between gap-4 border-b border-line pb-4">
            <div className="flex items-start gap-3 min-w-0">
              <PlatformChip kind="telegram" size={40} ring />
              <div className="min-w-0">
                <Dialog.Title className="font-display text-2xl text-ink tracking-tight">
                  Telegram bot sozlamalari
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-mute">
                  Bot tokenni tekshiring va kanal IDlarini ulang.
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close className="shrink-0 rounded-lg p-2 text-faint transition hover:bg-surface2 hover:text-ink" aria-label="Modalni yopish">
              <X size={16} />
            </Dialog.Close>
          </div>

          <TelegramConnectForm existingCount={existingCount} onSuccess={onSuccess} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function TelegramBotSettingsModal({
  account,
  open,
  onClose,
}: {
  account: Account | null
  open: boolean
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [channelId, setChannelId] = useState('')
  const [label, setLabel] = useState('')
  const [botToken, setBotToken] = useState('')

  const settingsQuery = useQuery({
    queryKey: ['telegram-settings', account?.id],
    queryFn: () => accountsService.telegramSettings(account!.id),
    enabled: open && !!account,
  })

  useEffect(() => {
    if (open) {
      setChannelId('')
      setLabel('')
      setBotToken('')
    }
  }, [open, account?.id])

  const addChannelMutation = useMutation({
    mutationFn: () => accountsService.telegramAddChannel(account!.id, {
      channel_id: channelId,
      label: label || undefined,
    }),
    onSuccess: (settings) => {
      if (account) queryClient.setQueryData(['telegram-settings', account.id], settings)
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      setChannelId('')
      setLabel('')
      toast.success('Kanal qo\'shildi')
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || 'Kanal qo\'shilmadi'),
  })

  const deleteChannelMutation = useMutation({
    mutationFn: (id: string) => accountsService.disconnect(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      toast.success('Kanal o\'chirildi')
      if (id === account?.id) {
        onClose()
        return
      }
      if (account) queryClient.invalidateQueries({ queryKey: ['telegram-settings', account.id] })
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || 'Kanal o\'chirilmadi'),
  })

  const updateTokenMutation = useMutation({
    mutationFn: () => accountsService.telegramUpdateToken(account!.id, botToken),
    onSuccess: (settings) => {
      if (account) queryClient.setQueryData(['telegram-settings', account.id], settings)
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      setBotToken('')
      toast.success('Bot token yangilandi')
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || 'Token yangilanmadi'),
  })

  function submitChannel(e: React.FormEvent) {
    e.preventDefault()
    if (!channelId.trim()) {
      toast.error('Kanal ID kiriting')
      return
    }
    addChannelMutation.mutate()
  }

  function submitToken(e: React.FormEvent) {
    e.preventDefault()
    if (!botToken.trim()) {
      toast.error('Bot token kiriting')
      return
    }
    updateTokenMutation.mutate()
  }

  const settings = settingsQuery.data
  const channels = settings?.channels ?? []
  const slotsLeft = settings ? settings.max_channels - channels.length : MAX_TG_CHANNELS

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm mask-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(94vw,760px)] max-h-[88vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-line bg-surface p-5 shadow-card focus:outline-none mask-in">
          <div className="mb-4 flex items-start justify-between gap-4 border-b border-line pb-4">
            <div className="flex items-start gap-3 min-w-0">
              <PlatformChip kind="telegram" size={40} ring />
              <div className="min-w-0">
                <Dialog.Title className="font-display text-2xl text-ink tracking-tight">
                  Bot sozlamalari
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-mute">
                  {settings?.bot_username ? `@${settings.bot_username}` : account?.account_name || 'Telegram bot'} kanallarini boshqarish.
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close className="shrink-0 rounded-lg p-2 text-faint transition hover:bg-surface2 hover:text-ink" aria-label="Modalni yopish">
              <X size={16} />
            </Dialog.Close>
          </div>

          {settingsQuery.isLoading ? (
            <div className="flex items-center gap-2 rounded-xl border border-line bg-bg p-4 text-sm text-mute">
              <RadarIcon size={14} className="animate-spin" />
              Kanallar yuklanmoqda
            </div>
          ) : settingsQuery.isError ? (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-500">
              Kanallar ro'yxatini yuklab bo'lmadi.
            </div>
          ) : (
            <div className="space-y-5">
              {!settings?.bot_valid && (
                <div className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-100">
                  <Shield size={15} className="mt-0.5 shrink-0 text-rose-500" />
                  <div>
                    <div className="font-medium text-rose-300">Bot token yaroqsiz</div>
                    <div className="mt-1 text-rose-100/80">
                      Telegram `Unauthorized` qaytaryapti. @BotFather dan yangi token oling yoki to'g'ri bot tokenini kiriting.
                    </div>
                  </div>
                </div>
              )}

              <form onSubmit={submitToken} className="rounded-xl border border-line bg-bg p-4">
                <div className="mb-3">
                  <div className="text-sm font-medium text-ink">Bot tokenni yangilash</div>
                  <div className="text-[11px] text-mute">Token shu botga ulangan barcha kanallar uchun yangilanadi.</div>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
                  <input
                    type="password"
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                    disabled={updateTokenMutation.isPending}
                    placeholder="1234567890:AAH..."
                    className="px-3 py-2.5 bg-surface border border-line rounded-lg text-sm text-ink placeholder:text-faint focus:outline-none focus:border-indigo-500/50 transition disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={updateTokenMutation.isPending || !botToken.trim()}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-surface2 px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-line disabled:opacity-50"
                  >
                    {updateTokenMutation.isPending ? <RadarIcon size={14} className="animate-spin" /> : <KeyRound size={14} />}
                    Yangilash
                  </button>
                </div>
              </form>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-faint">Kanallar ro'yxati</div>
                  <div className="text-[11px] text-mute tnum">
                    {channels.length} / {settings?.max_channels ?? MAX_TG_CHANNELS}
                  </div>
                </div>

                <div className="space-y-2">
                  {channels.map((channel) => (
                    <div key={channel.id} className="flex items-center gap-3 rounded-xl border border-line bg-bg px-3 py-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400">
                        <Bot size={15} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm text-ink">{channel.account_name}</div>
                        <div className="truncate text-[11px] text-faint">{channel.channel_id}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteChannelMutation.mutate(channel.id)}
                        disabled={deleteChannelMutation.isPending}
                        className="rounded-lg p-2 text-faint transition hover:bg-rose-500/10 hover:text-rose-500 disabled:opacity-40"
                        title="Kanalni o'chirish"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <form onSubmit={submitChannel} className="rounded-xl border border-line bg-bg p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-ink">Yangi kanal qo'shish</div>
                    <div className="text-[11px] text-mute">Bot kanalga admin qilingan bo'lishi kerak.</div>
                  </div>
                  <span className="shrink-0 rounded-full border border-line px-2 py-1 text-[11px] text-faint">
                    {Math.max(slotsLeft, 0)} slot
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <input
                    value={channelId}
                    onChange={(e) => setChannelId(e.target.value)}
                    disabled={!settings?.can_add || addChannelMutation.isPending}
                    placeholder="@channel yoki -100xxx"
                    className="px-3 py-2.5 bg-surface border border-line rounded-lg text-sm text-ink placeholder:text-faint focus:outline-none focus:border-indigo-500/50 transition disabled:opacity-50"
                  />
                  <input
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    disabled={!settings?.can_add || addChannelMutation.isPending}
                    placeholder="Kanal nomi"
                    className="px-3 py-2.5 bg-surface border border-line rounded-lg text-sm text-ink placeholder:text-faint focus:outline-none focus:border-indigo-500/50 transition disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={!settings?.can_add || addChannelMutation.isPending || !channelId.trim()}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:opacity-50"
                  >
                    {addChannelMutation.isPending ? <RadarIcon size={14} className="animate-spin" /> : <Plus size={14} />}
                    Qo'shish
                  </button>
                </div>
              </form>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ─── Facebook Connect Button ──────────────────────────────────────────────────

function FacebookConnectButton({ compact = false }: { compact?: boolean }) {
  const [loading, setLoading] = useState(false)

  function handleConnect() {
    setLoading(true)
    // Full-page redirect — JWT via query param (same as IG OAuth pattern)
    window.location.href = facebookService.oauthStartUrl()
  }

  if (compact) {
    return (
      <button
        onClick={handleConnect}
        disabled={loading}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-white transition disabled:opacity-50"
        style={{ background: '#1877F2' }}
      >
        {loading ? <RadarIcon size={13} className="animate-spin" /> : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
        )}
        {loading ? 'Yo\'naltirilmoqda…' : 'Facebook ulash'}
      </button>
    )
  }

  return (
    <div className="mt-3 p-4 bg-bg rounded-xl border border-line space-y-3">
      <div className="flex items-center gap-2 text-[11px] bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2" style={{ color: '#1877F2' }}>
        <Shield size={12} className="shrink-0" />
        Facebook rasmiy OAuth orqali ulanadi — parolingiz saqlanmaydi.
      </div>
      <p className="text-[13px] text-mute">
        Facebook sahifangizni ulash uchun quyidagi tugmani bosing. Facebook sahifasiga yo'naltirilasiz va ruxsat bergandan so'ng avtomatik qaytasiz.
      </p>
      <button
        onClick={handleConnect}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition disabled:opacity-50"
        style={{ background: '#1877F2' }}
      >
        {loading ? <RadarIcon size={14} className="animate-spin" /> : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
        )}
        {loading ? 'Yo\'naltirilmoqda…' : 'Facebook bilan ulash'}
      </button>
    </div>
  )
}

// ─── Facebook Page Picker Dialog ──────────────────────────────────────────────

function FacebookPagePickerDialog({
  sessionKey,
  onClose,
  onSuccess,
}: {
  sessionKey: string
  onClose: () => void
  onSuccess: () => void
}) {
  const qc = useQueryClient()
  const [selectedPageId, setSelectedPageId] = useState<string>('')

  const pagesQuery = useQuery({
    queryKey: ['fb-pages-session', sessionKey],
    queryFn: () => facebookService.getPages(sessionKey),
    retry: false,
  })

  const selectMutation = useMutation({
    mutationFn: () => facebookService.selectPage(sessionKey, selectedPageId),
    onSuccess: (data) => {
      toast.success(`Facebook Page ulandi: ${data.page_name}`)
      qc.invalidateQueries({ queryKey: ['accounts'] })
      onSuccess()
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { detail?: string } } }
      toast.error(e?.response?.data?.detail || 'Sahifani ulashda xato')
    },
  })

  const pages: FacebookPage[] = pagesQuery.data?.pages ?? []

  return (
    <Dialog.Root open onOpenChange={(o) => { if (!o) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,480px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-line bg-surface p-5 shadow-card focus:outline-none">
          <div className="mb-4 flex items-start justify-between gap-4 border-b border-line pb-4">
            <div className="flex items-start gap-3">
              <PlatformChip kind="facebook" size={40} ring />
              <div>
                <Dialog.Title className="font-display text-xl text-ink tracking-tight">
                  Facebook sahifani tanlang
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-mute">
                  Ulashni xohlagan sahifani tanlang.
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close className="shrink-0 rounded-lg p-2 text-faint transition hover:bg-surface2 hover:text-ink" aria-label="Yopish">
              <X size={16} />
            </Dialog.Close>
          </div>

          {pagesQuery.isLoading ? (
            <div className="flex items-center gap-2 text-mute text-sm py-8 justify-center">
              <RadarIcon size={16} className="animate-spin" /> Sahifalar yuklanmoqda…
            </div>
          ) : pagesQuery.isError ? (
            <div className="flex items-center gap-2 text-rose-400 text-sm py-4 bg-rose-500/10 rounded-xl px-4 border border-rose-500/20">
              <AlertCircle size={15} className="shrink-0" />
              Sahifalar ro'yxatini yuklab bo'lmadi. Sessiya muddati o'tgan bo'lishi mumkin.
            </div>
          ) : pages.length === 0 ? (
            <div className="text-center py-6 text-mute text-sm">Sahifalar topilmadi.</div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {pages.map((page) => {
                const picUrl = page.picture?.data?.url
                return (
                  <button
                    key={page.id}
                    onClick={() => setSelectedPageId(page.id)}
                    className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                      selectedPageId === page.id
                        ? 'border-blue-500/60 bg-blue-500/10'
                        : 'border-line hover:border-line2 hover:bg-surface2'
                    }`}
                  >
                    {picUrl ? (
                      <img src={picUrl} alt={page.name} className="w-9 h-9 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#1877F21A', color: '#1877F2' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                        </svg>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-ink truncate">{page.name}</div>
                      <div className="text-[11px] text-faint">{page.id}</div>
                    </div>
                    {selectedPageId === page.id && (
                      <Check size={15} className="shrink-0" style={{ color: '#1877F2' }} />
                    )}
                  </button>
                )
              })}
            </div>
          )}

          <div className="flex justify-end gap-2 mt-4">
            <Dialog.Close asChild>
              <button className="px-4 py-2 rounded-lg text-sm text-mute hover:text-ink transition">
                Bekor qilish
              </button>
            </Dialog.Close>
            <button
              disabled={!selectedPageId || selectMutation.isPending}
              onClick={() => selectMutation.mutate()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition disabled:opacity-50"
              style={{ background: '#1877F2' }}
            >
              {selectMutation.isPending && <RadarIcon size={13} className="animate-spin" />}
              Sahifani ulash
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ─── Facebook Account Card ────────────────────────────────────────────────────

function FacebookCard({
  account,
  onDisconnect,
  onReconnect,
}: {
  account: Account
  onDisconnect: () => void
  onReconnect: () => void
}) {
  const isExpired = account.token_status === 'expired'
  const webhookOk = account.fb_webhook_subscribed === true

  return (
    <div
      className="lift relative rounded-2xl bg-surface border border-line p-5 overflow-hidden"
      style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.02), 0 0 36px -20px rgba(24,119,242,0.45)' }}
    >
      <div className="absolute -right-10 -top-10 w-32 h-32 rounded-full blur-3xl opacity-40" style={{ background: 'rgba(24,119,242,0.5)' }} />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <PlatformChip kind="facebook" size={40} ring />
          <div className="min-w-0">
            <div className="text-[15px] text-ink leading-tight truncate">
              {account.fb_page_name || account.account_name}
            </div>
            <div className="text-[12px] text-mute mt-0.5">Facebook Page</div>
          </div>
        </div>
        {isExpired && (
          <span className="shrink-0 text-[10px] uppercase tracking-wide text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-1.5 py-0.5">
            Token muddati tugagan
          </span>
        )}
      </div>

      <div className="relative mt-4 pt-4 border-t border-line space-y-2">
        {/* Webhook status */}
        <div className="flex items-center gap-1.5 text-[12px]">
          {webhookOk ? (
            <Wifi size={12} className="text-mint-500" />
          ) : (
            <WifiOff size={12} className="text-amber-400" />
          )}
          <span className={webhookOk ? 'text-mint-500' : 'text-amber-400'}>
            {webhookOk ? 'Webhook faol' : 'Webhook ulanmagan'}
          </span>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-2">
          {isExpired ? (
            <StatusPill kind="failed">Token muddati tugagan</StatusPill>
          ) : (
            <StatusPill kind="live">Ulangan</StatusPill>
          )}

          <div className="flex items-center gap-1.5">
            {isExpired && (
              <button
                onClick={onReconnect}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white transition"
                style={{ background: '#1877F2' }}
                title="Qayta ulash"
              >
                <RefreshCw size={11} />
                Qayta ulash
              </button>
            )}
            <button onClick={onDisconnect} className="p-1.5 rounded-md text-faint hover:text-rose-500 hover:bg-rose-500/10" title="Uzish">
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function TikTokConnectForm({ onSuccess }: { onSuccess: () => void }) {
  const [loading, setLoading] = useState(false)

  async function handleConnect() {
    setLoading(true)
    try {
      const { url } = await accountsService.tiktokOAuthInit()
      window.location.href = url
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'TikTok OAuth boshlanmadi')
      setLoading(false)
    }
  }

  return (
    <div className="mt-3 p-4 bg-bg rounded-xl border border-line space-y-3">
      <div className="flex items-center gap-2 text-[11px] text-sky-400 bg-sky-500/10 border border-sky-500/20 rounded-lg px-3 py-2">
        <Shield size={12} className="shrink-0" />
        TikTok rasmiy OAuth orqali ulanadi — parolingiz saqlanmaydi.
      </div>
      <p className="text-[13px] text-mute">
        TikTok hisobingizni ulash uchun quyidagi tugmani bosing. Siz TikTok sahifasiga yo'naltirilasiz va ruxsat bergandan so'ng avtomatik qaytasiz.
      </p>
      <button
        onClick={handleConnect}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-black text-white hover:bg-zinc-800 border border-zinc-700 transition disabled:opacity-50"
      >
        {loading ? <RadarIcon size={14} className="animate-spin" /> : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.93a8.16 8.16 0 004.77 1.52V7.01a4.85 4.85 0 01-1-.32z"/>
          </svg>
        )}
        {loading ? 'Yo\'naltirilmoqda…' : 'TikTok bilan ulash'}
      </button>
    </div>
  )
}

export default function AccountsPage() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState<PlatformKey | null>(null)
  const [telegramSettingsAccount, setTelegramSettingsAccount] = useState<Account | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()

  // Handle Facebook OAuth return params
  const fbSelectPage = searchParams.get('fb_select_page')
  const fbConnected = searchParams.get('connected')
  const fbError = searchParams.get('fb_error')

  useEffect(() => {
    if (fbConnected === 'facebook') {
      toast.success('Facebook Page muvaffaqiyatli ulandi!')
      searchParams.delete('connected')
      setSearchParams(searchParams, { replace: true })
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
    }
    if (fbError === 'no_pages') {
      toast.error('Facebook akkauntingizda boshqaruvchi sahifa topilmadi.')
      searchParams.delete('fb_error')
      setSearchParams(searchParams, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountsService.list(),
  })

  const disconnectMutation = useMutation({
    mutationFn: (id: string) => accountsService.disconnect(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['accounts'] }); toast.success('Ajratildi') },
  })

  const verifyMutation = useMutation({
    mutationFn: (id: string) => accountsService.verify(id),
    onSuccess: (data) => toast(data.valid ? data.message : `Yaroqsiz: ${data.message}`),
  })

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => accountsService.rename(id, name),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['accounts'] }); toast.success('Nom yangilandi') },
    onError: (err: any) => toast.error(err?.response?.data?.detail || 'Nom o\'zgartirish muvaffaqiyatsiz'),
  })

  const totalAccounts = accounts.length
  const openConnectForm = (platform: PlatformKey) => {
    setShowForm((current) => current === platform && platform !== 'telegram' ? null : platform)
  }

  return (
    <div className="page-in px-8 py-6 space-y-8 max-w-[1280px]">
      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-4">
        <SummaryStat label="Ulangan"   value={String(totalAccounts)} sub="jami"                  icon={Link}    tint="#6C63FF" />
        <SummaryStat label="Faol"      value={String(totalAccounts)} sub="tokenlar yaroqli"       icon={Shield}  tint="#00F5A0" />
        <SummaryStat label="Platforma" value="4"                     sub="IG·TikTok·TG·FB"        icon={Radio}   tint="#FFB347" />
        <SummaryStat label="Akkaunt"   value={String(totalAccounts)} sub="barcha platformalar"    icon={RadarIcon} tint="#5BE8FF" />
      </div>

      {/* Facebook Page Picker dialog (triggered by ?fb_select_page= query param) */}
      {fbSelectPage && (
        <FacebookPagePickerDialog
          sessionKey={fbSelectPage}
          onClose={() => {
            searchParams.delete('fb_select_page')
            setSearchParams(searchParams, { replace: true })
          }}
          onSuccess={() => {
            searchParams.delete('fb_select_page')
            setSearchParams(searchParams, { replace: true })
            queryClient.invalidateQueries({ queryKey: ['accounts'] })
          }}
        />
      )}

      {/* Facebook section */}
      {(() => {
        const platform: PlatformKey = 'facebook'
        const p = PLATFORM_META[platform]
        const platformAccounts = accounts.filter((a) => a.platform === platform)
        const maxSlots = 3
        const canAdd = platformAccounts.length < maxSlots

        return (
          <section key={platform}>
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-start gap-3">
                <PlatformChip kind="facebook" size={36} ring />
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="font-display text-2xl text-ink tracking-tight">{p.label}</h2>
                    <span className="text-[10px] uppercase tracking-[0.16em] text-faint border border-line rounded px-2 py-0.5 tnum">
                      {platformAccounts.length} / {maxSlots}
                    </span>
                  </div>
                  <p className="text-sm text-mute mt-1 max-w-xl">
                    Facebook sahifangizni ulang. Commentlarga avtomatik javob berish imkoni ochiladi.
                  </p>
                </div>
              </div>
              {canAdd && (
                <button
                  onClick={() => openConnectForm(platform)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-sm rounded-lg font-medium text-white transition"
                  style={{ background: '#1877F2' }}
                >
                  <Plus size={14} />
                  Facebook ulash
                </button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4">
              {platformAccounts.map((account) => (
                <FacebookCard
                  key={account.id}
                  account={account}
                  onDisconnect={() => disconnectMutation.mutate(account.id)}
                  onReconnect={() => {
                    window.location.href = facebookService.oauthStartUrl()
                  }}
                />
              ))}
              {canAdd && showForm !== 'facebook' && (
                <AddCard
                  kind="facebook"
                  label="+ Facebook ulash"
                  hint={`${platformAccounts.length}/${maxSlots} · OAuth`}
                  onClick={() => openConnectForm('facebook')}
                />
              )}
            </div>

            {showForm === 'facebook' && (
              <FacebookConnectButton />
            )}
          </section>
        )
      })()}

      {(['telegram', 'instagram', 'tiktok'] as PlatformKey[]).map((platform) => {
        const p = PLATFORM_META[platform]
        const platformAccounts = accounts.filter((a) => a.platform === platform)
        const maxSlots = platform === 'telegram' ? MAX_TG_CHANNELS : 3
        const canAdd = platformAccounts.length < maxSlots
        const gridCols = platform === 'telegram' ? 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-5' : 'grid-cols-3'

        return (
          <section key={platform}>
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-start gap-3">
                <PlatformChip kind={platform} size={36} ring />
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="font-display text-2xl text-ink tracking-tight">{p.label}</h2>
                    <span className="text-[10px] uppercase tracking-[0.16em] text-faint border border-line rounded px-2 py-0.5 tnum">
                      {platformAccounts.length} / {maxSlots}
                    </span>
                  </div>
                  <p className="text-sm text-mute mt-1 max-w-xl">
                    {platform === 'telegram' && `Har bir kanal uchun bot ulang. Bir botga ${MAX_TG_CHANNELS} tagacha kanal qo'shish mumkin.`}
                    {platform === 'instagram' && "3 tagacha akkaunt. Commentlarga avtomatik javob uchun “Instagram bilan ulash” (OAuth) ni tanlang — parol so'ralmaydi. Faqat post qo'yish uchun parol bilan ham ulash mumkin."}
                    {platform === 'tiktok' && "3 tagacha akkaunt. Tokenlar har 23 kunda avtomatik yangilanadi — oldindan ogohlantiramiz."}
                  </p>
                </div>
              </div>
              {canAdd && (
                <button
                  onClick={() => openConnectForm(platform)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-sm rounded-lg font-medium bg-surface border border-line text-ink hover:border-line2 hover:bg-surface2 transition"
                >
                  <Plus size={14} />
                  {platform === 'telegram' ? 'Kanal qo\'shish' : 'Add account'}
                </button>
              )}
            </div>

            <div className={`grid ${gridCols} gap-4`}>
              {platformAccounts.map((account) => (
                <SocialCard
                  key={account.id}
                  account={account}
                  onDisconnect={() => disconnectMutation.mutate(account.id)}
                  onVerify={() => verifyMutation.mutate(account.id)}
                  onRename={(name) => renameMutation.mutate({ id: account.id, name })}
                  onOpenTelegramSettings={account.platform === 'telegram' ? () => setTelegramSettingsAccount(account) : undefined}
                />
              ))}
              {canAdd && (
                <AddCard
                  kind={platform}
                  label={platform === 'telegram' ? '+ Kanal qo\'shish' : `+ Add ${p.label}`}
                  hint={
                    platform === 'telegram'
                      ? `${platformAccounts.length}/${maxSlots} · @BotFather token`
                      : platform === 'instagram'
                      ? 'OAuth (comment javob) yoki parol bilan'
                      : `TikTok OAuth · ~30 soniya`
                  }
                  onClick={() => openConnectForm(platform)}
                />
              )}
            </div>

            {showForm === platform && (
              platform === 'instagram'
                ? <InstagramConnectPanel
                    onSuccess={() => {
                      setShowForm(null)
                      queryClient.invalidateQueries({ queryKey: ['accounts'] })
                    }}
                  />
                : platform === 'tiktok'
                ? <TikTokConnectForm
                    onSuccess={() => {
                      setShowForm(null)
                      queryClient.invalidateQueries({ queryKey: ['accounts'] })
                    }}
                  />
                : platform === 'telegram'
                ? <TelegramConnectModal
                    open
                    existingCount={platformAccounts.length}
                    onClose={() => setShowForm(null)}
                    onSuccess={() => {
                      setShowForm(null)
                      queryClient.invalidateQueries({ queryKey: ['accounts'] })
                    }}
                  />
                : null
            )}
          </section>
        )
      })}

      <TelegramBotSettingsModal
        account={telegramSettingsAccount}
        open={!!telegramSettingsAccount}
        onClose={() => setTelegramSettingsAccount(null)}
      />
    </div>
  )
}
