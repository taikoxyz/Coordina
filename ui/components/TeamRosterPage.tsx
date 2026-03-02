'use client'
import { useState, useEffect, useRef } from 'react'
import { api } from '@/lib/api'
import type { Team, Member, MaterializeStatus } from '@/lib/types'
import MemberForm from './MemberForm'

interface Props {
  team: Team
  members: Member[]
  gcpConnected: boolean
  wsConnected: boolean
  onMembersChange: () => void
}

export default function TeamRosterPage({ team, members, gcpConnected, onMembersChange }: Props) {
  const [editingMember, setEditingMember] = useState<Member | undefined>()
  const [showMemberForm, setShowMemberForm] = useState(false)
  const [materializeStatus, setMaterializeStatus] = useState<MaterializeStatus | null>(null)
  const [materializing, setMaterializing] = useState(false)
  const [error, setError] = useState('')
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    api.getMaterializeStatus(team.id).then(setMaterializeStatus).catch(() => {})
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current)
    }
  }, [team.id])

  const schedulePoll = (teamId: string) => {
    pollRef.current = setTimeout(async () => {
      try {
        const status = await api.getMaterializeStatus(teamId)
        setMaterializeStatus(status)
        if (status.status === 'in_progress') {
          schedulePoll(teamId)
        } else {
          setMaterializing(false)
          if (status.status === 'done') onMembersChange()
        }
      } catch {
        setMaterializing(false)
      }
    }, 2000)
  }

  const handleMaterialize = async () => {
    setError('')
    setMaterializing(true)
    try {
      await api.startMaterialize(team.id)
      schedulePoll(team.id)
    } catch (e: unknown) {
      setMaterializing(false)
      setError(e instanceof Error ? e.message : 'Failed to start')
    }
  }

  const handleDelete = async (memberId: string) => {
    if (!confirm('Delete this member?')) return
    try {
      await api.deleteMember(team.id, memberId)
      onMembersChange()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  const isInProgress = materializeStatus?.status === 'in_progress' || materializing
  const isDone = materializeStatus?.status === 'done'
  const canMaterialize = gcpConnected && members.length > 0 && !isInProgress && !isDone

  const memberEmail = (memberName: string) => `agent_${team.name}_${memberName}@${team.domain}`

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">{team.display_name}</h1>
        <p className="text-sm mt-0.5" style={{ color: '#888' }}>{team.domain}</p>
      </div>

      {/* Members */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Members</h2>
          <button
            onClick={() => { setEditingMember(undefined); setShowMemberForm(true) }}
            className="text-xs px-3 py-1.5 rounded border border-blue-500/50 text-blue-400 hover:bg-blue-500/10 transition-colors"
          >
            + Add Member
          </button>
        </div>

        {members.length === 0 ? (
          <p className="text-sm py-4" style={{ color: '#555' }}>No members yet. Add one to get started.</p>
        ) : (
          <div style={{ border: '1px solid #2a2a2a', borderRadius: 8, overflow: 'hidden' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid #2a2a2a', background: '#141414' }}>
                  <th className="text-left px-4 py-2.5 text-gray-500 font-medium text-xs uppercase">Name</th>
                  <th className="text-left px-4 py-2.5 text-gray-500 font-medium text-xs uppercase">Role</th>
                  <th className="text-left px-4 py-2.5 text-gray-500 font-medium text-xs uppercase">Email</th>
                  <th className="text-left px-4 py-2.5 text-gray-500 font-medium text-xs uppercase">Model</th>
                  <th className="text-left px-4 py-2.5 text-gray-500 font-medium text-xs uppercase">K8s</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {members.map((m, i) => (
                  <tr
                    key={m.id}
                    style={{ borderBottom: i < members.length - 1 ? '1px solid #1e1e1e' : 'none' }}
                  >
                    <td className="px-4 py-3 text-white">
                      {m.is_team_lead && <span className="mr-1.5 text-yellow-400">♛</span>}
                      {m.display_name}
                    </td>
                    <td className="px-4 py-3 text-gray-400">{m.role || '—'}</td>
                    <td className="px-4 py-3" style={{ color: '#555', fontFamily: 'monospace', fontSize: '11px' }}>
                      {memberEmail(m.name)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{m.model_id}</td>
                    <td className="px-4 py-3">
                      {m.k8s_deployed && (
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#1e3a5f', color: '#60a5fa' }}>deployed</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => { setEditingMember(m); setShowMemberForm(true) }}
                        className="text-xs px-2.5 py-1 rounded text-gray-400 hover:text-white hover:bg-white/5 mr-1 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(m.id)}
                        className="text-xs px-2.5 py-1 rounded text-red-500/70 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Materialize */}
      <div style={{ borderTop: '1px solid #222', paddingTop: 28 }}>
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">Materialize Team</h2>

        <div className="flex flex-wrap gap-2 mb-5">
          <Badge ok={gcpConnected} label="GCP Connected" />
          <Badge ok={members.length > 0} label={`${members.length} Member${members.length !== 1 ? 's' : ''}`} />
        </div>

        {error && (
          <p className="text-sm text-red-400 mb-3">{error}</p>
        )}

        {!isDone && (
          <button
            onClick={handleMaterialize}
            disabled={!canMaterialize}
            className="px-4 py-2 rounded text-sm font-medium mb-5 transition-colors"
            style={{
              background: canMaterialize ? '#1d4ed8' : '#1e2a40',
              color: canMaterialize ? 'white' : '#4a6080',
              cursor: canMaterialize ? 'pointer' : 'not-allowed',
            }}
          >
            {isInProgress ? 'Materializing...' : '🚀 Materialize Team'}
          </button>
        )}

        {materializeStatus && materializeStatus.status !== 'idle' && (
          <MaterializeProgress status={materializeStatus} />
        )}
      </div>

      {/* MemberForm modal */}
      {showMemberForm && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowMemberForm(false) }}
        >
          <MemberForm
            team={team}
            member={editingMember}
            members={members}
            onSave={() => { setShowMemberForm(false); onMembersChange() }}
            onClose={() => setShowMemberForm(false)}
          />
        </div>
      )}
    </div>
  )
}

function Badge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className="text-xs px-2.5 py-1 rounded-full"
      style={{
        background: ok ? 'rgba(20, 83, 45, 0.5)' : 'rgba(59, 21, 21, 0.5)',
        color: ok ? '#4ade80' : '#f87171',
        border: `1px solid ${ok ? '#166534' : '#7f1d1d'}`,
      }}
    >
      {ok ? '✓' : '✗'} {label}
    </span>
  )
}

function MaterializeProgress({ status }: { status: MaterializeStatus }) {
  return (
    <div style={{ border: '1px solid #222', borderRadius: 8, padding: '16px 20px' }}>
      <div className="space-y-3">
        {status.steps.map((step) => {
          const isActive = status.status === 'in_progress'
          const color = step.done ? '#4ade80' : step.error ? '#f87171' : isActive ? '#60a5fa' : '#444'
          return (
            <div key={step.n} className="flex items-start gap-3 text-sm">
              <span className="w-5 text-center mt-0.5 text-base leading-none" style={{ color }}>
                {step.done ? '✓' : step.error ? '✗' : isActive ? '⟳' : '○'}
              </span>
              <div>
                <span style={{ color }}>{step.label}</span>
                {step.error && (
                  <p className="text-xs text-red-400 mt-0.5">{step.error}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {status.status === 'done' && (
        <p className="text-sm text-green-400 mt-4 pt-3" style={{ borderTop: '1px solid #222' }}>
          Team materialized successfully.
        </p>
      )}
    </div>
  )
}
