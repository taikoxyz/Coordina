'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { Team, Member, MemberHealth, FileEntry } from '@/lib/types'
import { cn, getInitials, healthColor } from '@/lib/utils'

type Props = { team: Team; member: Member; health?: MemberHealth }

function formatBytes(b: number) {
  if (b < 1024) return `${b}B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)}KB`
  return `${(b / 1024 / 1024).toFixed(1)}MB`
}

function formatUptime(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${sec}s`
  return `${sec}s`
}

export default function ContextSidebar({ team, member, health }: Props) {
  const [tab, setTab] = useState<'files' | 'activity'>('activity')
  const [files, setFiles] = useState<FileEntry[]>([])
  const [filesOffline, setFilesOffline] = useState(false)
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [memoryOnly, setMemoryOnly] = useState(false)

  const colors = ['bg-blue-600', 'bg-purple-600', 'bg-green-600', 'bg-orange-600', 'bg-pink-600']
  const avatarColor = colors[member.name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length]
  const memberStatus = health?.status ?? 'offline'

  useEffect(() => {
    if (tab !== 'files') return
    setLoadingFiles(true)
    api.getMemberFiles(team.id, member.id)
      .then((r) => {
        setFiles(r.files ?? [])
        setFilesOffline(r.offline ?? false)
      })
      .catch(() => { setFiles([]); setFilesOffline(true) })
      .finally(() => setLoadingFiles(false))
  }, [tab, team.id, member.id])

  const visibleFiles = memoryOnly ? files.filter((f) => f.is_memory) : files

  return (
    <aside
      className="hidden lg:flex flex-col shrink-0 h-full overflow-y-auto"
      style={{ width: 280, background: '#111', borderLeft: '1px solid #222' }}
    >
      {/* Avatar + name */}
      <div className="p-5" style={{ borderBottom: '1px solid #222' }}>
        <div className="flex items-center gap-3 mb-3">
          <div className={cn('w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0', avatarColor)}>
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

        <div className="flex items-center gap-2 flex-wrap">
          {member.role && (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#1e1e1e', color: '#aaa', border: '1px solid #333' }}>
              {member.role}
            </span>
          )}
          {member.is_team_lead && (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#2a2200', color: '#fbbf24', border: '1px solid #4a3a00' }}>
              Team Lead
            </span>
          )}
          <div className="flex items-center gap-1.5 ml-auto">
            <span className={cn('w-2 h-2 rounded-full', healthColor(memberStatus))} />
            <span className="text-xs capitalize" style={{ color: '#777' }}>{memberStatus}</span>
          </div>
        </div>
      </div>

      {/* Model info */}
      <div className="px-5 py-3" style={{ borderBottom: '1px solid #1e1e1e' }}>
        <p className="text-xs mb-1" style={{ color: '#555' }}>Model</p>
        <p className="text-xs text-white/80">{member.model_provider}/{member.model_id}</p>
      </div>

      {/* Tools */}
      {member.tools_enabled.length > 0 && (
        <div className="px-5 py-3" style={{ borderBottom: '1px solid #1e1e1e' }}>
          <p className="text-xs mb-2" style={{ color: '#555' }}>Tools</p>
          <div className="flex flex-wrap gap-1.5">
            {member.tools_enabled.map((tool) => (
              <span key={tool} className="text-xs px-2 py-0.5 rounded" style={{ background: '#1a2a1a', color: '#4ade80', border: '1px solid #1e3a1e' }}>
                {tool}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="px-5 pt-3 flex-1 min-h-0 flex flex-col">
        <div className="flex rounded-lg overflow-hidden mb-3" style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}>
          {(['activity', 'files'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn('flex-1 py-1.5 text-xs capitalize transition-colors', tab === t ? 'text-white' : 'text-gray-500 hover:text-gray-300')}
              style={tab === t ? { background: '#2a2a2a' } : undefined}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'activity' && (
          <div className="space-y-3">
            {health?.uptime_seconds != null && (
              <div>
                <p className="text-xs mb-0.5" style={{ color: '#555' }}>Uptime</p>
                <p className="text-xs text-white/70">{formatUptime(health.uptime_seconds!)}</p>
              </div>
            )}
            {health?.last_seen && (
              <div>
                <p className="text-xs mb-0.5" style={{ color: '#555' }}>Last seen</p>
                <p className="text-xs text-white/70">{new Date(health.last_seen).toLocaleTimeString()}</p>
              </div>
            )}
            {health?.active_task ? (
              <div>
                <p className="text-xs mb-0.5" style={{ color: '#555' }}>Active task</p>
                <p className="text-xs text-white/70 break-words">{health.active_task}</p>
              </div>
            ) : (
              <p className="text-xs" style={{ color: '#444' }}>
                {memberStatus === 'online' ? 'Idle — no active task' : 'Container offline'}
              </p>
            )}
          </div>
        )}

        {tab === 'files' && (
          <div className="flex-1 min-h-0 flex flex-col">
            {/* Filter bar */}
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={() => setMemoryOnly((v) => !v)}
                className={cn('text-xs px-2 py-0.5 rounded transition-colors', memoryOnly ? 'text-yellow-300' : 'text-gray-500 hover:text-gray-300')}
                style={memoryOnly ? { background: '#2a2200', border: '1px solid #4a3a00' } : { border: '1px solid #2a2a2a' }}
              >
                ⭐ Memory only
              </button>
              {!loadingFiles && !filesOffline && (
                <span className="text-xs" style={{ color: '#555' }}>{visibleFiles.length} file{visibleFiles.length !== 1 ? 's' : ''}</span>
              )}
            </div>

            {loadingFiles ? (
              <p className="text-xs" style={{ color: '#555' }}>Loading…</p>
            ) : filesOffline ? (
              <p className="text-xs" style={{ color: '#555' }}>Container offline — files unavailable</p>
            ) : visibleFiles.length === 0 ? (
              <p className="text-xs" style={{ color: '#444' }}>{memoryOnly ? 'No memory files found' : 'No files'}</p>
            ) : (
              <div className="space-y-1 overflow-y-auto">
                {visibleFiles.map((f) => (
                  <div
                    key={f.path}
                    className="flex items-start gap-2 rounded px-2 py-1.5 text-xs group"
                    style={{ background: '#181818' }}
                  >
                    <span className="shrink-0 mt-0.5" style={{ color: f.is_memory ? '#fbbf24' : '#444' }}>
                      {f.is_memory ? '⭐' : '📄'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-white/70">{f.name}</p>
                      <p style={{ color: '#444' }}>{formatBytes(f.size)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}
