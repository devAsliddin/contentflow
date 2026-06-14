import { useEffect, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import * as Switch from '@radix-ui/react-switch'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { X, Loader2, Plus, AlertCircle } from 'lucide-react'
import Btn from '@/components/ui/Btn'
import { autoreplyService } from '@/services/autoreply.service'
import type {
  AutoReplyRule,
  AutoReplyRuleInput,
  AutoReplyTarget,
  AutoReplyMatchType,
  CommentAction,
  ReplyMode,
} from '@/types/autoreply.types'

interface Props {
  accountId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  rule?: AutoReplyRule | null // present = edit mode
}

const MATCH_TYPES: { value: AutoReplyMatchType; label: string }[] = [
  { value: 'contains', label: 'Contains' },
  { value: 'exact', label: 'Exact' },
  { value: 'starts_with', label: 'Starts with' },
  { value: 'any', label: "Any (kalit so'zsiz)" },
]

const COMMENT_ACTIONS: { value: CommentAction; label: string }[] = [
  { value: 'reply_public', label: 'Public reply' },
  { value: 'reply_private', label: 'Private DM' },
  { value: 'both', label: 'Both' },
]

const REPLY_LIMIT = 1000

function emptyForm(): AutoReplyRuleInput {
  return {
    name: '',
    target: 'dm',
    match_type: 'contains',
    keywords: [],
    case_sensitive: false,
    reply_text: '',
    comment_action: 'reply_public',
    priority: 0,
    is_active: true,
    platform: 'instagram',
    reply_mode: 'template',
    ai_context: null,
  }
}

export default function RuleEditorDialog({ accountId, open, onOpenChange, rule }: Props) {
  const qc = useQueryClient()
  const [form, setForm] = useState<AutoReplyRuleInput>(emptyForm())
  const [kwDraft, setKwDraft] = useState('')

  useEffect(() => {
    if (open) {
      setForm(
        rule
          ? {
              name: rule.name,
              target: rule.target,
              match_type: rule.match_type,
              keywords: [...rule.keywords],
              case_sensitive: rule.case_sensitive,
              reply_text: rule.reply_text,
              comment_action: rule.comment_action ?? 'reply_public',
              priority: rule.priority,
              is_active: rule.is_active,
              platform: rule.platform || 'instagram',
              reply_mode: rule.reply_mode || 'template',
              ai_context: rule.ai_context ?? null,
            }
          : emptyForm(),
      )
      setKwDraft('')
    }
  }, [open, rule])

  const mutation = useMutation({
    mutationFn: (payload: AutoReplyRuleInput) =>
      rule
        ? autoreplyService.updateRule(rule.id, payload)
        : autoreplyService.createRule(accountId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['autoreply-rules', accountId] })
      toast.success(rule ? 'Qoida yangilandi' : 'Qoida yaratildi')
      onOpenChange(false)
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : 'Saqlashda xato')
    },
  })

  function set<K extends keyof AutoReplyRuleInput>(key: K, value: AutoReplyRuleInput[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function addKeyword() {
    const v = kwDraft.trim()
    if (!v) return
    if (!form.keywords.includes(v)) set('keywords', [...form.keywords, v])
    setKwDraft('')
  }

  function removeKeyword(kw: string) {
    set('keywords', form.keywords.filter((k) => k !== kw))
  }

  function submit() {
    if (!form.name.trim()) return toast.error('Qoida nomini kiriting')
    if (form.reply_mode === 'template' && !form.reply_text.trim())
      return toast.error('Javob matnini kiriting')
    if (form.match_type !== 'any' && form.keywords.length === 0)
      return toast.error('Kamida bitta kalit so\'z qo\'shing')

    const payload: AutoReplyRuleInput = {
      ...form,
      comment_action: form.target === 'comment' ? form.comment_action : null,
      keywords: form.match_type === 'any' ? [] : form.keywords,
      reply_text: form.reply_mode === 'ai' ? '' : form.reply_text,
      ai_context: form.reply_mode === 'ai' ? (form.ai_context || null) : null,
    }
    mutation.mutate(payload)
  }

  const inputCls =
    'w-full px-3 py-2 bg-bg border border-line rounded-lg text-ink placeholder:text-faint text-sm focus:outline-none focus:border-indigo-500/50 transition'
  const labelCls = 'block text-[10px] uppercase tracking-[0.14em] text-faint mb-1.5'
  const keywordsDisabled = form.match_type === 'any'

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[min(94vw,560px)] max-h-[90vh] overflow-y-auto bg-surface border border-line rounded-2xl shadow-card p-6">
          <div className="flex items-center justify-between mb-5">
            <Dialog.Title className="font-display text-xl text-ink">
              {rule ? 'Qoidani tahrirlash' : 'Yangi qoida'}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="text-faint hover:text-ink transition" aria-label="Close">
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-4">
            <div>
              <label className={labelCls}>Qoida nomi</label>
              <input
                className={inputCls}
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Masalan: Narx so'rovlari"
              />
            </div>

            {/* Target segmented control */}
            <div>
              <label className={labelCls}>Qayerga</label>
              <div className="inline-flex rounded-lg border border-line p-0.5 bg-bg">
                {(['dm', 'comment'] as AutoReplyTarget[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => set('target', t)}
                    className={`px-4 py-1.5 rounded-md text-sm transition ${
                      form.target === t ? 'bg-indigo-500 text-white' : 'text-mute hover:text-ink'
                    }`}
                  >
                    {t === 'dm' ? 'Direct Message' : 'Comment'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className={labelCls}>Moslik turi</label>
              <select
                className={inputCls}
                value={form.match_type}
                onChange={(e) => set('match_type', e.target.value as AutoReplyMatchType)}
              >
                {MATCH_TYPES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {!keywordsDisabled && (
              <div>
                <label className={labelCls}>Kalit so'zlar</label>
                <div className="flex gap-2">
                  <input
                    className={inputCls}
                    value={kwDraft}
                    onChange={(e) => setKwDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addKeyword()
                      }
                    }}
                    placeholder="So'z yozib Enter bosing"
                  />
                  <Btn variant="ghost" icon={Plus} onClick={addKeyword} type="button">
                    Qo'shish
                  </Btn>
                </div>
                {form.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {form.keywords.map((kw) => (
                      <span
                        key={kw}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-indigo-500/10 text-indigo-300 text-xs"
                      >
                        {kw}
                        <button onClick={() => removeKeyword(kw)} className="hover:text-white">
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm text-mute">Katta-kichik harfga sezgir (case sensitive)</span>
              <Switch.Root
                checked={form.case_sensitive}
                onCheckedChange={(v) => set('case_sensitive', v)}
                className="w-9 h-5 rounded-full bg-line data-[state=checked]:bg-indigo-500 relative transition"
              >
                <Switch.Thumb className="block w-4 h-4 bg-white rounded-full translate-x-0.5 data-[state=checked]:translate-x-[18px] transition-transform" />
              </Switch.Root>
            </label>

            {/* V6: reply_mode switch */}
            <div>
              <label className={labelCls}>Javob usuli</label>
              <div className="inline-flex rounded-lg border border-line p-0.5 bg-bg">
                {(['template', 'ai'] as ReplyMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => set('reply_mode', mode)}
                    className={`px-4 py-1.5 rounded-md text-sm transition ${
                      form.reply_mode === mode ? 'bg-indigo-500 text-white' : 'text-mute hover:text-ink'
                    }`}
                  >
                    {mode === 'template' ? 'Tayyor matn' : 'AI javob'}
                  </button>
                ))}
              </div>
            </div>

            {form.reply_mode === 'template' ? (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={labelCls + ' mb-0'}>Javob matni</label>
                  <span className={`text-[10px] ${form.reply_text.length > REPLY_LIMIT ? 'text-rose-500' : 'text-faint'}`}>
                    {form.reply_text.length}/{REPLY_LIMIT}
                  </span>
                </div>
                <textarea
                  className={inputCls + ' min-h-[90px] resize-y'}
                  value={form.reply_text}
                  maxLength={REPLY_LIMIT}
                  onChange={(e) => set('reply_text', e.target.value)}
                  placeholder="Avtomatik yuboriladigan javob..."
                />
              </div>
            ) : (
              <div>
                {/* AI javob ogohlantirish banneri */}
                <div className="flex items-start gap-2 text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mb-3">
                  <AlertCircle size={13} className="shrink-0 mt-0.5" />
                  <span>
                    AI javoblari akkaunt toningizda yoziladi. Natijalarni Loglar bo'limida kuzating.
                  </span>
                </div>
                <label className={labelCls}>AI kontekst (ixtiyoriy)</label>
                <textarea
                  className={inputCls + ' min-h-[80px] resize-y'}
                  value={form.ai_context || ''}
                  onChange={(e) => set('ai_context', e.target.value || null)}
                  placeholder="Masalan: Faqat mahsulot haqida javob ber. Narx so'ralsa, DM ga yo'nalt..."
                />
                <p className="text-[11px] text-faint mt-1">
                  Bu matn AI ga qo'shimcha ko'rsatma sifatida beriladi.
                </p>
              </div>
            )}

            {form.target === 'comment' && (
              <div>
                <label className={labelCls}>Comment harakati</label>
                <select
                  className={inputCls}
                  value={form.comment_action ?? 'reply_public'}
                  onChange={(e) => set('comment_action', e.target.value as CommentAction)}
                >
                  {COMMENT_ACTIONS.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className={labelCls} title="Yuqori raqam birinchi tekshiriladi">
                Priority
              </label>
              <input
                type="number"
                className={inputCls}
                value={form.priority}
                onChange={(e) => set('priority', Number(e.target.value) || 0)}
              />
              <p className="text-[11px] text-faint mt-1">Yuqori raqam birinchi tekshiriladi.</p>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Dialog.Close asChild>
              <Btn variant="quiet" type="button">Bekor qilish</Btn>
            </Dialog.Close>
            <Btn variant="primary" onClick={submit} disabled={mutation.isPending} type="button">
              {mutation.isPending && <Loader2 size={14} className="animate-spin" />}
              Saqlash
            </Btn>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
