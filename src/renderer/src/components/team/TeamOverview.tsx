import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Check, Loader2, Pencil, Rocket, X } from 'lucide-react'
import type { EnvironmentRecord, TeamSpec } from '../../../../shared/types'
import { Badge, Button, Input, Label, ReadField, Select, Textarea } from '../ui'

interface Props {
  spec: TeamSpec
  onSpecChange: (spec: TeamSpec) => void
  isEditing: boolean
  onEdit: () => void
  onSave: () => Promise<void>
  isSaving: boolean
  deployEnvironments: EnvironmentRecord[]
  deployEnvSlug?: string
  deployEnvName?: string
  onDeployEnvChange: (slug: string) => void
}

type OverviewDeployState = 'idle' | 'preparing' | 'deploying' | 'done' | 'error'

function deployBadgeVariant(state: OverviewDeployState) {
  if (state === 'done') return 'success' as const
  if (state === 'error') return 'destructive' as const
  if (state === 'preparing' || state === 'deploying') return 'warning' as const
  return 'default' as const
}

function deployBadgeLabel(state: OverviewDeployState) {
  if (state === 'idle') return 'Idle'
  if (state === 'preparing') return 'Preparing'
  if (state === 'deploying') return 'Deploying'
  if (state === 'done') return 'Deployed'
  return 'Failed'
}

function DeployBadgeIcon({ state }: { state: OverviewDeployState }) {
  if (state === 'done') return <Check className="w-3 h-3" />
  if (state === 'error') return <AlertCircle className="w-3 h-3" />
  if (state === 'preparing' || state === 'deploying') return <Loader2 className="w-3 h-3 animate-spin" />
  return null
}

export function TeamOverview({
  spec,
  onSpecChange,
  isEditing,
  onEdit,
  onSave,
  isSaving,
  deployEnvironments,
  deployEnvSlug,
  deployEnvName,
  onDeployEnvChange,
}: Props) {
  const [isDeployDrawerOpen, setIsDeployDrawerOpen] = useState(false)
  const [deployFiles, setDeployFiles] = useState<string[]>([])
  const [deployLogs, setDeployLogs] = useState<string[]>([])
  const [deployState, setDeployState] = useState<OverviewDeployState>('idle')
  const [emailPassword, setEmailPassword] = useState('')
  const [emailPasswordMasked, setEmailPasswordMasked] = useState<string | null>(null)
  const [emailPasswordBusy, setEmailPasswordBusy] = useState(false)
  const [emailPasswordError, setEmailPasswordError] = useState<string | null>(null)

  const set = useCallback((key: keyof TeamSpec) => (value: unknown) => {
    onSpecChange({ ...spec, [key]: value })
  }, [spec, onSpecChange])

  useEffect(() => {
    if (!spec.slug || !spec.teamEmail) return
    let active = true
    window.api
      .invoke('teams:getTeamEmailPasswordMasked', { teamSlug: spec.slug })
      .then((value) => {
        if (active) setEmailPasswordMasked((value as string | null) ?? null)
      })
      .catch((e) => {
        if (active) setEmailPasswordError((e as Error).message)
      })
    return () => { active = false }
  }, [spec.slug, spec.teamEmail])

  useEffect(() => {
    return window.api.on?.('deploy:status', (data: unknown) => {
      const d = data as { resource: string; status: string; message?: string }
      const line = `${d.status.toUpperCase().padEnd(8)} ${d.resource}${d.message ? ` — ${d.message}` : ''}`
      setDeployLogs(prev => [...prev, line])
    })
  }, [])

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

  const handleDeploy = async () => {
    if (!deployEnvSlug) return

    setIsDeployDrawerOpen(true)
    setDeployState('preparing')
    setDeployFiles([])
    setDeployLogs([])

    try {
      await onSave()
      const preview = await window.api.invoke('deploy:preview', { teamSlug: spec.slug, envSlug: deployEnvSlug }) as {
        ok: boolean
        reason?: string
        files?: Array<{ path: string }>
      }

      if (!preview.ok) {
        setDeployState('error')
        setDeployLogs([`ERROR: ${preview.reason}`])
        return
      }

      setDeployFiles((preview.files ?? []).map(file => file.path))
      setDeployState('deploying')

      const result = await window.api.invoke('deploy:team', {
        teamSlug: spec.slug,
        envSlug: deployEnvSlug,
        options: { keepDisks: true, forceRecreate: false },
      }) as { ok: boolean; reason?: string }

      setDeployState(result.ok ? 'done' : 'error')
      if (!result.ok) {
        setDeployLogs(prev => [...prev, `ERROR: ${result.reason}`])
      }
    } catch (error) {
      setDeployState('error')
      setDeployLogs([`ERROR: ${error instanceof Error ? error.message : String(error)}`])
    }
  }

  if (!isEditing) {
    return (
      <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto min-h-0">
      <div className="max-w-2xl mx-auto space-y-6 py-6 px-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Team overview</h3>
            <p className="text-sm text-gray-500 mt-1">Review the current team configuration before making changes.</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onEdit} title="Edit team">
            <Pencil className="w-4 h-4" />
          </Button>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-3">About</h4>
          <ReadField label="Name" value={spec.name} />
          <ReadField label="Slug" value={spec.slug} monospace />
        </div>

        <hr className="border-gray-200" />

        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Telegram</h4>
          <ReadField label="Group ID" value={spec.telegramGroupId} monospace />
          <ReadField label="Admin ID" value={spec.telegramAdminId} monospace />
        </div>

        <hr className="border-gray-200" />

        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Email</h4>
          <ReadField label="Team email" value={spec.teamEmail} monospace />
          <ReadField label="App password" value={emailPasswordMasked ?? undefined} monospace />
          {emailPasswordError && (
            <p className="text-xs text-red-600 mt-0.5">{emailPasswordError}</p>
          )}
        </div>

        <hr className="border-gray-200" />

        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Resources</h4>
          <ReadField label="Default container image" value={spec.defaultImage} monospace />
          <ReadField label="Storage (Gi)" value={spec.defaultDiskGi} />
        </div>

        <hr className="border-gray-200" />

        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-1">OpenClaw</h4>
          <ReadField label="Bootstrap" value={spec.startupInstructions?.trim() || undefined} monospace />
        </div>

        <hr className="border-gray-200" />

        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4 className="text-sm font-semibold text-gray-900">Deployment</h4>
              <p className="text-sm text-gray-500 mt-1">
                Select a target environment and deploy from the Overview page.
              </p>
            </div>
            <Button
              variant="dark"
              onClick={handleDeploy}
              disabled={!deployEnvSlug || isSaving || deployState === 'preparing' || deployState === 'deploying'}
            >
              {(deployState === 'preparing' || deployState === 'deploying') ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Rocket className="w-3.5 h-3.5" />
              )}
              Deploy
            </Button>
          </div>

          {deployEnvironments.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Target environment</Label>
                <Select
                  value={deployEnvSlug ?? ''}
                  onChange={e => onDeployEnvChange(e.target.value)}
                >
                  {deployEnvironments.map((environment) => (
                    <option key={environment.slug} value={environment.slug}>
                      {environment.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <div className="min-h-10 border-b border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 flex items-center justify-between gap-3">
                  <span className="truncate">
                    {deployEnvName || deployEnvSlug || 'No target selected'}
                  </span>
                  <Badge variant={deployBadgeVariant(deployState)} className="uppercase tracking-wider">
                    <DeployBadgeIcon state={deployState} />
                    {deployBadgeLabel(deployState)}
                  </Badge>
                </div>
              </div>
            </div>
          ) : (
            <div className="border-b border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
              No deployment environments configured. Add one in Settings before deploying.
            </div>
          )}
        </div>

      </div>
      </div>

      {/* Split bottom deploy panel */}
      <div className={`shrink-0 border-t border-gray-200 bg-white overflow-hidden transition-[height] duration-200 ${isDeployDrawerOpen ? 'h-80' : 'h-0'}`}>
        <div className="h-full flex flex-col">
          {/* Panel header */}
          <div className="flex items-center justify-between gap-4 border-b border-gray-200 px-5 py-2.5 shrink-0">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-gray-900">Deploy output</h4>
              <Badge>
                {deployEnvName || deployEnvSlug || 'No target'}
              </Badge>
              <Badge variant={deployBadgeVariant(deployState)} className="uppercase tracking-wider">
                <DeployBadgeIcon state={deployState} />
                {deployBadgeLabel(deployState)}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsDeployDrawerOpen(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Panel body: files | logs side by side */}
          <div className="flex flex-1 min-h-0 divide-x divide-gray-100">
            {/* Derived files */}
            <div className="w-64 shrink-0 flex flex-col p-3 min-h-0">
              <div className="flex items-center justify-between mb-2 shrink-0">
                <h5 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Files</h5>
                <span className="text-xs text-gray-400">{deployFiles.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto min-h-0 space-y-0.5">
                {deployFiles.length === 0 ? (
                  <div className="text-xs text-gray-400">
                    {deployState === 'preparing' ? 'Deriving files…' : 'No files yet'}
                  </div>
                ) : (
                  deployFiles.map(path => (
                    <div key={path} className="text-xs font-mono text-gray-600 truncate">{path}</div>
                  ))
                )}
              </div>
            </div>

            {/* Deploy log */}
            <div className="flex-1 flex flex-col p-3 min-h-0">
              <h5 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2 shrink-0">Log</h5>
              <div className="flex-1 overflow-y-auto min-h-0 space-y-0.5">
                {deployLogs.length === 0 ? (
                  <div className="text-xs text-gray-400">
                    {deployState === 'preparing' ? 'Waiting for deploy to start…' :
                     deployState === 'deploying' ? 'Collecting logs…' :
                     'No logs yet'}
                  </div>
                ) : (
                  deployLogs.map((line, index) => (
                    <div
                      key={`${index}:${line}`}
                      className={`text-xs font-mono ${
                        line.startsWith('ERROR') ? 'text-red-600' :
                        line.startsWith('CREATED') ? 'text-green-600' :
                        line.startsWith('EXISTS') ? 'text-yellow-600' :
                        'text-gray-600'
                      }`}
                    >
                      {line}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto min-h-0">
    <div className="max-w-2xl mx-auto space-y-5 py-6 px-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Edit team</h3>
          <p className="text-sm text-gray-500 mt-1">Update the base team configuration and save when finished.</p>
        </div>
        <Button
          variant="primary"
          onClick={onSave}
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">About</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Name</Label>
            <Input value={spec.name} onChange={e => set('name')(e.target.value)} placeholder="My Team" />
          </div>
          <div>
            <Label>Slug</Label>
            <Input mono value={spec.slug} onChange={e => set('slug')(e.target.value)} placeholder="my-team" />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Telegram</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Group ID</Label>
            <Input
              mono
              value={spec.telegramGroupId ?? ''}
              onChange={e => set('telegramGroupId')(e.target.value || undefined)}
              placeholder="-1001234567890"
            />
          </div>
          <div>
            <Label>Admin ID</Label>
            <Input
              mono
              value={spec.telegramAdminId ?? ''}
              onChange={e => set('telegramAdminId')(e.target.value || undefined)}
              placeholder="123456789"
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Email</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Team email</Label>
            <Input
              mono
              value={spec.teamEmail ?? ''}
              onChange={e => set('teamEmail')(e.target.value || undefined)}
              placeholder="team@domain.com"
            />
            <p className="text-xs text-gray-400 mt-0.5">Agents get plus-addressed variants (e.g., team+agent-slug@domain.com)</p>
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
                onClick={saveEmailPassword}
                disabled={emailPasswordBusy || !spec.slug || !spec.teamEmail}
                className="shrink-0"
              >
                Save
              </Button>
              {emailPasswordMasked && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={clearEmailPassword}
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
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Resources</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Default container image</Label>
            <Input
              mono
              value={spec.defaultImage ?? ''}
              onChange={e => set('defaultImage')(e.target.value || undefined)}
              placeholder="ghcr.io/org/openclaw:latest"
            />
          </div>
          <div>
            <Label>Storage (Gi)</Label>
            <Input
              type="number"
              min={1}
              value={spec.defaultDiskGi ?? ''}
              onChange={e => set('defaultDiskGi')(e.target.value ? parseInt(e.target.value, 10) : undefined)}
              placeholder="100"
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">OpenClaw</h3>
        <div>
          <Label>Bootstrap</Label>
          <Textarea
            mono
            rows={4}
            value={spec.startupInstructions ?? ''}
            onChange={e => set('startupInstructions')(e.target.value || undefined)}
            placeholder="Custom bootstrap instructions..."
          />
        </div>
      </div>
    </div>
    </div>
  )
}
