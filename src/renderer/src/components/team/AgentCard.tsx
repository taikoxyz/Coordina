import { useEffect, useMemo, useState } from 'react'
import { deriveAgentEmail } from '../../../../shared/email'
import type { AgentSpec } from '../../../../shared/types'
import { PERSONA_CATALOG, getPersonasByDivision } from '../../../../shared/personaCatalog'
import { useModels } from '../../hooks/useModels'
import { Button, Input, Label, ReadField, Select, Textarea } from '../ui'
import { Tooltip } from '../ui/tooltip'

interface Props {
  teamSlug: string
  agent: AgentSpec
  isEditing: boolean
  onChange: (updated: AgentSpec) => void
  teamEmail?: string
  isLead?: boolean
  defaultImage?: string
  defaultCpu?: number
  defaultDiskGi?: number
}

export function AgentCard({
  teamSlug,
  agent,
  isEditing,
  onChange,
  teamEmail,
  isLead,
  defaultImage,
  defaultCpu,
  defaultDiskGi,
}: Props) {
  const { data: models } = useModels('openrouter')
  const derivedEmail = teamEmail ? deriveAgentEmail(teamEmail, agent.slug, isLead ?? false) : undefined
  const effectiveEmail = agent.email || derivedEmail
  const [telegramToken, setTelegramToken] = useState('')
  const [tokenMasked, setTokenMasked] = useState<string | null>(null)
  const [tokenBusy, setTokenBusy] = useState(false)
  const [tokenError, setTokenError] = useState<string | null>(null)
  const [orKey, setOrKey] = useState('')
  const [orKeyMasked, setOrKeyMasked] = useState<string | null>(null)
  const [orKeyBusy, setOrKeyBusy] = useState(false)
  const [orKeyError, setOrKeyError] = useState<string | null>(null)
  const set = (key: keyof AgentSpec) => (value: unknown) =>
    onChange({ ...agent, [key]: value })

  const personasByDivision = useMemo(() => getPersonasByDivision(), [])
  const [selectedTemplate, setSelectedTemplate] = useState<string>(() => {
    if (agent.role || agent.persona || (agent.skills ?? []).length > 0) {
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
      onChange({ ...agent, title: undefined, role: '', persona: '', skills: [] })
      return
    }
    if (!templateId) return
    const tmpl = PERSONA_CATALOG.find(p => p.id === templateId)
    if (!tmpl) return
    onChange({ ...agent, title: tmpl.name, role: tmpl.role, persona: tmpl.persona, skills: tmpl.skills })
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
    window.api
      .invoke('teams:getAgentOpenRouterKeyMasked', {
        teamSlug,
        agentSlug: agent.slug,
      })
      .then((value) => {
        if (active) setOrKeyMasked((value as string | null) ?? null)
      })
      .catch(() => { /* non-fatal */ })
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

  const syncAvatar = async () => {
    setTokenBusy(true)
    setTokenError(null)
    try {
      await window.api.invoke('teams:syncAgentTelegramAvatar', {
        teamSlug,
        agentSlug: agent.slug,
      })
    } catch (e) {
      setTokenError((e as Error).message)
    } finally {
      setTokenBusy(false)
    }
  }

  const saveOrKey = async () => {
    setOrKeyBusy(true)
    setOrKeyError(null)
    try {
      await window.api.invoke('teams:setAgentOpenRouterKey', {
        teamSlug,
        agentSlug: agent.slug,
        key: orKey,
      })
      const masked = (await window.api.invoke(
        'teams:getAgentOpenRouterKeyMasked',
        { teamSlug, agentSlug: agent.slug },
      )) as string | null
      setOrKeyMasked(masked)
      setOrKey('')
    } catch (e) {
      setOrKeyError((e as Error).message)
    } finally {
      setOrKeyBusy(false)
    }
  }

  const clearOrKey = async () => {
    setOrKeyBusy(true)
    setOrKeyError(null)
    try {
      await window.api.invoke('teams:setAgentOpenRouterKey', {
        teamSlug,
        agentSlug: agent.slug,
        key: '',
      })
      setOrKeyMasked(null)
      setOrKey('')
    } catch (e) {
      setOrKeyError((e as Error).message)
    } finally {
      setOrKeyBusy(false)
    }
  }

  return (
    <div className="space-y-3">
        {isEditing ? (
          <>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Persona</h3>
              <div className="space-y-3">
                <div>
                  <Label>Title</Label>
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
              </div>
            </div>

            {selectedTemplate && (
              <div>
                <div className="space-y-3">
                  <div>
                    <Label>Role <Tooltip content="Used as the 'Creature' field in identity.md and to contextualize the agent in agents.md"><span className="text-gray-300 cursor-help">ⓘ</span></Tooltip></Label>
                    <Input
                      value={agent.role}
                      onChange={(e) => set('role')(e.target.value)}
                      placeholder="Researcher"
                    />
                  </div>
                  <div>
                    <Label>Persona <Tooltip content="Used as 'Vibe' in identity.md and as the core description in soul.md under 'Core Truths'"><span className="text-gray-300 cursor-help">ⓘ</span></Tooltip></Label>
                    <Textarea
                      rows={3}
                      value={agent.persona}
                      onChange={(e) => set('persona')(e.target.value)}
                      placeholder="Describe this agent's personality..."
                    />
                  </div>
                  <div>
                    <Label>Skills (comma-separated) <Tooltip content="Each skill becomes a bullet point in skills.md, telling the agent what it can do"><span className="text-gray-300 cursor-help">ⓘ</span></Tooltip></Label>
                    <Textarea
                      rows={2}
                      value={(agent.skills ?? []).join(', ')}
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
                </div>
              </div>
            )}

            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">OpenRouter Models</h3>
              <div className="space-y-2">
                {(agent.models ?? []).map((modelId, mi) => (
                  <div key={mi} className="flex items-center gap-2">
                    <Select
                      value={modelId}
                      onChange={(e) => {
                        const updated = [...agent.models]
                        updated[mi] = e.target.value
                        onChange({ ...agent, models: updated })
                      }}
                    >
                      <option value="">Select model...</option>
                      {(models ?? []).map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </Select>
                    <Button
                      variant="ghost-destructive"
                      size="sm"
                      onClick={() => onChange({ ...agent, models: (agent.models ?? []).filter((_, j) => j !== mi) })}
                      title="Remove model"
                    >
                      &times;
                    </Button>
                    {mi === 0 && <span className="text-xs text-gray-400 shrink-0">primary</span>}
                    {mi > 0 && <span className="text-xs text-gray-400 shrink-0">fallback</span>}
                  </div>
                ))}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onChange({ ...agent, models: [...(agent.models ?? []), ''] })}
                >
                  + Add model
                </Button>
              </div>
              <div className="mt-3">
                <Label>API Key override <Tooltip content="Overrides the team-level OpenRouter key for this agent only. Useful for per-agent billing tracking."><span className="text-gray-300 cursor-help">ⓘ</span></Tooltip></Label>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Input
                      mono
                      type="password"
                      value={orKey}
                      onChange={(e) => setOrKey(e.target.value)}
                      placeholder={orKeyMasked ? 'Update key' : 'sk-or-...'}
                    />
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={saveOrKey}
                      disabled={orKeyBusy || !teamSlug || !agent.slug}
                      className="shrink-0"
                    >
                      Save
                    </Button>
                  </div>
                  {orKeyMasked && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={clearOrKey}
                      disabled={orKeyBusy}
                      className="shrink-0"
                    >
                      Clear
                    </Button>
                  )}
                </div>
                {orKeyMasked && (
                  <p className="text-xs text-gray-400 font-mono mt-0.5">{orKeyMasked}</p>
                )}
                {orKeyError && (
                  <p className="text-xs text-red-600 mt-0.5">{orKeyError}</p>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Telegram</h3>
              <div className="space-y-3">
                <div>
                  <Label>Bot ID</Label>
                  <Input
                    mono
                    value={agent.telegramBot ?? ''}
                    onChange={(e) => set('telegramBot')(e.target.value || undefined)}
                    placeholder="123456789"
                  />
                </div>
                <div>
                  <Label>Token</Label>
                  <div className="space-y-1.5">
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
                    </div>
                    {tokenMasked && (
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={clearToken}
                          disabled={tokenBusy}
                          className="shrink-0"
                        >
                          Clear
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={syncAvatar}
                          disabled={tokenBusy}
                          className="shrink-0"
                          title="Push agent avatar to Telegram bot profile photo"
                        >
                          Sync Avatar
                        </Button>
                      </div>
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
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Gmail</h3>
              <div>
                <Label>Email override</Label>
                <Input
                  mono
                  value={agent.email ?? ''}
                  onChange={(e) => set('email')(e.target.value || undefined)}
                  placeholder={derivedEmail ?? 'No team email configured'}
                />
                {!agent.email && derivedEmail && (
                  <p className="text-xs text-gray-400 font-mono mt-0.5">Auto: {derivedEmail}</p>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Resources</h3>
              <div className="space-y-3">
                <div>
                  <Label>Container image</Label>
                  <Input
                    mono
                    value={agent.image ?? ''}
                    onChange={(e) => set('image')(e.target.value || undefined)}
                    placeholder="—"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
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
                      placeholder={`${defaultCpu ?? 1}`}
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
                      placeholder={`${defaultDiskGi ?? 10}`}
                    />
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-1">About</h4>
              <ReadField label="Slug" value={agent.slug} monospace />
            </div>

            <hr className="border-gray-200" />

            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-1">Persona</h4>
              <ReadField label="Title" value={agent.title} />
              <ReadField label="Role" value={agent.role} full tooltip="Used as the 'Creature' field in identity.md and to contextualize the agent in agents.md" />
              <ReadField label="Persona" value={agent.persona?.trim() || undefined} full tooltip="Used as 'Vibe' in identity.md and as the core description in soul.md under 'Core Truths'" />
              <ReadField
                label="Skills"
                value={(agent.skills ?? []).length > 0 ? (agent.skills ?? []).join(', ') : undefined}
                full
                tooltip="Each skill becomes a bullet point in skills.md, telling the agent what it can do"
              />
            </div>

            <hr className="border-gray-200" />

            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-1">OpenRouter Models</h4>
              {(agent.models ?? []).length > 0 ? (agent.models ?? []).map((m, mi) => (
                <ReadField key={mi} label={mi === 0 ? 'Primary' : `Fallback ${mi}`} value={m} monospace />
              )) : (
                <ReadField label="Model" value={undefined} />
              )}
            </div>

            <hr className="border-gray-200" />

            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-1">Telegram</h4>
              <ReadField label="Bot ID" value={agent.telegramBot} monospace />
              <ReadField label="Token" value={tokenMasked ?? undefined} monospace />
              {tokenError && (
                <p className="text-xs text-red-600 mt-0.5">{tokenError}</p>
              )}
            </div>

            <hr className="border-gray-200" />

            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-1">Gmail</h4>
              <ReadField label="Email" value={effectiveEmail} monospace />
              {agent.email && derivedEmail && agent.email !== derivedEmail && (
                <p className="text-xs text-amber-600 mt-0.5">Override (derived: {derivedEmail})</p>
              )}
            </div>

            <hr className="border-gray-200" />

            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-1">Resources</h4>
              <ReadField label="Container image" value={agent.image} defaultValue={defaultImage ?? 'alpine/openclaw:latest'} />
              <ReadField label="CPU (cores)" value={agent.cpu} defaultValue={defaultCpu ?? 1} />
              <ReadField label="Disk (Gi)" value={agent.diskGi} defaultValue={defaultDiskGi ?? 10} />
            </div>
          </>
        )}
      </div>
  )
}
