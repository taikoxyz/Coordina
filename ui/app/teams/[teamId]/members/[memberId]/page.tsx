'use client'
import { use, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { Team, Member } from '@/lib/types'
import ChatPanel from '@/components/ChatPanel'
import ContextSidebar from '@/components/ContextSidebar'

export default function MemberPage({
  params,
}: {
  params: Promise<{ teamId: string; memberId: string }>
}) {
  const { teamId, memberId } = use(params)
  const [team, setTeam] = useState<Team | null>(null)
  const [member, setMember] = useState<Member | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [t, m] = await Promise.all([api.getTeam(teamId), api.getMember(teamId, memberId)])
        setTeam(t)
        setMember(m)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [teamId, memberId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: '#666' }}>
        Loading...
      </div>
    )
  }

  if (!team || !member) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: '#666' }}>
        Member not found
      </div>
    )
  }

  return (
    <div className="flex h-full">
      <ChatPanel teamId={teamId} memberId={memberId} />
      <ContextSidebar team={team} member={member} />
    </div>
  )
}
