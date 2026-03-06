import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Check, Loader2, Rocket, X } from 'lucide-react'
import type { EnvironmentRecord, TeamSpec } from '../../../../shared/types'

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

const inputCls = 'w-full rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
const monoInputCls = inputCls + ' font-mono'
const labelCls = 'block text-xs font-medium text-gray-600 mb-1'
const valueCls = 'min-h-10 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700'
const emptyValueCls = 'text-gray-400'

function ReadField({ label, value, monospace = false }: { label: string; value?: string | number; monospace?: boolean }) {
  const hasValue = value !== undefined && value !== null && `${value}`.trim().length > 0
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div className={`${valueCls} ${monospace ? 'font-mono text-xs' : ''} ${hasValue ? '' : emptyValueCls}`}>
        {hasValue ? value : 'Not set'}
      </div>
    </div>
  )
}

type OverviewDeployState = 'idle' | 'preparing' | 'deploying' | 'done' | 'error'

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

  const set = useCallback((key: keyof TeamSpec) => (value: unknown) => {
    onSpecChange({ ...spec, [key]: value })
  }, [spec, onSpecChange])

  useEffect(() => {
    return window.api.on?.('deploy:status', (data: unknown) => {
      const d = data as { resource: string; status: string; message?: string }
      const line = `${d.status.toUpperCase().padEnd(8)} ${d.resource}${d.message ? ` — ${d.message}` : ''}`
      setDeployLogs(prev => [...prev, line])
    })
  }, [])

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
      <div className="max-w-3xl space-y-5 py-6 px-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Team overview</h3>
            <p className="text-sm text-gray-500 mt-1">Review the current team configuration before making changes.</p>
          </div>
          <button
            onClick={onEdit}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            Edit team
          </button>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-5">
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Team details</h4>
            <div className="grid grid-cols-2 gap-3">
              <ReadField label="Name" value={spec.name} />
              <ReadField label="Slug" value={spec.slug} monospace />
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Telegram integration</h4>
            <div className="grid grid-cols-2 gap-3">
              <ReadField label="Group ID" value={spec.telegramGroupId} monospace />
              <ReadField label="Admin ID" value={spec.telegramAdminId} monospace />
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Infrastructure defaults</h4>
            <div className="grid grid-cols-2 gap-3">
              <ReadField label="Default container image" value={spec.defaultImage} monospace />
              <ReadField label="Storage (Gi)" value={spec.defaultDiskGi} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Startup instructions</label>
            <div className={`${valueCls} min-h-28 whitespace-pre-wrap font-mono text-xs ${spec.startupInstructions?.trim() ? '' : emptyValueCls}`}>
              {spec.startupInstructions?.trim() || 'Not set'}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4 className="text-sm font-semibold text-gray-900">Deployment</h4>
              <p className="text-sm text-gray-500 mt-1">
                Select a target environment and deploy from the Overview page.
              </p>
            </div>
            <button
              onClick={handleDeploy}
              disabled={!deployEnvSlug || isSaving || deployState === 'preparing' || deployState === 'deploying'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              {(deployState === 'preparing' || deployState === 'deploying') ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Rocket className="w-3.5 h-3.5" />
              )}
              Deploy
            </button>
          </div>

          {deployEnvironments.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Target environment</label>
                <select
                  className={inputCls}
                  value={deployEnvSlug ?? ''}
                  onChange={e => onDeployEnvChange(e.target.value)}
                >
                  {deployEnvironments.map((environment) => (
                    <option key={environment.slug} value={environment.slug}>
                      {environment.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <div className={`${valueCls} flex items-center justify-between gap-3`}>
                  <span className="truncate">
                    {deployEnvName || deployEnvSlug || 'No target selected'}
                  </span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                    deployState === 'done'
                      ? 'bg-green-50 text-green-700'
                      : deployState === 'error'
                      ? 'bg-red-50 text-red-700'
                      : deployState === 'preparing' || deployState === 'deploying'
                      ? 'bg-yellow-50 text-yellow-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {deployState === 'done' && <Check className="w-3 h-3" />}
                    {deployState === 'error' && <AlertCircle className="w-3 h-3" />}
                    {(deployState === 'preparing' || deployState === 'deploying') && <Loader2 className="w-3 h-3 animate-spin" />}
                    {deployState === 'idle' ? 'Idle' :
                     deployState === 'preparing' ? 'Preparing' :
                     deployState === 'deploying' ? 'Deploying' :
                     deployState === 'done' ? 'Deployed' : 'Failed'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
              No deployment environments configured. Add one in Settings before deploying.
            </div>
          )}
        </div>

        <div
          className={`fixed inset-0 z-40 transition-colors duration-200 ${
            isDeployDrawerOpen ? 'pointer-events-auto bg-black/20' : 'pointer-events-none bg-transparent'
          }`}
          onClick={() => setIsDeployDrawerOpen(false)}
        />
        <div
          className={`fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-5xl transform transition-transform duration-200 ${
            isDeployDrawerOpen ? 'translate-y-0' : 'translate-y-full'
          }`}
        >
          <div className="mx-4 mb-4 overflow-hidden rounded-t-2xl border border-gray-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-gray-900">Deploy preview</h4>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-gray-500">
                    {deployEnvName || deployEnvSlug || 'No target'}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">Derived file list appears first, followed by the live deploy log.</p>
              </div>
              <button
                onClick={() => setIsDeployDrawerOpen(false)}
                className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="border-b border-gray-200 bg-gray-50">
              <div className="border-b border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h5 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Derived files</h5>
                  <span className="text-xs text-gray-400">{deployFiles.length}</span>
                </div>
                <div className="max-h-56 overflow-auto rounded-lg border border-gray-200 bg-white p-3">
                  {deployFiles.length === 0 ? (
                    <div className="text-xs text-gray-400">
                      {deployState === 'preparing' ? 'Deriving and validating deployment files…' : 'No derived files yet'}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {deployFiles.map(path => (
                        <div key={path} className="text-xs font-mono text-gray-600 truncate">{path}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h5 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Deploy log</h5>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                    deployState === 'done'
                      ? 'bg-green-50 text-green-700'
                      : deployState === 'error'
                      ? 'bg-red-50 text-red-700'
                      : deployState === 'preparing' || deployState === 'deploying'
                      ? 'bg-yellow-50 text-yellow-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {deployState === 'done' && <Check className="w-3 h-3" />}
                    {deployState === 'error' && <AlertCircle className="w-3 h-3" />}
                    {(deployState === 'preparing' || deployState === 'deploying') && <Loader2 className="w-3 h-3 animate-spin" />}
                    {deployState === 'idle' ? 'Idle' :
                     deployState === 'preparing' ? 'Preparing' :
                     deployState === 'deploying' ? 'Deploying' :
                     deployState === 'done' ? 'Deployed' : 'Failed'}
                  </span>
                </div>
                <div className="max-h-56 overflow-auto rounded-lg border border-gray-200 bg-white p-3 space-y-1">
                  {deployLogs.length === 0 ? (
                    <div className="text-xs text-gray-400">
                      {deployState === 'preparing'
                        ? 'Waiting for deploy to start…'
                        : deployState === 'deploying'
                        ? 'Collecting deploy logs…'
                        : 'No deploy logs yet'}
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
    <div className="max-w-xl space-y-5 py-6 px-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Edit team</h3>
          <p className="text-sm text-gray-500 mt-1">Update the base team configuration and save when finished.</p>
        </div>
        <button
          onClick={onSave}
          disabled={isSaving}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Team details</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Name</label>
            <input className={inputCls} value={spec.name} onChange={e => set('name')(e.target.value)} placeholder="My Team" />
          </div>
          <div>
            <label className={labelCls}>Slug</label>
            <input className={monoInputCls} value={spec.slug} onChange={e => set('slug')(e.target.value)} placeholder="my-team" />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Telegram integration</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Group ID</label>
            <input
              className={monoInputCls}
              value={spec.telegramGroupId ?? ''}
              onChange={e => set('telegramGroupId')(e.target.value || undefined)}
              placeholder="-1001234567890"
            />
          </div>
          <div>
            <label className={labelCls}>Admin ID</label>
            <input
              className={monoInputCls}
              value={spec.telegramAdminId ?? ''}
              onChange={e => set('telegramAdminId')(e.target.value || undefined)}
              placeholder="123456789"
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Infrastructure defaults</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Default container image</label>
            <input
              className={monoInputCls}
              value={spec.defaultImage ?? ''}
              onChange={e => set('defaultImage')(e.target.value || undefined)}
              placeholder="ghcr.io/org/openclaw:latest"
            />
          </div>
          <div>
            <label className={labelCls}>Storage (Gi)</label>
            <input
              type="number"
              min={1}
              className={inputCls}
              value={spec.defaultDiskGi ?? ''}
              onChange={e => set('defaultDiskGi')(e.target.value ? parseInt(e.target.value, 10) : undefined)}
              placeholder="100"
            />
          </div>
        </div>
      </div>

      <div>
        <label className={labelCls}>Startup instructions</label>
        <textarea
          className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono"
          rows={4}
          value={spec.startupInstructions ?? ''}
          onChange={e => set('startupInstructions')(e.target.value || undefined)}
          placeholder="Custom startup instructions..."
        />
      </div>
    </div>
  )
}
