import { useState, useEffect } from 'react'
import { useEnvironments } from '../../hooks/useEnvironments'
import { useSpecStatus } from '../../hooks/useSpecStatus'
import { Rocket, GitCommit, AlertCircle, Check, Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { TeamSpec } from '../../../../shared/types'

interface Props {
  spec: TeamSpec
  onSave: () => Promise<void>
  isSaving: boolean
}

type DeployState = 'idle' | 'preparing' | 'deploying' | 'done' | 'error'

export function DeployTab({ spec, onSave, isSaving }: Props) {
  const status = useSpecStatus(spec.slug)
  const { data: environments } = useEnvironments()
  const [selectedEnvSlug, setSelectedEnvSlug] = useState('')
  const [keepDisks, setKeepDisks] = useState(true)
  const [forceRecreate, setForceRecreate] = useState(false)
  const [deployState, setDeployState] = useState<DeployState>('idle')
  const [deployFiles, setDeployFiles] = useState<string[]>([])
  const [deployLogs, setDeployLogs] = useState<string[]>([])
  const [gitMessage, setGitMessage] = useState('')
  const [gitStatus, setGitStatus] = useState<{ dirty: boolean; files: string[] }>({ dirty: false, files: [] })

  useEffect(() => {
    if (environments?.length && !selectedEnvSlug) setSelectedEnvSlug(environments[0].slug)
  }, [environments, selectedEnvSlug])

  useEffect(() => {
    window.api.invoke('git:status').then((s: unknown) => {
      const gs = s as { enabled: boolean; dirty: boolean; files: string[] }
      if (gs.enabled) setGitStatus({ dirty: gs.dirty, files: gs.files })
    })
  }, [spec])

  useEffect(() => {
    return window.api.on?.('deploy:status', (data: unknown) => {
      const d = data as { resource: string; status: string; message?: string }
      const line = `${d.status.toUpperCase().padEnd(8)} ${d.resource}${d.message ? ` — ${d.message}` : ''}`
      setDeployLogs(prev => [...prev, line])
    })
  }, [])

  const handleDeploy = async () => {
    if (!selectedEnvSlug) return
    setDeployState('preparing')
    setDeployFiles([])
    setDeployLogs([])

    try {
      await onSave()
      const preview = await window.api.invoke('deploy:preview', {
        teamSlug: spec.slug,
        envSlug: selectedEnvSlug,
      }) as { ok: boolean; reason?: string; files?: Array<{ path: string }> }

      if (!preview.ok) {
        setDeployState('error')
        setDeployLogs([`ERROR: ${preview.reason}`])
        return
      }

      setDeployFiles((preview.files ?? []).map(f => f.path))
      setDeployState('deploying')

      const result = await window.api.invoke('deploy:team', {
        teamSlug: spec.slug,
        envSlug: selectedEnvSlug,
        options: { keepDisks, forceRecreate },
      }) as { ok: boolean; reason?: string }

      setDeployState(result.ok ? 'done' : 'error')
      if (!result.ok) setDeployLogs(prev => [...prev, `ERROR: ${result.reason}`])
    } catch (error) {
      setDeployState('error')
      setDeployLogs([`ERROR: ${error instanceof Error ? error.message : String(error)}`])
    }
  }

  const handleCommit = async () => {
    if (!gitMessage.trim()) return
    await window.api.invoke('git:commit', gitMessage)
    setGitMessage('')
    const gs = await window.api.invoke('git:status') as { enabled: boolean; dirty: boolean; files: string[] }
    if (gs.enabled) setGitStatus({ dirty: gs.dirty, files: gs.files })
  }

  const selectedEnvName = (environments ?? []).find(e => e.slug === selectedEnvSlug)?.name ?? selectedEnvSlug

  const inputCls = 'w-full rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
  const labelCls = 'block text-xs font-medium text-gray-600 mb-1'

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Top scrollable section */}
      <div className="flex-1 overflow-y-auto">
        <div className="py-6 px-6 max-w-2xl space-y-6">
          {/* Validation status */}
          {status.validationErrors.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-sm font-medium text-red-700">
                <AlertCircle className="w-4 h-4" />
                Validation errors ({status.validationErrors.length})
              </div>
              {status.validationErrors.map((e, i) => (
                <div key={i} className="text-xs text-red-600 font-mono pl-5.5">
                  {e.field}: {e.message}
                </div>
              ))}
            </div>
          )}

          {/* Environment selector */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Environment</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1">
                <label className={labelCls}>Target</label>
                <select
                  value={selectedEnvSlug}
                  onChange={e => setSelectedEnvSlug(e.target.value)}
                  className={inputCls}
                >
                  {(environments ?? []).map(e => <option key={e.slug} value={e.slug}>{e.name}</option>)}
                </select>
              </div>
              <div className="col-span-2 flex items-end gap-4 pb-0.5">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={keepDisks} onChange={e => setKeepDisks(e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  Keep disks
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={forceRecreate} onChange={e => setForceRecreate(e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  Force recreate
                </label>
              </div>
            </div>
          </div>

          {/* Git commit */}
          {gitStatus.dirty && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                <span className="flex items-center gap-1.5">
                  <GitCommit className="w-4 h-4" />
                  Git ({gitStatus.files.length} changes)
                </span>
              </h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={gitMessage}
                  onChange={e => setGitMessage(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCommit()}
                  placeholder="Commit message..."
                  className={inputCls + ' font-mono'}
                />
                <button
                  onClick={handleCommit}
                  disabled={!gitMessage.trim()}
                  className="px-4 py-1.5 text-sm font-medium rounded-md bg-gray-800 text-white hover:bg-gray-700 disabled:opacity-50 shrink-0 transition-colors"
                >
                  Commit
                </button>
              </div>
              <div className="mt-2 space-y-0.5">
                {gitStatus.files.slice(0, 10).map(f => (
                  <div key={f} className="text-xs text-gray-500 font-mono truncate">{f}</div>
                ))}
                {gitStatus.files.length > 10 && (
                  <div className="text-xs text-gray-400">...and {gitStatus.files.length - 10} more</div>
                )}
              </div>
            </div>
          )}

          {/* Pipeline: Save → Deploy */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Deployment pipeline</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={onSave}
                disabled={isSaving}
                className="px-4 py-2 text-sm font-medium rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 transition-colors"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
              <span className="text-gray-300">→</span>
              <button
                onClick={handleDeploy}
                disabled={!status.isValid || !selectedEnvSlug || deployState === 'preparing' || deployState === 'deploying' || isSaving}
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-md transition-colors',
                  deployState === 'done'
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : deployState === 'error'
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : deployState === 'preparing' || deployState === 'deploying'
                    ? 'bg-yellow-500 text-white'
                    : status.isValid
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                )}
              >
                <span className="flex items-center gap-1.5">
                  {(deployState === 'preparing' || deployState === 'deploying') && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {deployState === 'done' && <Check className="w-3.5 h-3.5" />}
                  {deployState === 'error' && <AlertCircle className="w-3.5 h-3.5" />}
                  {deployState === 'idle' && <Rocket className="w-3.5 h-3.5" />}
                  {deployState === 'preparing' ? 'Preparing...' :
                   deployState === 'deploying' ? 'Deploying...' :
                   deployState === 'done' ? 'Redeploy' :
                   deployState === 'error' ? 'Deploy failed' : 'Deploy'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Persistent output panel */}
      {deployState !== 'idle' && (
        <div className="shrink-0 border-t border-gray-200 bg-white h-72 flex flex-col">
          {/* Panel header */}
          <div className="flex items-center gap-2 border-b border-gray-200 px-5 py-2.5 shrink-0">
            <h4 className="text-sm font-semibold text-gray-900">Deploy output</h4>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-gray-500">
              {selectedEnvName}
            </span>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
              deployState === 'done' ? 'bg-green-50 text-green-700' :
              deployState === 'error' ? 'bg-red-50 text-red-700' :
              deployState === 'preparing' || deployState === 'deploying' ? 'bg-yellow-50 text-yellow-700' :
              'bg-gray-100 text-gray-500'
            }`}>
              {deployState === 'done' && <Check className="w-3 h-3" />}
              {deployState === 'error' && <AlertCircle className="w-3 h-3" />}
              {(deployState === 'preparing' || deployState === 'deploying') && <Loader2 className="w-3 h-3 animate-spin" />}
              {deployState === 'preparing' ? 'Preparing' :
               deployState === 'deploying' ? 'Deploying' :
               deployState === 'done' ? 'Deployed' : 'Failed'}
            </span>
          </div>

          {/* Panel body: files | logs side by side */}
          <div className="flex flex-1 min-h-0 divide-x divide-gray-100">
            {/* Derived files */}
            <div className="w-64 shrink-0 flex flex-col p-3 min-h-0">
              <div className="flex items-center justify-between mb-2 shrink-0">
                <h5 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Files</h5>
                <span className="text-[10px] text-gray-400">{deployFiles.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto min-h-0 space-y-0.5">
                {deployFiles.length === 0 ? (
                  <div className="text-xs text-gray-400">
                    {deployState === 'preparing' ? 'Deriving files\u2026' : 'No files yet'}
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
              <h5 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2 shrink-0">Log</h5>
              <div className="flex-1 overflow-y-auto min-h-0 space-y-0.5">
                {deployLogs.length === 0 ? (
                  <div className="text-xs text-gray-400">
                    {deployState === 'preparing' ? 'Waiting for deploy to start\u2026' :
                     deployState === 'deploying' ? 'Collecting logs\u2026' :
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
      )}
    </div>
  )
}
