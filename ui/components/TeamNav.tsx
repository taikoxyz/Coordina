'use client'
import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ChevronDown, ChevronRight, Plus, Settings, Users } from 'lucide-react'
import { api } from '@/lib/api'
import type { Team, Member, MemberHealth } from '@/lib/types'
import { cn, getInitials, healthColor } from '@/lib/utils'
import GlobalSettingsPanel from './GlobalSettingsPanel'
import MemberForm from './MemberForm'

export default function TeamNav() {
  const router = useRouter()
  const pathname = usePathname()
  const [teams, setTeams] = useState<Team[]>([])
  const [members, setMembers] = useState<Record<string, Member[]>>({})
  const [health, setHealth] = useState<Record<string, string>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [showSettings, setShowSettings] = useState(false)
  const [showNewTeam, setShowNewTeam] = useState(false)
  const [showNewMember, setShowNewMember] = useState<string | null>(null)
  const [newTeam, setNewTeam] = useState({ name: '', display_name: '', domain: '' })
  const [createError, setCreateError] = useState('')
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
  }, [])

  useEffect(() => {
    if (Object.keys(members).length > 0) {
      loadHealth()
      pollRef.current = setInterval(loadHealth, 30_000)
      return () => { if (pollRef.current) clearInterval(pollRef.current) }
    }
  }, [members])

  async function handleCreateTeam(e: React.FormEvent) {
    e.preventDefault()
    setCreateError('')
    try {
      const team = await api.createTeam({
        name: newTeam.name,
        display_name: newTeam.display_name || newTeam.name,
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
        style={{ width: 260, background: '#111', borderRight: '1px solid #222' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 shrink-0"
          style={{ borderBottom: '1px solid #222' }}
        >
          <span className="font-semibold text-white text-sm tracking-wide">ClawTeam</span>
          <button
            onClick={() => setShowSettings(true)}
            className="p-1 rounded hover:bg-white/10 transition-colors"
            title="Global Settings"
          >
            <Settings size={15} style={{ color: '#666' }} />
          </button>
        </div>

        {/* Teams list */}
        <div className="flex-1 py-2 overflow-y-auto">
          {teams.length === 0 && (
            <p className="px-4 py-3 text-xs" style={{ color: '#555' }}>
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
                  <span style={{ color: '#555' }}>
                    {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </span>
                  <Users size={13} style={{ color: '#888' }} />
                  <span className="flex-1 text-sm truncate text-white/80">{team.display_name}</span>
                  {team.gcp_project_status === 'provisioning' && (
                    <span className="text-xs px-1 rounded" style={{ background: '#1a3a5c', color: '#60a5fa' }}>
                      ⟳
                    </span>
                  )}
                  <span
                    className="text-xs opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:text-white"
                    style={{ color: '#666' }}
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
                            'flex items-center gap-2 pl-8 pr-3 py-1.5 cursor-pointer hover:bg-white/5 transition-colors',
                            isMemberActive && 'bg-white/10',
                          )}
                          onClick={() => router.push(`/teams/${team.id}/members/${m.id}`)}
                        >
                          <span
                            className={cn('w-1.5 h-1.5 rounded-full shrink-0', healthColor(memberHealth))}
                          />
                          <span className="text-xs truncate" style={{ color: isMemberActive ? '#e5e5e5' : '#999' }}>
                            {m.prefix} {m.display_name}
                            {m.is_team_lead && (
                              <span className="ml-1 text-yellow-500/70 text-xs">★</span>
                            )}
                          </span>
                        </div>
                      )
                    })}
                    {teamMembers.length === 0 && (
                      <p className="pl-8 py-1.5 text-xs" style={{ color: '#444' }}>
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
        <div className="shrink-0 p-3" style={{ borderTop: '1px solid #222' }}>
          <button
            onClick={() => setShowNewTeam(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors hover:bg-white/10"
            style={{ color: '#888', border: '1px solid #333' }}
          >
            <Plus size={14} />
            New Team
          </button>
        </div>
      </nav>

      {/* New Team Modal */}
      {showNewTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="rounded-lg p-6 w-[420px] shadow-2xl" style={{ background: '#1a1a1a', border: '1px solid #333' }}>
            <h3 className="text-white font-semibold mb-4">Create Team</h3>
            <form onSubmit={handleCreateTeam} className="space-y-3">
              <div>
                <label className="block text-xs mb-1" style={{ color: '#888' }}>
                  Team name (slug) *
                </label>
                <input
                  className="w-full px-3 py-2 rounded text-sm text-white outline-none focus:ring-1 focus:ring-blue-500"
                  style={{ background: '#111', border: '1px solid #333' }}
                  placeholder="acme (3-20 chars, lowercase)"
                  value={newTeam.name}
                  onChange={(e) => setNewTeam((p) => ({ ...p, name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: '#888' }}>
                  Display name
                </label>
                <input
                  className="w-full px-3 py-2 rounded text-sm text-white outline-none focus:ring-1 focus:ring-blue-500"
                  style={{ background: '#111', border: '1px solid #333' }}
                  placeholder="Acme Corp AI Team"
                  value={newTeam.display_name}
                  onChange={(e) => setNewTeam((p) => ({ ...p, display_name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: '#888' }}>
                  Domain *
                </label>
                <input
                  className="w-full px-3 py-2 rounded text-sm text-white outline-none focus:ring-1 focus:ring-blue-500"
                  style={{ background: '#111', border: '1px solid #333' }}
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
                  style={{ color: '#888', border: '1px solid #333' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded text-sm font-medium text-white transition-colors"
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
          onSave={async () => {
            setShowNewMember(null)
            await loadTeams()
          }}
          onClose={() => setShowNewMember(null)}
        />
      )}

      {/* Global Settings Panel */}
      {showSettings && <GlobalSettingsPanel onClose={() => setShowSettings(false)} />}
    </>
  )
}
