import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Check, Loader2, Rocket, X } from 'lucide-react'
import { useNav } from '../store/nav'
import type { EnvironmentRecord, TeamSpec } from '../../../shared/types'

type DeployState = 'idle' | 'preparing' | 'deploying' | 'done' | 'error'

export interface DeployDrawerProps {
  spec: TeamSpec
  environments: EnvironmentRecord[]
  selectedEnvSlug: string
  onEnvChange: (slug: string) => void
  onSave: () => Promise<void>
  isSaving: boolean
}

export function DeployDrawer({ spec, environments, selectedEnvSlug, onEnvChange, onSave, isSaving }: DeployDrawerProps) {
  const { isDeployDrawerOpen, setDeployDrawerOpen } = useNav()
  const [deployFiles, setDeployFiles] = useState<string[]>([])
  const [deployLogs, setDeployLogs] = useState<string[]>([])
  const [deployState, setDeployState] = useState<DeployState>('idle')

  const envName = environments.find((e) => e.slug === selectedEnvSlug)?.name

  useEffect(() => {
    return window.api.on?.('deploy:status', (data: unknown) => {
      const d = data as { resource: string; status: string; message?: string }
      const line = `${d.status.toUpperCase().padEnd(8)} ${d.resource}${d.message ? ` — ${d.message}` : ''}`
      setDeployLogs((prev) => [...prev, line])
    })
  }, [])

  const handleDeploy = useCallback(async () => {
    if (!selectedEnvSlug) return

    setDeployDrawerOpen(true)
    setDeployState('preparing')
    setDeployFiles([])
    setDeployLogs([])

    try {
      await onSave()
      const preview = (await window.api.invoke('deploy:preview', {
        teamSlug: spec.slug,
        envSlug: selectedEnvSlug,
      })) as { ok: boolean; reason?: string; files?: Array<{ path: string }> }

      if (!preview.ok) {
        setDeployState('error')
        setDeployLogs([`ERROR: ${preview.reason}`])
        return
      }

      setDeployFiles((preview.files ?? []).map((file) => file.path))
      setDeployState('deploying')

      const result = (await window.api.invoke('deploy:team', {
        teamSlug: spec.slug,
        envSlug: selectedEnvSlug,
        options: { keepDisks: true, forceRecreate: false },
      })) as { ok: boolean; reason?: string }

      setDeployState(result.ok ? 'done' : 'error')
      if (!result.ok) {
        setDeployLogs((prev) => [...prev, `ERROR: ${result.reason}`])
      }
    } catch (error) {
      setDeployState('error')
      setDeployLogs([`ERROR: ${error instanceof Error ? error.message : String(error)}`])
    }
  }, [selectedEnvSlug, spec.slug, onSave, setDeployDrawerOpen])

  const statusBadgeCls =
    deployState === 'done'
      ? 'bg-green-50 text-green-700'
      : deployState === 'error'
        ? 'bg-red-50 text-red-700'
        : deployState === 'preparing' || deployState === 'deploying'
          ? 'bg-yellow-50 text-yellow-700'
          : 'bg-gray-100 text-gray-500'

  const statusLabel =
    deployState === 'idle'
      ? 'Idle'
      : deployState === 'preparing'
        ? 'Preparing'
        : deployState === 'deploying'
          ? 'Deploying'
          : deployState === 'done'
            ? 'Deployed'
            : 'Failed'

  return (
    <div className="shrink-0 border-t border-gray-200 bg-white flex flex-col">
      <div className="flex items-center justify-between gap-4 px-5 py-2.5 shrink-0">
        <div className="flex items-center gap-3">
          <h4 className="text-sm font-semibold text-gray-900">Deploy</h4>
          {environments.length > 0 && (
            <select
              className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedEnvSlug}
              onChange={(e) => onEnvChange(e.target.value)}
            >
              {environments.map((env) => (
                <option key={env.slug} value={env.slug}>
                  {env.name}
                </option>
              ))}
            </select>
          )}
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${statusBadgeCls}`}>
            {deployState === 'done' && <Check className="w-3 h-3" />}
            {deployState === 'error' && <AlertCircle className="w-3 h-3" />}
            {(deployState === 'preparing' || deployState === 'deploying') && <Loader2 className="w-3 h-3 animate-spin" />}
            {statusLabel}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void handleDeploy()}
            disabled={!selectedEnvSlug || isSaving || deployState === 'preparing' || deployState === 'deploying'}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {deployState === 'preparing' || deployState === 'deploying' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Rocket className="w-3.5 h-3.5" />
            )}
            Deploy
          </button>
        </div>
      </div>

      <div
        className={`overflow-hidden transition-[height] duration-200 ${isDeployDrawerOpen ? 'h-64' : 'h-0'}`}
      >
        <div className="h-full flex flex-col border-t border-gray-100">
          <div className="flex items-center justify-between gap-4 px-5 py-2 shrink-0">
            <div className="flex items-center gap-2">
              <h5 className="text-xs font-semibold text-gray-700">Deploy output</h5>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-gray-500">
                {envName || selectedEnvSlug || 'No target'}
              </span>
            </div>
            <button
              onClick={() => setDeployDrawerOpen(false)}
              className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-1 min-h-0 divide-x divide-gray-100">
            <div className="w-64 shrink-0 flex flex-col p-3 min-h-0">
              <div className="flex items-center justify-between mb-2 shrink-0">
                <h5 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Files</h5>
                <span className="text-[10px] text-gray-400">{deployFiles.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto min-h-0 space-y-0.5">
                {deployFiles.length === 0 ? (
                  <div className="text-xs text-gray-400">
                    {deployState === 'preparing' ? 'Deriving files...' : 'No files yet'}
                  </div>
                ) : (
                  deployFiles.map((path) => (
                    <div key={path} className="text-xs font-mono text-gray-600 truncate">
                      {path}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex-1 flex flex-col p-3 min-h-0">
              <h5 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2 shrink-0">Log</h5>
              <div className="flex-1 overflow-y-auto min-h-0 space-y-0.5">
                {deployLogs.length === 0 ? (
                  <div className="text-xs text-gray-400">
                    {deployState === 'preparing'
                      ? 'Waiting for deploy to start...'
                      : deployState === 'deploying'
                        ? 'Collecting logs...'
                        : 'No logs yet'}
                  </div>
                ) : (
                  deployLogs.map((line, index) => (
                    <div
                      key={`${index}:${line}`}
                      className={`text-xs font-mono ${
                        line.startsWith('ERROR')
                          ? 'text-red-600'
                          : line.startsWith('CREATED')
                            ? 'text-green-600'
                            : line.startsWith('EXISTS')
                              ? 'text-yellow-600'
                              : 'text-gray-600'
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
