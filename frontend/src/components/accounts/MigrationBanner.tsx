import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, X } from 'lucide-react'
import { useState, useEffect } from 'react'
import { workflowsService } from '@/services/workflows.service'

/**
 * V2-ACC-003 — Migration notice banner.
 * Only shown when account credentials are genuinely missing/broken.
 * Auto-silently migrates legacy accounts that have valid credentials.
 */
export default function MigrationBanner() {
  const queryClient = useQueryClient()
  const [dismissed, setDismissed] = useState(false)

  const { data } = useQuery({
    queryKey: ['migration-status'],
    queryFn: () => workflowsService.getMigrationStatus(),
    staleTime: 5 * 60 * 1000,
  })

  const markMigrated = useMutation({
    mutationFn: () => workflowsService.markAllMigrated(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['migration-status'] })
    },
  })

  // Silently fix legacy accounts that only appear stale due to missing flag
  useEffect(() => {
    if (!data) return
    const staleLegacy = data.accounts.filter(
      (a) => !a.oauth_migrated && !a.needs_reconnect
    )
    if (staleLegacy.length > 0 && !markMigrated.isPending) {
      markMigrated.mutate()
    }
  }, [data])

  if (dismissed || !data || data.needs_reconnect === 0) return null

  const needsReconnect = data.accounts.filter((a) => a.needs_reconnect)

  return (
    <div className="mx-4 mt-3 rounded-xl bg-rose-500/10 border border-rose-500/30 px-4 py-3 flex items-start gap-3 relative">
      <AlertTriangle size={16} className="text-rose-400 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-rose-300 mb-0.5">
          Account ulanishida muammo
        </div>
        <div className="text-xs text-rose-200/80">
          {needsReconnect.map((a) => a.account_name).join(', ')} —{' '}
          {needsReconnect.length === 1 ? 'bu accountni' : 'bu accountlarni'} qayta ulang.
        </div>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="p-0.5 rounded text-rose-400/60 hover:text-rose-400 transition shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  )
}
