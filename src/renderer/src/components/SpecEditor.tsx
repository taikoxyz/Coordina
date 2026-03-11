import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Check, ExternalLink, Loader2, Pencil } from 'lucide-react'
import type { TeamSpec } from '../../../shared/types'
import { DEFAULT_CPU, DEFAULT_MEMORY_GI, DEFAULT_DISK_GI } from '../../../shared/podDefaults'
import { Button, DialogShell, Input, Label, ReadField, Textarea } from './ui'

export interface SpecEditorProps {
  spec: TeamSpec
  onSpecChange: (spec: TeamSpec) => void
  isEditing: boolean
  onEdit: () => void
  onCancel: () => void
  onSave: () => Promise<void>
  onDelete: () => void
  isSaving: boolean
}

export function SpecEditor({ spec, onSpecChange, isEditing, onEdit, onCancel, onSave, onDelete, isSaving }: SpecEditorProps) {
  const [deleteOpen, setDeleteOpen] = useState(false)

  const set = useCallback(
    (key: keyof TeamSpec) => (value: unknown) => {
      onSpecChange({ ...spec, [key]: value })
    },
    [spec, onSpecChange],
  )

  const [emailPassword, setEmailPassword] = useState('')
  const [emailPasswordMasked, setEmailPasswordMasked] = useState<string | null>(null)
  const [emailPasswordBusy, setEmailPasswordBusy] = useState(false)
  const [emailPasswordError, setEmailPasswordError] = useState<string | null>(null)
  const [ghToken, setGhToken] = useState('')
  const [ghTokenMasked, setGhTokenMasked] = useState<string | null>(null)
  const [ghTokenBusy, setGhTokenBusy] = useState(false)
  const [ghTokenError, setGhTokenError] = useState<string | null>(null)
  const [orKey, setOrKey] = useState('')
  const [orKeyMasked, setOrKeyMasked] = useState<string | null>(null)
  const [orKeyBusy, setOrKeyBusy] = useState(false)
  const [orKeyError, setOrKeyError] = useState<string | null>(null)
  const [mcRegState, setMcRegState] = useState<'idle' | 'registering' | 'done' | 'error'>('idle')
  const [mcUrl, setMcUrl] = useState<string | null>(null)
  const [mcAdminPassword, setMcAdminPassword] = useState<string | null>(null)
  const [mcPasswordCopied, setMcPasswordCopied] = useState(false)
  const [mcApiKey, setMcApiKey] = useState<string | null>(null)
  const [mcApiKeyCopied, setMcApiKeyCopied] = useState(false)

  useEffect(() => {
    if (!spec.slug || spec.missionControlEnabled === false) return
    let active = true
    void window.api
      .invoke('teams:getMcAdminPassword', { teamSlug: spec.slug })
      .then((value) => { if (active) setMcAdminPassword((value as string | null) ?? null) })
      .catch(() => { /* ignore */ })
    void window.api
      .invoke('teams:getMcApiKey', { teamSlug: spec.slug })
      .then((value) => { if (active) setMcApiKey((value as string | null) ?? null) })
      .catch(() => { /* ignore */ })
    return () => { active = false }
  }, [spec.slug, spec.missionControlEnabled])

  useEffect(() => {
    if (!spec.slug) return
    let active = true
    window.api
      .invoke('teams:getGitHubTokenMasked', { teamSlug: spec.slug })
      .then((value) => { if (active) setGhTokenMasked((value as string | null) ?? null) })
      .catch((e) => { if (active) setGhTokenError((e as Error).message) })
    return () => { active = false }
  }, [spec.slug])

  useEffect(() => {
    if (!spec.slug) return
    let active = true
    window.api
      .invoke('teams:getOpenRouterKeyMasked', { teamSlug: spec.slug })
      .then((value) => { if (active) setOrKeyMasked((value as string | null) ?? null) })
      .catch((e) => { if (active) setOrKeyError((e as Error).message) })
    return () => { active = false }
  }, [spec.slug])

  useEffect(() => {
    if (!spec.slug || !spec.teamEmail) { setEmailPasswordMasked(null); return }
    let active = true
    window.api
      .invoke('teams:getTeamEmailPasswordMasked', { teamSlug: spec.slug })
      .then((value) => { if (active) setEmailPasswordMasked((value as string | null) ?? null) })
      .catch((e) => { if (active) setEmailPasswordError((e as Error).message) })
    return () => { active = false }
  }, [spec.slug, spec.teamEmail])

  const saveEmailPassword = async () => {
    setEmailPasswordBusy(true)
    setEmailPasswordError(null)
    try {
      await window.api.invoke('teams:setTeamEmailPassword', { teamSlug: spec.slug, password: emailPassword })
      const masked = (await window.api.invoke('teams:getTeamEmailPasswordMasked', { teamSlug: spec.slug })) as string | null
      setEmailPasswordMasked(masked)
      setEmailPassword('')
    } catch (e) {
      setEmailPasswordError((e as Error).message)
    } finally {
      setEmailPasswordBusy(false)
    }
  }

  const clearEmailPassword = async () => {
    setEmailPasswordBusy(true)
    setEmailPasswordError(null)
    try {
      await window.api.invoke('teams:setTeamEmailPassword', { teamSlug: spec.slug, password: '' })
      setEmailPasswordMasked(null)
      setEmailPassword('')
    } catch (e) {
      setEmailPasswordError((e as Error).message)
    } finally {
      setEmailPasswordBusy(false)
    }
  }

  const saveGhToken = async () => {
    setGhTokenBusy(true)
    setGhTokenError(null)
    try {
      await window.api.invoke('teams:setGitHubToken', { teamSlug: spec.slug, token: ghToken })
      const masked = (await window.api.invoke('teams:getGitHubTokenMasked', { teamSlug: spec.slug })) as string | null
      setGhTokenMasked(masked)
      setGhToken('')
    } catch (e) {
      setGhTokenError((e as Error).message)
    } finally {
      setGhTokenBusy(false)
    }
  }

  const clearGhToken = async () => {
    setGhTokenBusy(true)
    setGhTokenError(null)
    try {
      await window.api.invoke('teams:setGitHubToken', { teamSlug: spec.slug, token: '' })
      setGhTokenMasked(null)
      setGhToken('')
    } catch (e) {
      setGhTokenError((e as Error).message)
    } finally {
      setGhTokenBusy(false)
    }
  }

  const saveOrKey = async () => {
    if (!spec.slug || !orKey.trim()) return
    setOrKeyBusy(true)
    setOrKeyError(null)
    try {
      await window.api.invoke('teams:setOpenRouterKey', { teamSlug: spec.slug, key: orKey })
      const masked = (await window.api.invoke('teams:getOpenRouterKeyMasked', { teamSlug: spec.slug })) as string | null
      setOrKeyMasked(masked)
      setOrKey('')
    } catch (e) {
      setOrKeyError((e as Error).message)
    } finally {
      setOrKeyBusy(false)
    }
  }

  const clearOrKey = async () => {
    if (!spec.slug) return
    setOrKeyBusy(true)
    setOrKeyError(null)
    try {
      await window.api.invoke('teams:setOpenRouterKey', { teamSlug: spec.slug, key: '' })
      setOrKeyMasked(null)
      setOrKey('')
    } catch (e) {
      setOrKeyError((e as Error).message)
    } finally {
      setOrKeyBusy(false)
    }
  }

  const handleRegisterMC = useCallback(async () => {
    if (!spec.deployedEnvSlug) return
    setMcRegState('registering')
    const result = await window.api.invoke('mc:registerAgents', { teamSlug: spec.slug, envSlug: spec.deployedEnvSlug }) as { ok: boolean; reason?: string; mcUrl?: string }
    if (result.ok) {
      setMcRegState('done')
      if (result.mcUrl) setMcUrl(result.mcUrl)
    } else {
      setMcRegState('error')
    }
  }, [spec.deployedEnvSlug, spec.slug])

  if (!isEditing) {
    return (
      <>
        <div className="shrink-0 border-b border-gray-200">
          <div className="max-w-2xl mx-auto px-6 h-11 flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
              {spec.name || 'Team overview'}
            </div>
            <Button variant="ghost" size="icon" onClick={onEdit} title="Edit team">
              <Pencil className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="max-w-2xl mx-auto space-y-4 py-4 px-6">
            <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-1">About</h4>
            <ReadField label="Slug" value={spec.slug} monospace />
            <ReadField label="Agents" value={spec.agents.length} />
          </div>

          <hr className="border-gray-200" />

          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-1">Telegram</h4>
            <ReadField label="Group ID" value={spec.telegramGroupId} monospace />
            <ReadField label="Admin ID" value={spec.telegramAdminId} monospace />
          </div>

          <hr className="border-gray-200" />

          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-1">Gmail</h4>
            <ReadField label="Team email" value={spec.teamEmail} monospace />
            <ReadField label="App password" value={emailPasswordMasked ?? undefined} monospace />
            {emailPasswordError && (
              <p className="text-xs text-red-600 mt-0.5">{emailPasswordError}</p>
            )}
          </div>

          <hr className="border-gray-200" />

          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-1">GitHub</h4>
            <ReadField label="Token" value={ghTokenMasked ?? undefined} monospace />
            {ghTokenError && (
              <p className="text-xs text-red-600 mt-0.5">{ghTokenError}</p>
            )}
          </div>

          <hr className="border-gray-200" />

          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-1">OpenRouter</h4>
            <ReadField label="API Key" value={orKeyMasked ?? undefined} defaultValue="Global key" monospace />
            {orKeyError && (
              <p className="text-xs text-red-600 mt-0.5">{orKeyError}</p>
            )}
          </div>

          <hr className="border-gray-200" />

          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-1">Resources</h4>
            <ReadField label="Container image" value={spec.defaultImage} defaultValue="alpine/openclaw:latest" />
            <ReadField label="CPU (cores)" value={spec.defaultCpu} defaultValue={DEFAULT_CPU} />
            <ReadField label="Memory (Gi)" value={spec.defaultMemoryGi} defaultValue={DEFAULT_MEMORY_GI} />
            <ReadField label="Disk (Gi)" value={spec.defaultDiskGi} defaultValue={DEFAULT_DISK_GI} />
          </div>

          <hr className="border-gray-200" />

          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-1">OpenClaw</h4>
            <ReadField label="Log level" value={spec.logLevel} defaultValue="info" />
            <ReadField label="Bootstrap" value={spec.startupInstructions?.trim() || undefined} monospace full />
          </div>

          <hr className="border-gray-200" />
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-900">Mission Control</h4>
              <div className="flex items-center gap-2">
                {spec.missionControlEnabled !== false ? (
                  spec.deployedEnvSlug ? (
                    <>
                      {mcUrl && (
                        <a href={mcUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
                          Open dashboard <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      <Button variant="secondary" size="sm" onClick={() => void handleRegisterMC()} disabled={mcRegState === 'registering'}>
                        {mcRegState === 'registering' ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Registering…</> :
                         mcRegState === 'done' ? <><Check className="w-3 h-3 mr-1" />Registered</> : 'Register agents'}
                      </Button>
                    </>
                  ) : (
                    <span className="text-xs text-gray-400">Enabled — not yet deployed</span>
                  )
                ) : (
                  <span className="text-xs text-gray-400">Disabled</span>
                )}
              </div>
            </div>
            {mcRegState === 'error' && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />Registration failed — is Mission Control already deployed?
              </p>
            )}
          </div>
        </div>
      </div>
      </>
    )
  }

  return (
    <>
      <div className="shrink-0 border-b border-gray-200">
        <div className="px-6 h-11 flex items-center gap-2">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
            Edit team
          </div>
          <div className="flex-1" />
          <Button
            variant="primary"
            size="sm"
            onClick={() => void onSave()}
            disabled={isSaving || !spec.name.trim() || !spec.slug.trim()}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
            Delete
          </Button>
          <DialogShell open={deleteOpen} onOpenChange={setDeleteOpen} title="Delete team" maxWidth="max-w-sm">
            <p className="text-sm text-gray-600 mb-6">Are you sure you want to delete this team? This action cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setDeleteOpen(false)}>Cancel</Button>
              <Button variant="destructive" size="sm" onClick={() => { setDeleteOpen(false); onDelete() }}>Delete team</Button>
            </div>
          </DialogShell>
          <Button variant="secondary" size="sm" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="max-w-4xl mx-auto space-y-5 py-4 px-6">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Telegram</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Group ID</Label>
              <Input
                mono
                value={spec.telegramGroupId ?? ''}
                onChange={(e) => set('telegramGroupId')(e.target.value || undefined)}
                placeholder="-1001234567890"
              />
            </div>
            <div>
              <Label>Admin ID</Label>
              <Input
                mono
                value={spec.telegramAdminId ?? ''}
                onChange={(e) => set('telegramAdminId')(e.target.value || undefined)}
                placeholder="123456789"
              />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Gmail</h3>
          <div className="space-y-3">
            <div>
              <Label>Team email</Label>
              <Input
                mono
                value={spec.teamEmail ?? ''}
                onChange={(e) => set('teamEmail')(e.target.value || undefined)}
                placeholder="team@gmail.com"
              />
              <p className="text-xs text-gray-400 mt-0.5">Agents get plus-addressed variants (e.g., team+agent-slug@gmail.com)</p>
            </div>
            <div>
              <Label>App password</Label>
              <div className="flex items-center gap-1.5">
                <Input
                  mono
                  type="password"
                  value={emailPassword}
                  onChange={(e) => setEmailPassword(e.target.value)}
                  placeholder={emailPasswordMasked ? 'Update password' : 'Google app password'}
                />
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => void saveEmailPassword()}
                  disabled={emailPasswordBusy || !spec.slug || !spec.teamEmail}
                  className="shrink-0"
                >
                  Save
                </Button>
                {emailPasswordMasked && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void clearEmailPassword()}
                    disabled={emailPasswordBusy}
                    className="shrink-0"
                  >
                    Clear
                  </Button>
                )}
              </div>
              {emailPasswordMasked && (
                <p className="text-xs text-gray-400 font-mono mt-0.5">{emailPasswordMasked}</p>
              )}
              {emailPasswordError && (
                <p className="text-xs text-red-600 mt-0.5">{emailPasswordError}</p>
              )}
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">GitHub</h3>
          <div>
            <Label>Personal Access Token</Label>
            <div className="flex items-center gap-1.5">
              <Input
                mono
                type="password"
                value={ghToken}
                onChange={(e) => setGhToken(e.target.value)}
                placeholder={ghTokenMasked ? 'Update token' : 'ghp_...'}
              />
              <Button
                variant="primary"
                size="sm"
                onClick={() => void saveGhToken()}
                disabled={ghTokenBusy || !spec.slug || !ghToken.trim()}
                className="shrink-0"
              >
                Save
              </Button>
              {ghTokenMasked && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void clearGhToken()}
                  disabled={ghTokenBusy}
                  className="shrink-0"
                >
                  Clear
                </Button>
              )}
            </div>
            {ghTokenMasked && (
              <p className="text-xs text-gray-400 font-mono mt-0.5">{ghTokenMasked}</p>
            )}
            {ghTokenError && (
              <p className="text-xs text-red-600 mt-0.5">{ghTokenError}</p>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">OpenRouter</h3>
          <div>
            <Label>OpenRouter API Key <span className="text-gray-400 font-normal">(overrides global)</span></Label>
            <div className="flex gap-2">
              <Input
                mono
                type="password"
                value={orKey}
                onChange={(e) => setOrKey(e.target.value)}
                placeholder={orKeyMasked ? 'Update key' : 'sk-or-v1-...'}
              />
              <Button
                variant="primary"
                size="sm"
                onClick={() => void saveOrKey()}
                disabled={orKeyBusy || !spec.slug || !orKey.trim()}
                className="shrink-0"
              >
                Save
              </Button>
              {orKeyMasked && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void clearOrKey()}
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
            {!orKeyMasked && (
              <p className="text-xs text-gray-400 mt-0.5">Uses global OpenRouter key when not set</p>
            )}
            {orKeyError && (
              <p className="text-xs text-red-600 mt-0.5">{orKeyError}</p>
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
                value={spec.defaultImage ?? ''}
                onChange={(e) => set('defaultImage')(e.target.value || undefined)}
                placeholder="ghcr.io/org/openclaw:latest"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>CPU (cores)</Label>
                <Input
                  type="number"
                  min={0.1}
                  step={0.5}
                  value={spec.defaultCpu ?? ''}
                  onChange={(e) => set('defaultCpu')(e.target.value ? parseFloat(e.target.value) : undefined)}
                  placeholder={`${DEFAULT_CPU}`}
                />
              </div>
              <div>
                <Label>Memory (Gi)</Label>
                <Input
                  type="number"
                  min={1}
                  value={spec.defaultMemoryGi ?? ''}
                  onChange={(e) => set('defaultMemoryGi')(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                  placeholder={`${DEFAULT_MEMORY_GI}`}
                />
              </div>
              <div>
                <Label>Disk (Gi)</Label>
                <Input
                  type="number"
                  min={1}
                  value={spec.defaultDiskGi ?? ''}
                  onChange={(e) => set('defaultDiskGi')(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                  placeholder={`${DEFAULT_DISK_GI}`}
                />
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">OpenClaw</h3>
          <div className="space-y-3">
            <div>
              <Label>Log level</Label>
              <select
                className="flex h-8 w-full rounded-md border border-gray-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400"
                value={spec.logLevel ?? ''}
                onChange={(e) => set('logLevel')(e.target.value || undefined)}
              >
                <option value="">info (default)</option>
                <option value="error">error</option>
                <option value="warn">warn</option>
                <option value="debug">debug</option>
                <option value="trace">trace</option>
              </select>
            </div>
            <div>
            <Label>Bootstrap</Label>
            <Textarea
              mono
              rows={4}
              value={spec.startupInstructions ?? ''}
              onChange={(e) => set('startupInstructions')(e.target.value || undefined)}
              placeholder="Custom bootstrap instructions..."
            />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Mission Control</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-600">Deploy Mission Control alongside this team's agents (requires GKE settings).</p>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={spec.missionControlEnabled !== false}
                  onChange={(e) => set('missionControlEnabled')(e.target.checked)}
                />
                <div className="w-8 h-4 bg-gray-200 peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-4 peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all" />
              </label>
            </div>
            {spec.missionControlEnabled !== false && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Admin password</Label>
                  <div className="flex items-center gap-1.5">
                    <Input mono value={mcAdminPassword ? '•'.repeat(mcAdminPassword.length) : '—'} readOnly className="flex-1" />
                    <Button
                      variant="secondary"
                      size="sm"
                      className="shrink-0"
                      disabled={!mcAdminPassword}
                      onClick={() => {
                        if (!mcAdminPassword) return
                        void navigator.clipboard.writeText(mcAdminPassword)
                        setMcPasswordCopied(true)
                        setTimeout(() => setMcPasswordCopied(false), 1500)
                      }}
                    >
                      {mcPasswordCopied ? <Check className="w-3 h-3" /> : 'Copy'}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">Derived from team signing key</p>
                </div>
                <div>
                  <Label>API key</Label>
                  <div className="flex items-center gap-1.5">
                    <Input mono value={mcApiKey ? '•'.repeat(mcApiKey.length) : '—'} readOnly className="flex-1" />
                    <Button
                      variant="secondary"
                      size="sm"
                      className="shrink-0"
                      disabled={!mcApiKey}
                      onClick={() => {
                        if (!mcApiKey) return
                        void navigator.clipboard.writeText(mcApiKey)
                        setMcApiKeyCopied(true)
                        setTimeout(() => setMcApiKeyCopied(false), 1500)
                      }}
                    >
                      {mcApiKeyCopied ? <Check className="w-3 h-3" /> : 'Copy'}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">Derived from team signing key</p>
                </div>
              </div>
            )}
          </div>
        </div>
        </div>
      </div>
    </>
  )
}
