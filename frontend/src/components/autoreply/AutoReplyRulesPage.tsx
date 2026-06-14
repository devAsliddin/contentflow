import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, MessageSquare, MessagesSquare, Loader2, ScrollText } from 'lucide-react'
import * as Switch from '@radix-ui/react-switch'
import Btn from '@/components/ui/Btn'
import { accountsService } from '@/services/accounts.service'
import { autoreplyService } from '@/services/autoreply.service'
import RuleEditorDialog from './RuleEditorDialog'
import ConnectInstagramButton from './ConnectInstagramButton'
import AutoReplyLogsPanel from './AutoReplyLogsPanel'
import type { AutoReplyRule } from '@/types/autoreply.types'

type PlatformFilter = 'instagram' | 'facebook'

export default function AutoReplyRulesPage() {
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const [accountId, setAccountId] = useState<string>('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<AutoReplyRule | null>(null)
  const [showLogs, setShowLogs] = useState(false)
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('instagram')

  // Toast on OAuth return
  useEffect(() => {
    if (params.get('connected') === 'instagram') {
      toast.success('Instagram muvaffaqiyatli ulandi!')
      params.delete('connected')
      setParams(params, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { data: allAccounts, isLoading: accLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountsService.list(),
  })

  // IG: accounts with ig_user_id; FB: platform='facebook' accounts
  const igAccounts = useMemo(
    () => (allAccounts || []).filter((a) => a.platform === 'instagram' && a.ig_user_id),
    [allAccounts]
  )
  const fbAccounts = useMemo(
    () => (allAccounts || []).filter((a) => a.platform === 'facebook'),
    [allAccounts]
  )

  const connected = platformFilter === 'instagram' ? igAccounts : fbAccounts

  useEffect(() => {
    setAccountId('')
  }, [platformFilter])

  useEffect(() => {
    if (!accountId && connected.length > 0) setAccountId(connected[0].id)
  }, [connected, accountId])

  const { data: rules, isLoading: rulesLoading } = useQuery({
    queryKey: ['autoreply-rules', accountId],
    queryFn: () => autoreplyService.listRules(accountId),
    enabled: !!accountId,
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      autoreplyService.updateRule(id, { is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['autoreply-rules', accountId] }),
    onError: () => toast.error('Holatni o‘zgartirib bo‘lmadi'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => autoreplyService.deleteRule(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['autoreply-rules', accountId] })
      toast.success('Qoida o‘chirildi')
    },
    onError: () => toast.error('O‘chirib bo‘lmadi'),
  })

  function openNew() {
    setEditing(null)
    setEditorOpen(true)
  }

  function openEdit(rule: AutoReplyRule) {
    setEditing(rule)
    setEditorOpen(true)
  }

  if (accLoading) {
    return (
      <div className="flex items-center gap-2 text-mute text-sm py-16 justify-center">
        <Loader2 size={16} className="animate-spin" /> Yuklanmoqda...
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="font-display text-2xl text-ink tracking-tight">Avtomatik javob</h1>
          <p className="text-sm text-mute mt-1">
            DM va commentlarga kalit so'z asosida avtomatik javob bering.
          </p>
        </div>
        {platformFilter === 'instagram' && connected.length > 0 && <ConnectInstagramButton compact />}
      </div>

      {/* Platform tab filter: IG | FB */}
      <div className="inline-flex rounded-lg border border-line p-0.5 bg-bg mb-5">
        {(['instagram', 'facebook'] as PlatformFilter[]).map((pf) => (
          <button
            key={pf}
            onClick={() => setPlatformFilter(pf)}
            className={`px-4 py-1.5 rounded-md text-sm transition ${
              platformFilter === pf ? 'bg-indigo-500 text-white' : 'text-mute hover:text-ink'
            }`}
          >
            {pf === 'instagram' ? 'Instagram' : 'Facebook'}
          </button>
        ))}
      </div>

      {connected.length === 0 ? (
        platformFilter === 'instagram' ? (
          <ConnectInstagramButton />
        ) : (
          <div className="bg-surface border border-line rounded-2xl p-10 text-center">
            <p className="text-mute text-sm mb-4">
              Facebook sahifasi ulanmagan. Avval Accounts sahifasidan Facebook sahifangizni ulang.
            </p>
          </div>
        )
      ) : (
        <>
          {/* Account selector + actions */}
          <div className="flex flex-wrap items-center gap-3 mb-5">
            {connected.length > 1 && (
              <select
                className="px-3 py-2 bg-bg border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-indigo-500/50"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              >
                {connected.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.account_name}
                  </option>
                ))}
              </select>
            )}
            <div className="flex-1" />
            <Btn variant="ghost" icon={ScrollText} onClick={() => setShowLogs((v) => !v)}>
              {showLogs ? 'Qoidalar' : 'Loglar'}
            </Btn>
            {!showLogs && (
              <Btn variant="primary" icon={Plus} onClick={openNew}>
                Yangi qoida
              </Btn>
            )}
          </div>

          {showLogs ? (
            <div className="bg-surface border border-line rounded-2xl p-5">
              <AutoReplyLogsPanel accountId={accountId} />
            </div>
          ) : rulesLoading ? (
            <div className="flex items-center gap-2 text-mute text-sm py-12 justify-center">
              <Loader2 size={16} className="animate-spin" /> Yuklanmoqda...
            </div>
          ) : !rules || rules.length === 0 ? (
            <div className="bg-surface border border-line rounded-2xl p-10 text-center">
              <p className="text-mute text-sm mb-4">Hali qoida yo'q. Birinchi qoidani yarating.</p>
              <Btn variant="primary" icon={Plus} onClick={openNew}>
                Yangi qoida
              </Btn>
            </div>
          ) : (
            <div className="grid gap-3">
              {rules.map((rule) => (
                <RuleCard
                  key={rule.id}
                  rule={rule}
                  onToggle={(is_active) => toggleMutation.mutate({ id: rule.id, is_active })}
                  onEdit={() => openEdit(rule)}
                  onDelete={() => {
                    if (confirm(`"${rule.name}" qoidasini o'chirilsinmi?`)) deleteMutation.mutate(rule.id)
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}

      {accountId && (
        <RuleEditorDialog
          accountId={accountId}
          open={editorOpen}
          onOpenChange={setEditorOpen}
          rule={editing}
        />
      )}
    </div>
  )
}

function RuleCard({
  rule,
  onToggle,
  onEdit,
  onDelete,
}: {
  rule: AutoReplyRule
  onToggle: (active: boolean) => void
  onEdit: () => void
  onDelete: () => void
}) {
  const TargetIcon = rule.target === 'dm' ? MessageSquare : MessagesSquare
  const platform = rule.platform || 'instagram'
  const replyMode = rule.reply_mode || 'template'
  return (
    <div className="bg-surface border border-line rounded-xl p-4 flex items-start gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <span className="font-medium text-ink truncate">{rule.name}</span>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-bg border border-line text-[10px] uppercase tracking-wide text-mute">
            <TargetIcon size={11} />
            {rule.target}
          </span>
          <span className="text-[10px] uppercase tracking-wide text-faint">{rule.match_type}</span>
          {/* V6: platform badge */}
          <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide ${
            platform === 'facebook'
              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
              : 'bg-pink-500/10 text-pink-400 border border-pink-500/20'
          }`}>
            {platform === 'facebook' ? 'FB' : 'IG'}
          </span>
          {/* V6: reply_mode badge */}
          <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide ${
            replyMode === 'ai'
              ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
              : 'bg-bg border border-line text-faint'
          }`}>
            {replyMode === 'ai' ? 'AI' : 'Tayyor'}
          </span>
          {rule.priority !== 0 && (
            <span className="text-[10px] text-faint">P{rule.priority}</span>
          )}
        </div>
        {rule.keywords.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1.5">
            {rule.keywords.map((kw) => (
              <span key={kw} className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 text-[11px]">
                {kw}
              </span>
            ))}
          </div>
        )}
        <p className="text-sm text-mute line-clamp-2">{rule.reply_text}</p>
      </div>
      <div className="flex flex-col items-end gap-2 shrink-0">
        <Switch.Root
          checked={rule.is_active}
          onCheckedChange={onToggle}
          className="w-9 h-5 rounded-full bg-line data-[state=checked]:bg-mint-500 relative transition"
          aria-label="Faollik"
        >
          <Switch.Thumb className="block w-4 h-4 bg-white rounded-full translate-x-0.5 data-[state=checked]:translate-x-[18px] transition-transform" />
        </Switch.Root>
        <div className="flex gap-1">
          <button onClick={onEdit} className="p-1.5 text-faint hover:text-ink transition" aria-label="Tahrirlash">
            <Pencil size={14} />
          </button>
          <button onClick={onDelete} className="p-1.5 text-faint hover:text-rose-500 transition" aria-label="O'chirish">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
