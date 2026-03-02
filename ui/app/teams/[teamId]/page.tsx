'use client'
import { use, useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import type { Team, Member } from '@/lib/types'
import TeamRosterPage from '@/components/TeamRosterPage'

export default function TeamPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = use(params)
  const [team, setTeam] = useState<Team | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [gcpConnected, setGcpConnected] = useState(false)
  const [wsConnected, setWsConnected] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const [t, m, gcpStatus, wsStatus] = await Promise.all([
        api.getTeam(teamId),
        api.getMembers(teamId),
        api.getGCPAuthStatus(),
        api.getWorkspaceAuthStatus(),
      ])
      setTeam(t)
      setMembers(m)
      setGcpConnected(gcpStatus.connected)
      setWsConnected(wsStatus.connected)
    } finally {
      setLoading(false)
    }
  }, [teamId])

  useEffect(() => { load() }, [load])

  const refreshMembers = useCallback(async () => {
    const m = await api.getMembers(teamId)
    setMembers(m)
  }, [teamId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: '#666' }}>
        Loading...
      </div>
    )
  }

  if (!team) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: '#666' }}>
        Team not found
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <TeamRosterPage
        team={team}
        members={members}
        gcpConnected={gcpConnected}
        wsConnected={wsConnected}
        onMembersChange={refreshMembers}
      />
    </div>
  )
}
