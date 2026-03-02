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
      <h2 className="font-semibold text-lg mb-4" style={{ color: 'var(--c-text-primary)' }}>Health Dashboard</h2>
      {allMembers.length === 0 && (
        <p className="text-sm" style={{ color: 'var(--c-text-faint)' }}>
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
              style={{ background: 'var(--c-bg-panel)', border: '1px solid var(--c-border-muted)' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className={cn('w-2 h-2 rounded-full shrink-0', healthColor(status))} />
                <span className="text-sm font-medium truncate" style={{ color: 'var(--c-text-primary)' }}>
                  {member.prefix} {member.display_name}
                </span>
              </div>
              <p className="text-xs truncate mb-1" style={{ color: 'var(--c-text-muted)' }}>
                {member.role || 'No role'} · {team.display_name}
              </p>
              <p className="text-xs truncate" style={{ color: 'var(--c-text-faint)' }}>
                {member.model_provider}/{member.model_id}
              </p>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="text-xs capitalize" style={{ color: status === 'online' ? '#4ade80' : 'var(--c-text-muted)' }}>
                  {status}
                </span>
                {h?.uptime_seconds != null && status === 'online' && (
                  <span className="text-xs" style={{ color: 'var(--c-text-faint)' }}>
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
