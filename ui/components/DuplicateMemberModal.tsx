'use client'
import { useState } from 'react'
import { X } from 'lucide-react'
import { api } from '@/lib/api'
import type { Team, Member } from '@/lib/types'

type Props = {
  team: Team
  member: Member
  onSave: (newMember: Member) => void
  onClose: () => void
}

const nameRe = /^[a-z][a-z0-9_]*$/

export default function DuplicateMemberModal({ team, member, onSave, onClose }: Props) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const newId = name ? `${team.name}_${name}` : ''
  const nameValid = nameRe.test(name)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nameValid) return
    setSaving(true)
    setError('')
    try {
      const m = await api.duplicateMember(team.id, member.id, name)
      onSave(m)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to duplicate member')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="rounded-lg p-6 w-[400px] shadow-2xl" style={{ background: 'var(--c-bg-modal)', border: '1px solid var(--c-border-strong)' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold" style={{ color: 'var(--c-text-primary)' }}>Duplicate Member</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10 transition-colors">
            <X size={15} style={{ color: 'var(--c-text-muted)' }} />
          </button>
        </div>

        <p className="text-xs mb-4" style={{ color: 'var(--c-text-muted)' }}>
          Copying <span className="font-medium" style={{ color: 'var(--c-text-secondary)' }}>{member.prefix} {member.display_name}</span> — same model, role, and tools. Enter a new name for the copy.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--c-text-secondary)' }}>
              New name (slug) *
            </label>
            <input
              className="w-full px-3 py-2 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500 font-mono"
              style={{ background: 'var(--c-bg-base)', border: '1px solid var(--c-border-strong)', color: 'var(--c-text-primary)' }}
              placeholder="e.g. alice2"
              value={name}
              onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              autoFocus
            />
            {name && !nameValid && (
              <p className="mt-1 text-xs text-red-400">Must start with a letter; only lowercase letters, digits, underscores</p>
            )}
          </div>

          {newId && nameValid && (
            <div className="rounded px-3 py-2 text-xs" style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border)' }}>
              <span style={{ color: 'var(--c-text-muted)' }}>New ID: </span>
              <span className="font-mono" style={{ color: 'var(--c-text-primary)' }}>{newId}</span>
            </div>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded text-sm transition-colors hover:bg-white/10"
              style={{ color: 'var(--c-text-secondary)', border: '1px solid var(--c-border-strong)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!nameValid || saving}
              className="flex-1 py-2 rounded text-sm font-medium text-white transition-colors disabled:opacity-40"
              style={{ background: '#2563eb' }}
            >
              {saving ? 'Duplicating…' : 'Duplicate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
