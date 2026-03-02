'use client'
import { use, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { Team, Member } from '@/lib/types'
import ChatPanel from '@/components/ChatPanel'
import ContextSidebar from '@/components/ContextSidebar'

export default function TeamPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = use(params)
  const [team, setTeam] = useState<Team | null>(null)
  const [lead, setLead] = useState<Member | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [t, members] = await Promise.all([api.getTeam(teamId), api.getMembers(teamId)])
        setTeam(t)
        setLead(members.find((m) => m.is_team_lead) ?? members[0] ?? null)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [teamId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: '#666' }}>
        Loading...
      </div>
    )
  }

  if (!team || !lead) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-white mb-1">No members yet</p>
          <p className="text-sm" style={{ color: '#666' }}>Add a member to start chatting.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      <ChatPanel teamId={teamId} memberId={lead.id} />
      <ContextSidebar team={team} member={lead} />
    </div>
  )
}
