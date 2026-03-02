'use client'
import { useState } from 'react'
import { X } from 'lucide-react'
import { api } from '@/lib/api'
import type { Team, Member } from '@/lib/types'
import { cn } from '@/lib/utils'

type Props = { team: Team; member?: Member; members?: Member[]; onSave: () => void; onClose: () => void }

type Tab = 'basic' | 'integrations' | 'resources'

export default function MemberForm({ team, member, members, onSave, onClose }: Props) {
  const isEdit = !!member
  const hasLead = (members ?? []).some((m) => m.is_team_lead && m.id !== member?.id)
  const [tab, setTab] = useState<Tab>('basic')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    nameInput: member?.display_name ?? '',
    prefix: member?.prefix ?? (team.prefix_allowlist[0] ?? 'Agent'),
    role: member?.role ?? '',
    is_team_lead: member?.is_team_lead ?? false,
    model_provider: member?.model_provider ?? 'anthropic',
    model_id: member?.model_id ?? 'claude-opus-4-6',
    tools_enabled: member?.tools_enabled?.join(', ') ?? '',
    cpu: member?.cpu ?? '',
    memory: member?.memory ?? '',
    disk: member?.disk ?? '',
  })

  const toSlug = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  const slug = isEdit ? (member!.name) : toSlug(form.nameInput)
  const previewId = `agent_${team.name}_${slug || '…'}`
  const previewEmail = `agent_${team.name}_${slug || '…'}@${team.domain}`

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const tools = form.tools_enabled
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
      const payload = {
        name: slug,
        prefix: form.prefix,
        display_name: form.nameInput,
        role: form.role,
        is_team_lead: form.is_team_lead,
        model_provider: form.model_provider,
        model_id: form.model_id,
        tools_enabled: tools,
        cpu: form.cpu || null,
        memory: form.memory || null,
        disk: form.disk || null,
      }
      if (isEdit && member) {
        await api.updateMember(team.id, member.id, payload)
      } else {
        await api.createMember(team.id, payload)
      }
      onSave()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save member')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)' }}
    >
      <div
        className="w-[520px] max-h-[80vh] flex flex-col rounded-xl shadow-2xl"
        style={{ background: 'var(--c-bg-modal)', border: '1px solid var(--c-border-strong)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderBottom: '1px solid var(--c-border-muted)' }}
        >
          <h3 className="font-semibold" style={{ color: 'var(--c-text-primary)' }}>
            {isEdit ? `Edit ${member!.display_name || member!.name}` : 'Add Member'}
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10 transition-colors">
            <X size={16} style={{ color: 'var(--c-text-muted)' }} />
          </button>
        </div>

        {/* Tabs */}
        <div
          className="flex shrink-0 px-6 gap-1 pt-3"
          style={{ borderBottom: '1px solid var(--c-border-muted)' }}
        >
          {(['basic', 'integrations', 'resources'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'px-3 py-2 text-xs capitalize rounded-t transition-colors border-b-2',
                tab === t
                  ? 'text-white border-blue-500'
                  : 'text-gray-500 border-transparent hover:text-gray-300',
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {tab === 'basic' && (
              <>
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--c-text-secondary)' }}>
                    Name *
                  </label>
                  <input
                    className="w-full px-3 py-2 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500"
                    style={{ background: 'var(--c-bg-base)', border: '1px solid var(--c-border-strong)', color: 'var(--c-text-primary)' }}
                    placeholder="Alice Chen"
                    value={form.nameInput}
                    onChange={(e) => setForm((p) => ({ ...p, nameInput: e.target.value }))}
                    required
                  />
                  {!isEdit && slug && (
                    <p className="mt-1 text-xs font-mono" style={{ color: 'var(--c-text-muted)' }}>
                      slug: {previewId}
                    </p>
                  )}
                  {isEdit && (
                    <p className="mt-1 text-xs font-mono" style={{ color: 'var(--c-text-muted)' }}>
                      slug: {previewId} <span title="Immutable after creation">🔒</span>
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--c-text-secondary)' }}>
                    Role
                  </label>
                  <input
                    className="w-full px-3 py-2 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500"
                    style={{ background: 'var(--c-bg-base)', border: '1px solid var(--c-border-strong)', color: 'var(--c-text-primary)' }}
                    placeholder="Coordinator, Researcher, Engineer…"
                    value={form.role}
                    onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="team_lead"
                    checked={form.is_team_lead}
                    disabled={hasLead && !form.is_team_lead}
                    onChange={(e) => setForm((p) => ({ ...p, is_team_lead: e.target.checked }))}
                    className="accent-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
                  />
                  <label
                    htmlFor="team_lead"
                    className="text-sm"
                    style={{ color: hasLead && !form.is_team_lead ? 'var(--c-text-faint)' : 'var(--c-text-secondary)' }}
                  >
                    Team Lead{hasLead && !form.is_team_lead && <span className="ml-1 text-xs">(already assigned)</span>}
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--c-text-secondary)' }}>
                      Model provider
                    </label>
                    <select
                      className="w-full px-3 py-2 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500"
                      style={{ background: 'var(--c-bg-base)', border: '1px solid var(--c-border-strong)', color: 'var(--c-text-primary)' }}
                      value={form.model_provider}
                      onChange={(e) => setForm((p) => ({ ...p, model_provider: e.target.value }))}
                    >
                      <option value="anthropic">Anthropic</option>
                      <option value="openai">OpenAI</option>
                      <option value="ollama">Ollama</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--c-text-secondary)' }}>
                      Model ID
                    </label>
                    <input
                      className="w-full px-3 py-2 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500"
                      style={{ background: 'var(--c-bg-base)', border: '1px solid var(--c-border-strong)', color: 'var(--c-text-primary)' }}
                      placeholder="claude-opus-4-6"
                      value={form.model_id}
                      onChange={(e) => setForm((p) => ({ ...p, model_id: e.target.value }))}
                    />
                  </div>
                </div>

                {/* ID + Email previews */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs shrink-0" style={{ color: 'var(--c-text-muted)' }}>
                      ID:
                    </span>
                    <span
                      className="flex-1 px-2 py-1 rounded text-xs font-mono truncate"
                      style={{ background: 'var(--c-bg-base)', color: 'var(--c-text-secondary)', border: '1px solid var(--c-border)' }}
                    >
                      {previewId}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs shrink-0" style={{ color: 'var(--c-text-muted)' }}>
                      Email:
                    </span>
                    <span
                      className="flex-1 px-2 py-1 rounded text-xs font-mono truncate"
                      style={{ background: 'var(--c-bg-base)', color: 'var(--c-text-secondary)', border: '1px solid var(--c-border)' }}
                    >
                      {previewEmail}
                    </span>
                  </div>
                </div>
              </>
            )}

            {tab === 'integrations' && (
              <div className="space-y-3">
                {[
                  { name: 'Google Workspace', phase: 'Phase 4' },
                  { name: 'Slack', phase: 'Phase 2' },
                ].map((item) => (
                  <div
                    key={item.name}
                    className="rounded-lg p-4"
                    style={{ background: 'var(--c-bg-panel)', border: '1px solid var(--c-border-muted)' }}
                  >
                    <p className="text-sm text-white/60 font-medium mb-1">{item.name}</p>
                    <p className="text-xs" style={{ color: 'var(--c-text-faint)' }}>
                      Available in {item.phase}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {tab === 'resources' && (
              <div className="space-y-3">
                <p className="text-xs" style={{ color: 'var(--c-text-muted)' }}>
                  Leave blank to use team defaults.
                </p>
                {[
                  { key: 'cpu' as const, label: 'CPU', placeholder: team.default_cpu },
                  { key: 'memory' as const, label: 'Memory', placeholder: team.default_memory },
                  { key: 'disk' as const, label: 'Disk', placeholder: team.default_disk },
                ].map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className="block text-xs mb-1" style={{ color: 'var(--c-text-secondary)' }}>
                      {label}
                    </label>
                    <input
                      className="w-full px-3 py-2 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500"
                      style={{ background: 'var(--c-bg-base)', border: '1px solid var(--c-border-strong)', color: 'var(--c-text-primary)' }}
                      placeholder={`Default: ${placeholder}`}
                      value={form[key]}
                      onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            className="shrink-0 px-6 py-4 flex flex-col gap-2"
            style={{ borderTop: '1px solid var(--c-border-muted)' }}
          >
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex gap-2">
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
                disabled={saving}
                className="flex-1 py-2 rounded text-sm font-medium text-white transition-colors disabled:opacity-50"
                style={{ background: '#2563eb' }}
              >
                {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add member'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
