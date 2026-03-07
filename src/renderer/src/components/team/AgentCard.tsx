import { useEffect, useMemo, useState } from 'react'
import { Trash2, Check, Shield } from 'lucide-react'
import { cn } from '../../lib/utils'
import { deriveSlug } from '../../../../shared/slug'
import type { AgentSpec } from '../../../../shared/types'
import { PERSONA_CATALOG, getPersonasByDivision } from '../../../../shared/personaCatalog'
import { InfoGroup, InfoRow, InfoBlock } from '../ui/InfoGroup'

interface Props {
  teamSlug: string
  agent: AgentSpec
  isFirst: boolean
  providerSlugs: string[]
  isEditing: boolean
  onEdit: () => void
  onSave: () => Promise<void>
  isSaving: boolean
  onChange: (updated: AgentSpec) => void
  onDelete: () => void
}

const inputCls =
  'w-full rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
const labelCls = 'block text-xs font-medium text-gray-500 mb-1'

export function AgentCard({
  teamSlug,
  agent,
  isFirst,
  providerSlugs,
  isEditing,
  onEdit,
  onSave,
  isSaving,
  onChange,
  onDelete,
}: Props) {
  const [telegramToken, setTelegramToken] = useState('')
  const [tokenMasked, setTokenMasked] = useState<string | null>(null)
  const [tokenBusy, setTokenBusy] = useState(false)
  const [tokenError, setTokenError] = useState<string | null>(null)
  const set = (key: keyof AgentSpec) => (value: unknown) =>
    onChange({ ...agent, [key]: value })

  const personasByDivision = useMemo(() => getPersonasByDivision(), [])
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')

  const applyTemplate = (templateId: string) => {
    setSelectedTemplate(templateId)
    if (templateId === 'custom') {
      onChange({ ...agent, role: '', emoji: undefined, persona: '', skills: [] })
      return
    }
    if (!templateId) return
    const tmpl = PERSONA_CATALOG.find(p => p.id === templateId)
    if (!tmpl) return
    onChange({ ...agent, role: tmpl.role, emoji: tmpl.emoji, persona: tmpl.persona, skills: tmpl.skills })
  }

  const handleNameChange = (name: string) => {
    onChange({ ...agent, name, slug: name ? deriveSlug(name) : '' })
  }

  useEffect(() => {
    if (!teamSlug || !agent.slug) return
    let active = true
    window.api
      .invoke('teams:getAgentTelegramTokenMasked', {
        teamSlug,
        agentSlug: agent.slug,
      })
      .then((value) => {
        if (active) setTokenMasked((value as string | null) ?? null)
      })
      .catch((e) => {
        if (active) setTokenError((e as Error).message)
      })
    return () => {
      active = false
    }
  }, [teamSlug, agent.slug])

  const saveToken = async () => {
    setTokenBusy(true)
    setTokenError(null)
    try {
      await window.api.invoke('teams:setAgentTelegramToken', {
        teamSlug,
        agentSlug: agent.slug,
        token: telegramToken,
      })
      const masked = (await window.api.invoke(
        'teams:getAgentTelegramTokenMasked',
        { teamSlug, agentSlug: agent.slug },
      )) as string | null
      setTokenMasked(masked)
      setTelegramToken('')
    } catch (e) {
      setTokenError((e as Error).message)
    } finally {
      setTokenBusy(false)
    }
  }

  const clearToken = async () => {
    setTokenBusy(true)
    setTokenError(null)
    try {
      await window.api.invoke('teams:setAgentTelegramToken', {
        teamSlug,
        agentSlug: agent.slug,
        token: '',
      })
      setTokenMasked(null)
      setTelegramToken('')
    } catch (e) {
      setTokenError((e as Error).message)
    } finally {
      setTokenBusy(false)
    }
  }

  return (
    <div className={cn('rounded-lg border border-gray-200 bg-white')}>
      <div className="flex items-center gap-3 px-4 py-3">
        {agent.emoji ? (
          <span className="text-lg">{agent.emoji}</span>
        ) : (
          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-500">
            {(agent.name || '?').charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-base font-medium text-gray-900 truncate">
              {agent.name || 'Unnamed agent'}
            </span>
            {isFirst && (
              <span className="inline-flex items-center gap-0.5 text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                <Shield className="w-3 h-3" /> Lead
              </span>
            )}
            {tokenMasked && (
              <span className="inline-flex items-center gap-0.5 text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                <Check className="w-3 h-3" /> TG
              </span>
            )}
          </div>
          <div className="text-sm text-gray-400 truncate">
            {agent.provider && (
              <span className="font-mono">{agent.provider}</span>
            )}
            {agent.role && <span className="ml-2">{agent.role}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isEditing ? (
            <>
              <button
                onClick={() => void onSave()}
                disabled={isSaving}
                className="px-3 py-1.5 text-base font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={onDelete}
                className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <button
              onClick={onEdit}
              className="px-3 py-1.5 text-base font-medium rounded-md bg-gray-900 text-white hover:bg-gray-800 transition-colors"
            >
              Edit agent
            </button>
          )}
        </div>
      </div>

      <div className="px-4 pb-4 pt-1 border-t border-gray-100 space-y-3">
        {isEditing ? (
          <>
            <div>
              <label className={labelCls}>Persona Template</label>
              <select
                value={selectedTemplate}
                onChange={(e) => applyTemplate(e.target.value)}
                className={inputCls}
              >
                <option value="">— select persona —</option>
                <option value="custom">✏️ Custom (manual entry)</option>
                {Array.from(personasByDivision.entries()).map(([division, templates]) => (
                  <optgroup key={division} label={division}>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>{t.emoji} {t.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Name</label>
                <input
                  className={inputCls}
                  value={agent.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Alice"
                />
                {agent.slug && (
                  <p className="text-xs text-gray-400 font-mono mt-0.5">
                    {agent.slug}
                  </p>
                )}
              </div>
              <div>
                <label className={labelCls}>Provider</label>
                <select
                  value={agent.provider}
                  onChange={(e) => set('provider')(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Select...</option>
                  {providerSlugs.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedTemplate && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Role</label>
                    <input
                      className={inputCls}
                      value={agent.role}
                      onChange={(e) => set('role')(e.target.value)}
                      placeholder="Researcher"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Emoji</label>
                    <input
                      className={inputCls}
                      value={agent.emoji ?? ''}
                      onChange={(e) => set('emoji')(e.target.value || undefined)}
                      placeholder="🤖"
                    />
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Persona</label>
                  <textarea
                    className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows={3}
                    value={agent.persona}
                    onChange={(e) => set('persona')(e.target.value)}
                    placeholder="Describe this agent's personality..."
                  />
                </div>

                <div>
                  <label className={labelCls}>Skills (comma-separated)</label>
                  <input
                    className={inputCls}
                    value={agent.skills.join(', ')}
                    onChange={(e) =>
                      set('skills')(
                        e.target.value
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      )
                    }
                    placeholder="research, writing"
                  />
                </div>
              </>
            )}

            <div>
              <label className={labelCls}>Avatar URL</label>
              <input
                className={inputCls + ' font-mono'}
                value={agent.avatar ?? ''}
                onChange={(e) => set('avatar')(e.target.value || undefined)}
                placeholder="https://..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Telegram Bot ID</label>
                <input
                  className={inputCls + ' font-mono'}
                  value={agent.telegramBot ?? ''}
                  onChange={(e) => set('telegramBot')(e.target.value || undefined)}
                  placeholder="123456789"
                />
              </div>
              <div>
                <label className={labelCls}>Telegram Token</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="password"
                    value={telegramToken}
                    onChange={(e) => setTelegramToken(e.target.value)}
                    placeholder={tokenMasked ? 'Update token' : '123456:ABC...'}
                    className={inputCls + ' font-mono'}
                  />
                  <button
                    onClick={saveToken}
                    disabled={tokenBusy || !teamSlug || !agent.slug}
                    className="px-2.5 py-1.5 text-base font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 shrink-0"
                  >
                    Save
                  </button>
                  {tokenMasked && (
                    <button
                      onClick={clearToken}
                      disabled={tokenBusy}
                      className="px-2.5 py-1.5 text-base font-medium rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50 shrink-0"
                    >
                      Clear
                    </button>
                  )}
                </div>
                {tokenMasked && (
                  <p className="text-xs text-gray-400 font-mono mt-0.5">
                    {tokenMasked}
                  </p>
                )}
                {tokenError && (
                  <p className="text-xs text-red-600 mt-0.5">{tokenError}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Container image</label>
                <input
                  className={inputCls + ' font-mono'}
                  value={agent.image ?? ''}
                  onChange={(e) => set('image')(e.target.value || undefined)}
                  placeholder="Default"
                />
              </div>
              <div>
                <label className={labelCls}>CPU (cores)</label>
                <input
                  type="number"
                  min={0.1}
                  step={0.5}
                  className={inputCls}
                  value={agent.cpu ?? ''}
                  onChange={(e) =>
                    set('cpu')(
                      e.target.value ? parseFloat(e.target.value) : undefined,
                    )
                  }
                  placeholder="1"
                />
              </div>
              <div>
                <label className={labelCls}>Disk (Gi)</label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  className={inputCls}
                  value={agent.diskGi ?? ''}
                  onChange={(e) =>
                    set('diskGi')(
                      e.target.value ? parseInt(e.target.value) : undefined,
                    )
                  }
                  placeholder="10"
                />
              </div>
            </div>
          </>
        ) : (
          <div>
            <InfoGroup title="Identity">
              <InfoRow label="Emoji" value={agent.emoji} />
              <InfoRow label="Avatar URL" value={agent.avatar} />
              <InfoRow label="Provider" value={agent.provider} />
            </InfoGroup>

            <InfoGroup title="Telegram">
              <InfoRow label="Bot ID" value={agent.telegramBot} />
              <InfoRow label="Token" value={tokenMasked ?? undefined} />
              {tokenError && (
                <p className="text-xs text-red-600 pb-1">{tokenError}</p>
              )}
            </InfoGroup>

            <InfoGroup title="Infrastructure">
              <InfoRow label="Container image" value={agent.image} />
              <InfoRow label="CPU (cores)" value={agent.cpu} />
              <InfoRow label="Disk (Gi)" value={agent.diskGi} />
            </InfoGroup>

            <InfoGroup title="Persona">
              <InfoBlock value={agent.persona} />
              <InfoRow label="Skills" value={agent.skills.length > 0 ? agent.skills.join(', ') : undefined} />
            </InfoGroup>
          </div>
        )}
      </div>
    </div>
  )
}
