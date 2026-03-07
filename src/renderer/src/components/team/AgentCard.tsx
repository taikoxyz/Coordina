import { useEffect, useMemo, useState } from 'react'
import { Crown, Pencil, Send } from 'lucide-react'
import { deriveSlug } from '../../../../shared/slug'
import type { AgentSpec } from '../../../../shared/types'
import { PERSONA_CATALOG, getPersonasByDivision } from '../../../../shared/personaCatalog'
import { agentTextColor } from '../../lib/agentColors'
import { Badge, Button, Input, Label, ReadField, Select, Textarea } from '../ui'

interface Props {
  teamSlug: string
  agent: AgentSpec
  index: number
  isFirst: boolean
  providerSlugs: string[]
  isEditing: boolean
  onEdit: () => void
  onCancel: () => void
  onSave: () => Promise<void>
  isSaving: boolean
  onChange: (updated: AgentSpec) => void
  onDelete: () => void
}

export function AgentCard({
  teamSlug,
  agent,
  index,
  isFirst,
  providerSlugs,
  isEditing,
  onEdit,
  onCancel,
  onSave,
  isSaving,
  onChange,
  onDelete,
}: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [telegramToken, setTelegramToken] = useState('')
  const [tokenMasked, setTokenMasked] = useState<string | null>(null)
  const [tokenBusy, setTokenBusy] = useState(false)
  const [tokenError, setTokenError] = useState<string | null>(null)
  const set = (key: keyof AgentSpec) => (value: unknown) =>
    onChange({ ...agent, [key]: value })

  const personasByDivision = useMemo(() => getPersonasByDivision(), [])
  const [selectedTemplate, setSelectedTemplate] = useState<string>(() => {
    if (agent.role || agent.persona || agent.skills.length > 0) {
      const match = PERSONA_CATALOG.find(
        (p) => p.role === agent.role && p.persona === agent.persona,
      )
      return match?.id ?? 'custom'
    }
    return ''
  })

  const applyTemplate = (templateId: string) => {
    setSelectedTemplate(templateId)
    if (templateId === 'custom') {
      onChange({ ...agent, role: '', persona: '', skills: [] })
      return
    }
    if (!templateId) return
    const tmpl = PERSONA_CATALOG.find(p => p.id === templateId)
    if (!tmpl) return
    onChange({ ...agent, role: tmpl.role, persona: tmpl.persona, skills: tmpl.skills })
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`text-xs font-semibold uppercase tracking-[0.16em] ${agentTextColor(index)}`}>
            {agent.name || 'Unnamed agent'}
          </div>
          {isFirst && (
            <Badge variant="primary" size="sm">
              <Crown className="w-3 h-3" /> Lead
            </Badge>
          )}
          {tokenMasked && (
            <Badge variant="success" size="sm">
              <Send className="w-3 h-3" /> TG
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isEditing ? (
            <>
              {confirmDelete ? (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={onDelete}
                >
                  Confirm delete
                </Button>
              ) : (
                <Button
                  variant="ghost-destructive"
                  size="sm"
                  onClick={() => setConfirmDelete(true)}
                >
                  Delete
                </Button>
              )}
              <Button
                variant="primary"
                size="sm"
                onClick={() => void onSave()}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => { setConfirmDelete(false); onCancel() }} disabled={isSaving}>
                Cancel
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="icon" onClick={onEdit} title="Edit agent">
              <Pencil className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {isEditing ? (
          <>
            <div>
              <Label>Persona Template</Label>
              <Select
                value={selectedTemplate}
                onChange={(e) => applyTemplate(e.target.value)}
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
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Name</Label>
                <Input
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
                <Label>Provider</Label>
                <Select
                  value={agent.provider}
                  onChange={(e) => set('provider')(e.target.value)}
                >
                  <option value="">Select...</option>
                  {providerSlugs.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {selectedTemplate && (
              <>
                <div>
                  <Label>Role</Label>
                  <Input
                    value={agent.role}
                    onChange={(e) => set('role')(e.target.value)}
                    placeholder="Researcher"
                  />
                </div>

                <div>
                  <Label>Persona</Label>
                  <Textarea
                    rows={3}
                    value={agent.persona}
                    onChange={(e) => set('persona')(e.target.value)}
                    placeholder="Describe this agent's personality..."
                  />
                </div>

                <div>
                  <Label>Skills (comma-separated)</Label>
                  <Input
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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Telegram Bot ID</Label>
                <Input
                  mono
                  value={agent.telegramBot ?? ''}
                  onChange={(e) => set('telegramBot')(e.target.value || undefined)}
                  placeholder="123456789"
                />
              </div>
              <div>
                <Label>Telegram Token</Label>
                <div className="flex items-center gap-1.5">
                  <Input
                    mono
                    type="password"
                    value={telegramToken}
                    onChange={(e) => setTelegramToken(e.target.value)}
                    placeholder={tokenMasked ? 'Update token' : '123456:ABC...'}
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={saveToken}
                    disabled={tokenBusy || !teamSlug || !agent.slug}
                    className="shrink-0"
                  >
                    Save
                  </Button>
                  {tokenMasked && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={clearToken}
                      disabled={tokenBusy}
                      className="shrink-0"
                    >
                      Clear
                    </Button>
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
                <Label>Container image</Label>
                <Input
                  mono
                  value={agent.image ?? ''}
                  onChange={(e) => set('image')(e.target.value || undefined)}
                  placeholder="Default"
                />
              </div>
              <div>
                <Label>CPU (cores)</Label>
                <Input
                  type="number"
                  min={0.1}
                  step={0.5}
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
                <Label>Disk (Gi)</Label>
                <Input
                  type="number"
                  min={1}
                  step={1}
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
          <>
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-1">Agent details</h4>
              <ReadField label="Provider" value={agent.provider} monospace />
              <ReadField label="Role" value={agent.role} />
            </div>

            <hr className="border-gray-200" />

            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-1">Telegram integration</h4>
              <ReadField label="Bot ID" value={agent.telegramBot} monospace />
              <ReadField label="Token" value={tokenMasked ?? undefined} monospace />
              {tokenError && (
                <p className="text-xs text-red-600 mt-0.5">{tokenError}</p>
              )}
            </div>

            <hr className="border-gray-200" />

            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-1">Infrastructure</h4>
              <ReadField label="Container image" value={agent.image} monospace placeholder="Default" />
              <ReadField label="CPU (cores)" value={agent.cpu} placeholder="Default" />
              <ReadField label="Disk (Gi)" value={agent.diskGi} placeholder="Default" />
            </div>

            <hr className="border-gray-200" />

            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-1">Persona</h4>
              <ReadField label="Persona" value={agent.persona?.trim() || undefined} />
              <ReadField
                label="Skills"
                value={agent.skills.length > 0 ? agent.skills.join(', ') : undefined}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
