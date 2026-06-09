import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import StatusPill from '@/components/ui/StatusPill'
import { autoreplyService } from '@/services/autoreply.service'
import type { AutoReplyStatus } from '@/types/autoreply.types'

const STATUS_KIND: Record<AutoReplyStatus, string> = {
  sent: 'live',
  failed: 'failed',
  skipped_no_match: 'draft',
  skipped_rate_limit: 'draft',
  skipped_24h: 'draft',
  skipped_self: 'draft',
}

const STATUS_LABEL: Record<AutoReplyStatus, string> = {
  sent: 'Sent',
  failed: 'Failed',
  skipped_no_match: 'No match',
  skipped_rate_limit: 'Rate limit',
  skipped_24h: '24h window',
  skipped_self: 'Self',
}

export default function AutoReplyLogsPanel({ accountId }: { accountId: string }) {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['autoreply-logs', accountId],
    queryFn: () => autoreplyService.listLogs(accountId, 50),
    refetchInterval: 15000,
  })

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-mute text-sm py-8 justify-center">
        <Loader2 size={16} className="animate-spin" /> Yuklanmoqda...
      </div>
    )
  }

  if (!logs || logs.length === 0) {
    return <p className="text-sm text-faint py-8 text-center">Hali avtomatik javoblar yo'q.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-[0.14em] text-faint text-left">
            <th className="py-2 pr-3 font-medium">Vaqt</th>
            <th className="py-2 pr-3 font-medium">Tur</th>
            <th className="py-2 pr-3 font-medium">Kelgan matn</th>
            <th className="py-2 pr-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="border-t border-line align-top">
              <td className="py-2.5 pr-3 text-faint whitespace-nowrap text-xs">
                {new Date(log.created_at).toLocaleString()}
              </td>
              <td className="py-2.5 pr-3 text-mute uppercase text-xs">{log.event_type}</td>
              <td className="py-2.5 pr-3 text-ink max-w-[280px] truncate" title={log.incoming_text ?? ''}>
                {log.incoming_text || <span className="text-faint">—</span>}
                {log.error_detail && (
                  <span className="block text-[11px] text-rose-400 truncate" title={log.error_detail}>
                    {log.error_detail}
                  </span>
                )}
              </td>
              <td className="py-2.5 pr-3">
                <StatusPill kind={STATUS_KIND[log.status] || 'draft'}>
                  {STATUS_LABEL[log.status] || log.status}
                </StatusPill>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
