import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Link, Shield, Loader2 as RadarIcon, Radio, Plus, RefreshCw, Trash2, Eye, EyeOff, Copy, ExternalLink, KeyRound, MoreHorizontal } from 'lucide-react'
import { accountsService } from '@/services/accounts.service'
import PlatformChip, { PLATFORM_META, type PlatformKind } from '@/components/ui/PlatformChip'
import StatusPill from '@/components/ui/StatusPill'
import Avatar from '@/components/ui/Avatar'
import type { Account } from '@/types/account.types'

const PLATFORM_CONFIG = {
  telegram: {
    fields: [
      { key: 'bot_token',   label: 'Bot Token',    placeholder: '1234567890:AAH...', type: 'password' },
      { key: 'channel_id',  label: 'Channel ID',   placeholder: '@mychannel or -100123456', type: 'text' },
    ],
  },
  instagram: {
    fields: [
      { key: 'access_token', label: 'Access Token', placeholder: 'Instagram Graph API token', type: 'password' },
      { key: 'account_id',   label: 'Account ID',   placeholder: 'Instagram Business Account ID', type: 'text' },
    ],
  },
  tiktok: {
    fields: [
      { key: 'access_token', label: 'Access Token', placeholder: 'TikTok OAuth access token', type: 'password' },
      { key: 'open_id',      label: 'Open ID',      placeholder: 'TikTok user open_id', type: 'text' },
    ],
  },
} as const

type PlatformKey = keyof typeof PLATFORM_CONFIG

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

function SocialCard({ account, onDisconnect, onVerify }: { account: Account; onDisconnect: () => void; onVerify: () => void }) {
  const kind = account.platform as PlatformKind
  const p = PLATFORM_META[kind]
  return (
    <div
      className="lift relative rounded-2xl bg-surface border border-line p-5 overflow-hidden"
      style={{ boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.02), 0 0 36px -20px ${p.ring}` }}
    >
      <div className="absolute -right-10 -top-10 w-32 h-32 rounded-full blur-3xl opacity-60" style={{ background: p.ring }} />
      <div className="relative flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Avatar name={account.account_name} hue={250} size={44} />
          <div>
            <div className="text-[15px] text-ink leading-tight">{account.account_name}</div>
            <div className="text-[12px] text-mute">{p.label}</div>
          </div>
        </div>
        <button className="p-1.5 rounded-md text-faint hover:text-ink hover:bg-surface2">
          <MoreHorizontal size={16} />
        </button>
      </div>
      <div className="relative mt-5 pt-4 border-t border-line flex items-center justify-between">
        <StatusPill kind="live">connected</StatusPill>
        <div className="flex items-center gap-1">
          <button onClick={onVerify} className="p-1.5 rounded-md text-faint hover:text-ink hover:bg-surface2">
            <RefreshCw size={13} />
          </button>
          <button onClick={onDisconnect} className="p-1.5 rounded-md text-faint hover:text-rose-500 hover:bg-rose-500/10">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}

function ConnectForm({ platform, onSuccess }: { platform: PlatformKey; onSuccess: () => void }) {
  const config = PLATFORM_CONFIG[platform]
  const [accountName, setAccountName] = useState('')
  const [creds, setCreds] = useState<Record<string, string>>({})

  const mutation = useMutation({
    mutationFn: () => accountsService.connect({ platform, account_name: accountName, credentials: creds as any }),
    onSuccess: () => { toast.success(`${PLATFORM_META[platform].label} account connected`); onSuccess() },
    onError: (err: any) => toast.error(err?.response?.data?.detail || 'Connection failed'),
  })

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); mutation.mutate() }}
      className="space-y-3 mt-3 p-4 bg-bg rounded-xl border border-line"
    >
      <div>
        <label className="text-[10px] uppercase tracking-[0.14em] text-faint">Display name</label>
        <input
          value={accountName}
          onChange={(e) => setAccountName(e.target.value)}
          required
          placeholder="My account name"
          className="mt-1.5 w-full px-3 py-2.5 bg-surface border border-line rounded-lg text-sm text-ink placeholder:text-faint focus:outline-none focus:border-indigo-500/50 transition"
        />
      </div>
      {config.fields.map((field) => (
        <div key={field.key}>
          <label className="text-[10px] uppercase tracking-[0.14em] text-faint">{field.label}</label>
          <input
            type={field.type}
            value={creds[field.key] || ''}
            onChange={(e) => setCreds((c) => ({ ...c, [field.key]: e.target.value }))}
            required
            placeholder={field.placeholder}
            className="mt-1.5 w-full px-3 py-2.5 bg-surface border border-line rounded-lg text-sm text-ink placeholder:text-faint focus:outline-none focus:border-indigo-500/50 transition"
          />
        </div>
      ))}
      <button
        type="submit"
        disabled={mutation.isPending}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-500 text-white hover:bg-indigo-400 transition disabled:opacity-50"
      >
        {mutation.isPending && <RadarIcon size={14} className="animate-spin" />}
        Connect
      </button>
    </form>
  )
}

export default function AccountsPage() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState<PlatformKey | null>(null)

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountsService.list(),
  })

  const disconnectMutation = useMutation({
    mutationFn: (id: string) => accountsService.disconnect(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['accounts'] }); toast.success('Account disconnected') },
  })

  const verifyMutation = useMutation({
    mutationFn: (id: string) => accountsService.verify(id),
    onSuccess: (data) => toast(data.valid ? data.message : `Invalid: ${data.message}`),
  })

  const totalAccounts = accounts.length

  return (
    <div className="page-in px-8 py-6 space-y-8 max-w-[1280px]">
      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-4">
        <SummaryStat label="Connected"  value={String(totalAccounts)} sub="of 9 max"            icon={Link}    tint="#6C63FF" />
        <SummaryStat label="Healthy"    value={String(totalAccounts)} sub="all tokens valid"     icon={Shield}  tint="#00F5A0" />
        <SummaryStat label="Platforms"  value="3"                     sub="Instagram·TikTok·TG"  icon={Radio}   tint="#FFB347" />
        <SummaryStat label="Accounts"   value={String(totalAccounts)} sub="across all platforms" icon={RadarIcon} tint="#5BE8FF" />
      </div>

      {(['telegram', 'instagram', 'tiktok'] as PlatformKey[]).map((platform) => {
        const p = PLATFORM_META[platform]
        const platformAccounts = accounts.filter((a) => a.platform === platform)
        const canAdd = platformAccounts.length < 3

        return (
          <section key={platform}>
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-start gap-3">
                <PlatformChip kind={platform} size={36} ring />
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="font-display text-2xl text-ink tracking-tight">{p.label}</h2>
                    <span className="text-[10px] uppercase tracking-[0.16em] text-faint border border-line rounded px-2 py-0.5 tnum">
                      {platformAccounts.length} / 3
                    </span>
                  </div>
                  <p className="text-sm text-mute mt-1 max-w-xl">
                    {platform === 'telegram' && 'Connect a bot per channel. We use a long-lived token to post messages, images, and polls.'}
                    {platform === 'instagram' && 'Up to 3 accounts on the Pro plan. We post via the Graph API — Business or Creator accounts only.'}
                    {platform === 'tiktok' && 'Up to 3 accounts. Tokens refresh automatically every 23 days — we\'ll notify you ahead of time.'}
                  </p>
                </div>
              </div>
              {canAdd && (
                <button
                  onClick={() => setShowForm(showForm === platform ? null : platform)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-sm rounded-lg font-medium bg-surface border border-line text-ink hover:border-line2 hover:bg-surface2 transition"
                >
                  <Plus size={14} />
                  Add account
                </button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4">
              {platformAccounts.map((account) => (
                <SocialCard
                  key={account.id}
                  account={account}
                  onDisconnect={() => disconnectMutation.mutate(account.id)}
                  onVerify={() => verifyMutation.mutate(account.id)}
                />
              ))}
              {canAdd && (
                <AddCard
                  kind={platform}
                  label={`+ Add ${p.label}`}
                  hint={
                    platform === 'telegram'
                      ? 'Paste a bot token from @BotFather'
                      : `Opens ${p.label} OAuth · ~30 seconds`
                  }
                  onClick={() => setShowForm(showForm === platform ? null : platform)}
                />
              )}
            </div>

            {showForm === platform && (
              <ConnectForm
                platform={platform}
                onSuccess={() => {
                  setShowForm(null)
                  queryClient.invalidateQueries({ queryKey: ['accounts'] })
                }}
              />
            )}
          </section>
        )
      })}
    </div>
  )
}
