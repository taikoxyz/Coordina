'use client'
import type { Team, Member, MemberHealth } from '@/lib/types'
import { cn, healthColor } from '@/lib/utils'

type Props = {
  teams: Team[]
  members: Record<string, Member[]>
  health: Record<string, MemberHealth>
}

export default function HealthDashboard({ teams, members, health }: Props) {
  const allMembers = teams.flatMap((t) =>
    (members[t.id] ?? []).map((m) => ({ member: m, team: t })),
  )

  return (
    <div className="p-6">
      <h2 className="text-white font-semibold text-lg mb-4">Health Dashboard</h2>
      {allMembers.length === 0 && (
        <p className="text-sm" style={{ color: '#555' }}>
          No members yet.
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {allMembers.map(({ member, team }) => {
          const h = health[member.id]
          const status = h?.status ?? 'offline'
          return (
            <div
              key={member.id}
              className="rounded-xl p-4"
              style={{ background: '#141414', border: '1px solid #2a2a2a' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className={cn('w-2 h-2 rounded-full shrink-0', healthColor(status))} />
                <span className="text-sm font-medium text-white truncate">
                  {member.prefix} {member.display_name}
                </span>
              </div>
              <p className="text-xs truncate mb-1" style={{ color: '#666' }}>
                {member.role || 'No role'} · {team.display_name}
              </p>
              <p className="text-xs truncate" style={{ color: '#555' }}>
                {member.model_provider}/{member.model_id}
              </p>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="text-xs capitalize" style={{ color: status === 'online' ? '#4ade80' : '#666' }}>
                  {status}
                </span>
                {h?.uptime_seconds != null && status === 'online' && (
                  <span className="text-xs" style={{ color: '#555' }}>
                    · up {Math.floor((h.uptime_seconds ?? 0) / 60)}m
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
