'use client'
import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ChevronDown, ChevronRight, Moon, Plus, Settings, Sun, Users } from 'lucide-react'
import { api } from '@/lib/api'
import type { Team, Member, MemberHealth } from '@/lib/types'
import { cn, getInitials, healthColor } from '@/lib/utils'
import GlobalSettingsPanel from './GlobalSettingsPanel'
import MemberForm from './MemberForm'
import DuplicateMemberModal from './DuplicateMemberModal'
import { useTheme } from '@/components/ThemeProvider'

export default function TeamNav() {
  const router = useRouter()
  const pathname = usePathname()
  const { theme, toggle } = useTheme()
  const [teams, setTeams] = useState<Team[]>([])
  const [members, setMembers] = useState<Record<string, Member[]>>({})
  const [health, setHealth] = useState<Record<string, string>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [showSettings, setShowSettings] = useState(false)
  const [showNewTeam, setShowNewTeam] = useState(false)
  const [showNewMember, setShowNewMember] = useState<string | null>(null)
  const [duplicating, setDuplicating] = useState<{ team: Team; member: Member } | null>(null)
  const [newTeam, setNewTeam] = useState({ name: '', display_name: '', domain: '' })
  const [createError, setCreateError] = useState('')
  const [gcpConfigured, setGcpConfigured] = useState(true)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function loadTeams() {
    try {
      const ts = await api.getTeams()
      setTeams(ts)
      const membersMap: Record<string, Member[]> = {}
      await Promise.all(
        ts.map(async (t) => {
          try {
            membersMap[t.id] = await api.getMembers(t.id)
          } catch {
            membersMap[t.id] = []
          }
        }),
      )
      setMembers(membersMap)
      if (ts.length > 0 && !expanded[ts[0].id]) {
        setExpanded((p) => ({ ...p, [ts[0].id]: true }))
      }
    } catch {
      // API not running yet
    }
  }

  async function loadHealth() {
    try {
      const allMembers = Object.values(members).flat()
      const results = await Promise.all(
        allMembers.map(async (m) => {
          try {
            const h = await api.getMemberHealth(m.team_id, m.id)
            return { id: m.id, status: h.status }
          } catch {
            return { id: m.id, status: 'offline' as const }
          }
        }),
      )
      const map: Record<string, string> = {}
      results.forEach((r) => (map[r.id] = r.status))
      setHealth(map)
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    loadTeams()
    api.getGlobalSettings()
      .then((s) => setGcpConfigured(s.has_bootstrap_sa_key))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (Object.keys(members).length > 0) {
      loadHealth()
      pollRef.current = setInterval(loadHealth, 30_000)
      return () => { if (pollRef.current) clearInterval(pollRef.current) }
    }
  }, [members])

  function toSlug(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 20)
      .replace(/-+$/, '')
  }

  async function handleCreateTeam(e: React.FormEvent) {
    e.preventDefault()
    setCreateError('')
    const slug = toSlug(newTeam.display_name)
    try {
      const team = await api.createTeam({
        name: slug,
        display_name: newTeam.display_name,
        domain: newTeam.domain,
      })
      setShowNewTeam(false)
      setNewTeam({ name: '', display_name: '', domain: '' })
      await loadTeams()
      router.push(`/teams/${team.id}`)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create team')
    }
  }

  const teamForMember = showNewMember ? teams.find((t) => t.id === showNewMember) : null

  return (
    <>
      <nav
        className="flex flex-col h-full shrink-0 overflow-y-auto"
        style={{ width: 260, background: 'var(--c-bg-base)', borderRight: '1px solid var(--c-border)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 shrink-0"
          style={{ borderBottom: '1px solid var(--c-border)' }}
        >
          <span className="font-semibold text-sm tracking-wide" style={{ color: 'var(--c-text-primary)' }}>Coordina</span>
          <div className="flex items-center gap-1">
            <button
              onClick={toggle}
              className="p-1 rounded hover:bg-white/10 transition-colors"
              title="Toggle theme"
            >
              {theme === 'dark'
                ? <Moon size={15} style={{ color: 'var(--c-text-muted)' }} />
                : <Sun size={15} style={{ color: 'var(--c-text-muted)' }} />
              }
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="p-1 rounded hover:bg-white/10 transition-colors"
              title="Global Settings"
            >
              <Settings size={15} style={{ color: 'var(--c-text-muted)' }} />
            </button>
          </div>
        </div>

        {/* GCP warning banner */}
        {!gcpConfigured && (
          <button
            onClick={() => setShowSettings(true)}
            className="w-full text-left px-3 py-2 text-xs transition-colors hover:bg-yellow-500/10"
            style={{ background: '#1a1500', borderBottom: '1px solid #3a2e00', color: '#ca8a04' }}
          >
            ⚠ GCP not configured — click to set up
          </button>
        )}

        {/* Teams list */}
        <div className="flex-1 py-2 overflow-y-auto">
          {teams.length === 0 && (
            <p className="px-4 py-3 text-xs" style={{ color: 'var(--c-text-faint)' }}>
              No teams yet
            </p>
          )}
          {teams.map((team) => {
            const isTeamActive = pathname?.startsWith(`/teams/${team.id}`)
            const isOpen = expanded[team.id] ?? false
            const teamMembers = members[team.id] ?? []

            return (
              <div key={team.id}>
                {/* Team row */}
                <div
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 cursor-pointer select-none hover:bg-white/5 transition-colors group',
                    isTeamActive && !pathname?.includes('/members/') && 'bg-white/10',
                  )}
                  onClick={() => {
                    setExpanded((p) => ({ ...p, [team.id]: !isOpen }))
                    router.push(`/teams/${team.id}`)
                  }}
                >
                  <span style={{ color: 'var(--c-text-faint)' }}>
                    {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </span>
                  <Users size={13} style={{ color: 'var(--c-text-secondary)' }} />
                  <span className="flex-1 text-sm truncate" style={{ color: 'var(--c-text-secondary)' }}>{team.display_name}</span>
                  {team.gcp_project_status === 'provisioning' && (
                    <span className="text-xs px-1 rounded" style={{ background: '#1a3a5c', color: '#60a5fa' }}>
                      ⟳
                    </span>
                  )}
                  <span
                    className="text-xs opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:text-white"
                    style={{ color: 'var(--c-text-muted)' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowNewMember(team.id)
                    }}
                    title="Add member"
                  >
                    <Plus size={12} />
                  </span>
                </div>

                {/* Members */}
                {isOpen && (
                  <div>
                    {teamMembers.map((m) => {
                      const isMemberActive = pathname === `/teams/${team.id}/members/${m.id}`
                      const memberHealth = health[m.id] ?? 'offline'
                      return (
                        <div
                          key={m.id}
                          className={cn(
                            'flex items-center gap-2 pl-8 pr-2 py-1.5 cursor-pointer hover:bg-white/5 transition-colors group/member',
                            isMemberActive && 'bg-white/10',
                          )}
                          onClick={() => router.push(`/teams/${team.id}/members/${m.id}`)}
                        >
                          <span
                            className={cn('w-1.5 h-1.5 rounded-full shrink-0', healthColor(memberHealth))}
                          />
                          <span className="flex-1 text-xs truncate" style={{ color: isMemberActive ? 'var(--c-text-primary)' : 'var(--c-text-secondary)' }}>
                            {m.prefix} {m.display_name}
                            {m.is_team_lead && (
                              <span className="ml-1 text-yellow-500/70 text-xs">★</span>
                            )}
                          </span>
                          <button
                            className="opacity-0 group-hover/member:opacity-100 transition-opacity p-0.5 rounded hover:bg-white/10 shrink-0"
                            title="Duplicate member"
                            onClick={(e) => { e.stopPropagation(); setDuplicating({ team, member: m }) }}
                            style={{ color: 'var(--c-text-faint)' }}
                          >
                            ⎘
                          </button>
                        </div>
                      )
                    })}
                    {teamMembers.length === 0 && (
                      <p className="pl-8 py-1.5 text-xs" style={{ color: 'var(--c-text-placeholder)' }}>
                        No members
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* New Team button */}
        <div className="shrink-0 p-3" style={{ borderTop: '1px solid var(--c-border)' }}>
          <button
            onClick={() => setShowNewTeam(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors hover:bg-white/10"
            style={{ color: 'var(--c-text-secondary)', border: '1px solid var(--c-border-strong)' }}
          >
            <Plus size={14} />
            New Team
          </button>
        </div>
      </nav>

      {/* New Team Modal */}
      {showNewTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="rounded-lg p-6 w-[420px] shadow-2xl" style={{ background: 'var(--c-bg-modal)', border: '1px solid var(--c-border-strong)' }}>
            <h3 className="font-semibold mb-4" style={{ color: 'var(--c-text-primary)' }}>Create Team</h3>
            <form onSubmit={handleCreateTeam} className="space-y-3">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--c-text-secondary)' }}>
                  Name *
                </label>
                <input
                  className="w-full px-3 py-2 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500"
                  style={{ background: 'var(--c-bg-base)', border: '1px solid var(--c-border-strong)', color: 'var(--c-text-primary)' }}
                  placeholder="Acme Corp AI Team"
                  value={newTeam.display_name}
                  onChange={(e) => setNewTeam((p) => ({ ...p, display_name: e.target.value }))}
                  autoFocus
                  required
                />
                {newTeam.display_name && (
                  <p className="mt-1 text-xs" style={{ color: 'var(--c-text-faint)' }}>
                    Slug: <span style={{ color: 'var(--c-text-muted)' }}>{toSlug(newTeam.display_name) || '—'}</span>
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--c-text-secondary)' }}>
                  Domain *
                </label>
                <input
                  className="w-full px-3 py-2 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500"
                  style={{ background: 'var(--c-bg-base)', border: '1px solid var(--c-border-strong)', color: 'var(--c-text-primary)' }}
                  placeholder="acme.com"
                  value={newTeam.domain}
                  onChange={(e) => setNewTeam((p) => ({ ...p, domain: e.target.value }))}
                  required
                />
              </div>
              {createError && (
                <p className="text-xs text-red-400">{createError}</p>
              )}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowNewTeam(false); setCreateError('') }}
                  className="flex-1 py-2 rounded text-sm transition-colors hover:bg-white/10"
                  style={{ color: 'var(--c-text-secondary)', border: '1px solid var(--c-border-strong)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={toSlug(newTeam.display_name).length < 3}
                  className="flex-1 py-2 rounded text-sm font-medium text-white transition-colors disabled:opacity-40"
                  style={{ background: '#2563eb' }}
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Member Form */}
      {showNewMember && teamForMember && (
        <MemberForm
          team={teamForMember}
          members={members[teamForMember.id] ?? []}
          onSave={async () => {
            setShowNewMember(null)
            await loadTeams()
          }}
          onClose={() => setShowNewMember(null)}
        />
      )}

      {/* Duplicate Member Modal */}
      {duplicating && (
        <DuplicateMemberModal
          team={duplicating.team}
          member={duplicating.member}
          onSave={async () => {
            setDuplicating(null)
            await loadTeams()
          }}
          onClose={() => setDuplicating(null)}
        />
      )}

      {/* Global Settings Panel */}
      {showSettings && (
        <GlobalSettingsPanel
          onClose={() => {
            setShowSettings(false)
            api.getGlobalSettings()
              .then((s) => setGcpConfigured(s.has_bootstrap_sa_key))
              .catch(() => {})
          }}
        />
      )}
    </>
  )
}
