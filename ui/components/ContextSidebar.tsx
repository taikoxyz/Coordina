'use client'
import { useState } from 'react'
import type { Team, Member, MemberHealth } from '@/lib/types'
import { cn, getInitials, healthColor } from '@/lib/utils'

type Props = { team: Team; member: Member; health?: MemberHealth }

export default function ContextSidebar({ team, member, health }: Props) {
  const [tab, setTab] = useState<'files' | 'activity'>('activity')

  const colors = ['bg-blue-600', 'bg-purple-600', 'bg-green-600', 'bg-orange-600', 'bg-pink-600']
  const colorIndex =
    member.name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length
  const avatarColor = colors[colorIndex]

  const memberStatus = health?.status ?? 'offline'

  return (
    <aside
      className="hidden lg:flex flex-col shrink-0 h-full overflow-y-auto"
      style={{ width: 280, background: '#111', borderLeft: '1px solid #222' }}
    >
      {/* Avatar + name */}
      <div className="p-5" style={{ borderBottom: '1px solid #222' }}>
        <div className="flex items-center gap-3 mb-3">
          <div
            className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0',
              avatarColor,
            )}
          >
            {getInitials(member.display_name)}
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate">
              {member.prefix} {member.display_name}
            </p>
            <p className="text-xs truncate" style={{ color: '#666' }}>
              {member.id}@{team.domain}
            </p>
          </div>
        </div>

        {/* Role + health */}
        <div className="flex items-center gap-2 flex-wrap">
          {member.role && (
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: '#1e1e1e', color: '#aaa', border: '1px solid #333' }}
            >
              {member.role}
            </span>
          )}
          {member.is_team_lead && (
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: '#2a2200', color: '#fbbf24', border: '1px solid #4a3a00' }}
            >
              Team Lead
            </span>
          )}
          <div className="flex items-center gap-1.5 ml-auto">
            <span className={cn('w-2 h-2 rounded-full', healthColor(memberStatus))} />
            <span className="text-xs capitalize" style={{ color: '#777' }}>
              {memberStatus}
            </span>
          </div>
        </div>
      </div>

      {/* Model info */}
      <div className="px-5 py-3" style={{ borderBottom: '1px solid #1e1e1e' }}>
        <p className="text-xs mb-1" style={{ color: '#555' }}>
          Model
        </p>
        <p className="text-xs text-white/80">
          {member.model_provider}/{member.model_id}
        </p>
      </div>

      {/* Tools */}
      {member.tools_enabled.length > 0 && (
        <div className="px-5 py-3" style={{ borderBottom: '1px solid #1e1e1e' }}>
          <p className="text-xs mb-2" style={{ color: '#555' }}>
            Tools
          </p>
          <div className="flex flex-wrap gap-1.5">
            {member.tools_enabled.map((tool) => (
              <span
                key={tool}
                className="text-xs px-2 py-0.5 rounded"
                style={{ background: '#1a2a1a', color: '#4ade80', border: '1px solid #1e3a1e' }}
              >
                {tool}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="px-5 pt-3">
        <div
          className="flex rounded-lg overflow-hidden mb-3"
          style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}
        >
          {(['activity', 'files'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'flex-1 py-1.5 text-xs capitalize transition-colors',
                tab === t ? 'text-white' : 'text-gray-500 hover:text-gray-300',
              )}
              style={tab === t ? { background: '#2a2a2a' } : undefined}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'activity' && (
          <div className="space-y-2">
            {health?.uptime_seconds != null && (
              <div>
                <p className="text-xs" style={{ color: '#555' }}>
                  Uptime
                </p>
                <p className="text-xs text-white/70">
                  {Math.floor((health.uptime_seconds ?? 0) / 60)}m {(health.uptime_seconds ?? 0) % 60}s
                </p>
              </div>
            )}
            {health?.active_task ? (
              <div>
                <p className="text-xs" style={{ color: '#555' }}>
                  Active task
                </p>
                <p className="text-xs text-white/70">{health.active_task}</p>
              </div>
            ) : (
              <p className="text-xs" style={{ color: '#444' }}>
                {memberStatus === 'online' ? 'Idle' : 'Container offline'}
              </p>
            )}
          </div>
        )}

        {tab === 'files' && (
          <div
            className="rounded-lg p-3 text-xs"
            style={{ background: '#1a1a1a', color: '#555', border: '1px solid #2a2a2a' }}
          >
            File browser available in Phase 1
          </div>
        )}
      </div>
    </aside>
  )
}
