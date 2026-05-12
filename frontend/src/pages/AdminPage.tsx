import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Users, LayoutGrid, FileText, Link2,
  ShieldCheck, ShieldOff, Trash2, ToggleLeft, ToggleRight, Loader2,
} from 'lucide-react'
import { adminService, type AdminStats, type AdminUser } from '@/services/admin.service'
import { useAuthStore } from '@/store'

function StatCard({ icon: Icon, label, value, color }: {
  icon: any; label: string; value: number; color: string
}) {
  return (
    <div className="rounded-2xl bg-surface border border-line p-5 flex items-center gap-4">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${color}18`, border: `1px solid ${color}30` }}
      >
        <Icon size={18} style={{ color }} />
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-[0.14em] text-faint">{label}</div>
        <div className="font-display text-2xl text-ink tracking-tight">{value.toLocaleString()}</div>
      </div>
    </div>
  )
}

function RoleBadge({ isAdmin }: { isAdmin: boolean }) {
  return isAdmin ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
      <ShieldCheck size={10} /> Admin
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-line text-mute border border-line2">
      User
    </span>
  )
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${active ? 'bg-mint-500' : 'bg-rose-500'}`} />
  )
}

export default function AdminPage() {
  const currentUser = useAuthStore((s) => s.user)
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [s, u] = await Promise.all([adminService.getStats(), adminService.getUsers()])
        setStats(s)
        setUsers(u)
      } catch {
        toast.error('Failed to load admin data')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function toggleActive(user: AdminUser) {
    setActionId(user.id)
    try {
      const updated = await adminService.updateUser(user.id, { is_active: !user.is_active })
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
      toast.success(`${updated.email} ${updated.is_active ? 'activated' : 'deactivated'}`)
    } catch {
      toast.error('Update failed')
    } finally {
      setActionId(null)
    }
  }

  async function toggleAdmin(user: AdminUser) {
    setActionId(user.id)
    try {
      const updated = await adminService.updateUser(user.id, { is_admin: !user.is_admin })
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
      toast.success(`${updated.email} ${updated.is_admin ? 'promoted to admin' : 'demoted to user'}`)
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Update failed')
    } finally {
      setActionId(null)
    }
  }

  async function handleDelete(user: AdminUser) {
    if (!confirm(`Delete ${user.email}? This cannot be undone.`)) return
    setActionId(user.id)
    try {
      await adminService.deleteUser(user.id)
      setUsers((prev) => prev.filter((u) => u.id !== user.id))
      if (stats) setStats({ ...stats, total_users: stats.total_users - 1 })
      toast.success('User deleted')
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Delete failed')
    } finally {
      setActionId(null)
    }
  }

  if (loading) {
    return (
      <div className="page-in px-8 py-6 flex items-center justify-center min-h-[400px]">
        <Loader2 size={24} className="animate-spin text-mute" />
      </div>
    )
  }

  return (
    <div className="page-in px-8 py-6 max-w-[1200px]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center">
          <ShieldCheck size={16} className="text-indigo-400" />
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.16em] text-faint">System</div>
          <h1 className="font-display text-xl text-ink tracking-tight">Admin Panel</h1>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard icon={Users}      label="Total users"    value={stats.total_users}    color="#6C63FF" />
          <StatCard icon={LayoutGrid} label="Active users"   value={stats.active_users}   color="#00F5A0" />
          <StatCard icon={FileText}   label="Total posts"    value={stats.total_posts}    color="#FFB347" />
          <StatCard icon={Link2}      label="Accounts"       value={stats.total_accounts} color="#5BE8FF" />
        </div>
      )}

      {/* Users table */}
      <div className="rounded-2xl bg-surface border border-line overflow-hidden">
        <div className="px-5 py-4 border-b border-line flex items-center justify-between">
          <div className="font-medium text-ink text-sm">Users ({users.length})</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="text-left px-5 py-3 text-[10px] uppercase tracking-[0.12em] text-faint font-medium">User</th>
                <th className="text-left px-4 py-3 text-[10px] uppercase tracking-[0.12em] text-faint font-medium">Status</th>
                <th className="text-left px-4 py-3 text-[10px] uppercase tracking-[0.12em] text-faint font-medium">Role</th>
                <th className="text-left px-4 py-3 text-[10px] uppercase tracking-[0.12em] text-faint font-medium">Joined</th>
                <th className="text-right px-5 py-3 text-[10px] uppercase tracking-[0.12em] text-faint font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const isSelf = user.id === currentUser?.id
                const busy = actionId === user.id
                return (
                  <tr key={user.id} className="border-b border-line/50 hover:bg-surface2/50 transition">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-indigo-500/15 flex items-center justify-center shrink-0">
                          <span className="text-[11px] font-medium text-indigo-400 uppercase">
                            {(user.full_name || user.email)[0]}
                          </span>
                        </div>
                        <div>
                          <div className="text-ink font-medium leading-none mb-0.5">
                            {user.full_name || '—'}
                            {isSelf && <span className="ml-1.5 text-[10px] text-faint">(you)</span>}
                          </div>
                          <div className="text-[12px] text-mute">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <StatusDot active={user.is_active} />
                        <span className="text-mute text-xs">{user.is_active ? 'Active' : 'Disabled'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <RoleBadge isAdmin={user.is_admin} />
                    </td>
                    <td className="px-4 py-3.5 text-mute text-xs tnum">
                      {new Date(user.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        {/* Toggle active */}
                        <button
                          onClick={() => toggleActive(user)}
                          disabled={busy || isSelf}
                          title={user.is_active ? 'Deactivate' : 'Activate'}
                          className="p-1.5 rounded-lg text-mute hover:text-ink hover:bg-surface2 transition disabled:opacity-30"
                        >
                          {busy ? <Loader2 size={14} className="animate-spin" /> :
                            user.is_active ? <ToggleRight size={14} className="text-mint-500" /> : <ToggleLeft size={14} />}
                        </button>

                        {/* Toggle admin */}
                        <button
                          onClick={() => toggleAdmin(user)}
                          disabled={busy || isSelf}
                          title={user.is_admin ? 'Remove admin' : 'Make admin'}
                          className="p-1.5 rounded-lg text-mute hover:text-ink hover:bg-surface2 transition disabled:opacity-30"
                        >
                          {user.is_admin
                            ? <ShieldCheck size={14} className="text-indigo-400" />
                            : <ShieldOff size={14} />}
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => handleDelete(user)}
                          disabled={busy || isSelf}
                          title="Delete user"
                          className="p-1.5 rounded-lg text-mute hover:text-rose-500 hover:bg-rose-500/10 transition disabled:opacity-30"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {users.length === 0 && (
            <div className="py-12 text-center text-mute text-sm">No users found</div>
          )}
        </div>
      </div>
    </div>
  )
}
