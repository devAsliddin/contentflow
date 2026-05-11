import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Trash2, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { accountsService } from '@/services/accounts.service'
import { cn } from '@/utils/cn'
import type { Account } from '@/types/account.types'
import type { Platform } from '@/types/post.types'

const PLATFORM_CONFIG = {
  telegram: {
    label: 'Telegram',
    color: '#229ED9',
    fields: [
      { key: 'bot_token', label: 'Bot Token', placeholder: '1234567890:AAH...', type: 'password' },
      { key: 'channel_id', label: 'Channel ID', placeholder: '@mychannel or -100123456', type: 'text' },
    ],
  },
  instagram: {
    label: 'Instagram',
    color: '#E1306C',
    fields: [
      { key: 'access_token', label: 'Access Token', placeholder: 'Instagram Graph API token', type: 'password' },
      { key: 'account_id', label: 'Account ID', placeholder: 'Instagram Business Account ID', type: 'text' },
    ],
  },
  tiktok: {
    label: 'TikTok',
    color: '#69C9D0',
    fields: [
      { key: 'access_token', label: 'Access Token', placeholder: 'TikTok OAuth access token', type: 'password' },
      { key: 'open_id', label: 'Open ID', placeholder: 'TikTok user open_id', type: 'text' },
    ],
  },
} as const

type PlatformKey = keyof typeof PLATFORM_CONFIG

function AccountCard({ account, onDisconnect, onVerify }: { account: Account; onDisconnect: (id: string) => void; onVerify: (id: string) => void }) {
  const config = PLATFORM_CONFIG[account.platform as PlatformKey]
  return (
    <div
      className="bg-card border rounded-xl p-4 transition-all"
      style={{ borderColor: `${config.color}40` }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm" style={{ backgroundColor: `${config.color}20`, color: config.color }}>
            {account.account_name[0].toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{account.account_name}</p>
            <p className="text-xs text-muted-foreground">{config.label}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => onVerify(account.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
            <CheckCircle2 size={15} />
          </button>
          <button onClick={() => onDisconnect(account.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
            <Trash2 size={15} />
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
    mutationFn: () => accountsService.connect({
      platform,
      account_name: accountName,
      credentials: creds as any,
    }),
    onSuccess: () => {
      toast.success(`${config.label} account connected`)
      onSuccess()
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || 'Connection failed'),
  })

  return (
    <form onSubmit={(e) => { e.preventDefault(); mutation.mutate() }} className="space-y-3 mt-3 p-4 bg-background rounded-xl border border-border">
      <div>
        <label className="text-xs font-medium text-muted-foreground">Display name</label>
        <input
          value={accountName}
          onChange={(e) => setAccountName(e.target.value)}
          required
          placeholder="My account name"
          className="mt-1 w-full px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>
      {config.fields.map((field) => (
        <div key={field.key}>
          <label className="text-xs font-medium text-muted-foreground">{field.label}</label>
          <input
            type={field.type}
            value={creds[field.key] || ''}
            onChange={(e) => setCreds((c) => ({ ...c, [field.key]: e.target.value }))}
            required
            placeholder={field.placeholder}
            className="mt-1 w-full px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      ))}
      <button
        type="submit"
        disabled={mutation.isPending}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
        style={{ backgroundColor: config.color }}
      >
        {mutation.isPending && <Loader2 size={14} className="animate-spin" />}
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      toast.success('Account disconnected')
    },
  })

  const verifyMutation = useMutation({
    mutationFn: (id: string) => accountsService.verify(id),
    onSuccess: (data) => toast(data.valid ? data.message : `Invalid: ${data.message}`),
  })

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Connected Accounts</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Manage up to 3 accounts per platform</p>
      </div>

      {(['telegram', 'instagram', 'tiktok'] as PlatformKey[]).map((platform) => {
        const config = PLATFORM_CONFIG[platform]
        const platformAccounts = accounts.filter((a) => a.platform === platform)
        const canAdd = platformAccounts.length < 3

        return (
          <div key={platform} className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: config.color }} />
                <h3 className="text-sm font-semibold text-foreground">{config.label}</h3>
                <span className="text-xs text-muted-foreground">({platformAccounts.length}/3)</span>
              </div>
              {canAdd && (
                <button
                  onClick={() => setShowForm(showForm === platform ? null : platform)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
                >
                  <Plus size={12} /> Add
                </button>
              )}
            </div>

            {platformAccounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                onDisconnect={(id) => disconnectMutation.mutate(id)}
                onVerify={(id) => verifyMutation.mutate(id)}
              />
            ))}

            {platformAccounts.length === 0 && showForm !== platform && (
              <p className="text-xs text-muted-foreground py-2">No {config.label} accounts connected</p>
            )}

            {showForm === platform && (
              <ConnectForm
                platform={platform}
                onSuccess={() => {
                  setShowForm(null)
                  queryClient.invalidateQueries({ queryKey: ['accounts'] })
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
