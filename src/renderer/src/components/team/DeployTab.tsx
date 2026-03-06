import { useState, useEffect, useCallback } from 'react'
import { useEnvironments } from '../../hooks/useEnvironments'
import { useSpecStatus } from '../../hooks/useSpecStatus'
import { Rocket, GitCommit, AlertCircle, Check, Loader2, RefreshCw } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { TeamSpec, DeployOptions } from '../../../../shared/types'

interface Props {
  spec: TeamSpec
  onSave: () => Promise<void>
  isSaving: boolean
}

type DeployState = 'idle' | 'deploying' | 'done' | 'error'
type DeriveState = 'idle' | 'running' | 'done' | 'error'

interface DeployFile {
  path: string
  content: string
}

export function DeployTab({ spec, onSave, isSaving }: Props) {
  const status = useSpecStatus(spec.slug)
  const { data: environments } = useEnvironments()
  const [selectedEnvSlug, setSelectedEnvSlug] = useState('')
  const [keepDisks, setKeepDisks] = useState(true)
  const [forceRecreate, setForceRecreate] = useState(false)
  const [deployState, setDeployState] = useState<DeployState>('idle')
  const [deriveState, setDeriveState] = useState<DeriveState>('idle')
  const [deployLogs, setDeployLogs] = useState<string[]>([])
  const [gitMessage, setGitMessage] = useState('')
  const [gitStatus, setGitStatus] = useState<{ dirty: boolean; files: string[] }>({ dirty: false, files: [] })
  const [deployFiles, setDeployFiles] = useState<DeployFile[]>([])

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

  const loadDeployFiles = useCallback(async () => {
    if (!spec.slug || !selectedEnvSlug) return
    const env = environments?.find(e => e.slug === selectedEnvSlug)
    if (!env) return
    const files = await window.api.invoke('teams:getDeployFiles', { teamSlug: spec.slug, envType: env.type }) as DeployFile[]
    setDeployFiles(files)
  }, [spec.slug, selectedEnvSlug, environments])

  useEffect(() => {
    if (status.derivationStatus === 'success') loadDeployFiles()
  }, [status.derivationStatus, loadDeployFiles])

  const handleDeploy = async () => {
    setDeployState('deploying')
    setDeployLogs([])
    const options: DeployOptions = { keepDisks, forceRecreate }
    const result = await window.api.invoke('deploy:team', { teamSlug: spec.slug, envSlug: selectedEnvSlug, options }) as { ok: boolean; reason?: string }
    setDeployState(result.ok ? 'done' : 'error')
    if (!result.ok) setDeployLogs(prev => [...prev, `ERROR: ${result.reason}`])
  }

  const handleCommit = async () => {
    if (!gitMessage.trim()) return
    await window.api.invoke('git:commit', gitMessage)
    setGitMessage('')
    const gs = await window.api.invoke('git:status') as { enabled: boolean; dirty: boolean; files: string[] }
    if (gs.enabled) setGitStatus({ dirty: gs.dirty, files: gs.files })
  }

  const handleDerive = async () => {
    setDeriveState('running')
    await onSave()
    const result = await window.api.invoke('teams:derive', spec.slug) as { ok: boolean; reason?: string }
    setDeriveState(result.ok ? 'done' : 'error')
  }

  const inputCls = 'w-full rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
  const labelCls = 'block text-xs font-medium text-gray-600 mb-1'

  return (
    <div className="py-6 px-6 max-w-2xl space-y-6">
      {/* Pipeline: Save → Derive → Deploy */}
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
            onClick={handleDerive}
            disabled={deriveState === 'running' || status.derivationStatus === 'running'}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-md transition-colors',
              status.derivationStatus === 'success'
                ? 'bg-green-50 text-green-700 hover:bg-green-100'
                : status.derivationStatus === 'error'
                ? 'bg-red-50 text-red-700 hover:bg-red-100'
                : status.derivationStatus === 'running' || deriveState === 'running'
                ? 'bg-yellow-50 text-yellow-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            )}
          >
            <span className="flex items-center gap-1.5">
              {(status.derivationStatus === 'running' || deriveState === 'running') && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {status.derivationStatus === 'success' && <Check className="w-3.5 h-3.5" />}
              {status.derivationStatus === 'error' && <AlertCircle className="w-3.5 h-3.5" />}
              {status.derivationStatus === 'running' || deriveState === 'running' ? 'Deriving...' :
               status.derivationStatus === 'success' ? 'Derived' :
               status.derivationStatus === 'error' ? 'Derive failed' : 'Derive'}
            </span>
          </button>
          <span className="text-gray-300">→</span>
          <button
            onClick={handleDeploy}
            disabled={!status.isReady || !selectedEnvSlug || deployState === 'deploying'}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-md transition-colors',
              deployState === 'done'
                ? 'bg-green-600 text-white hover:bg-green-700'
                : deployState === 'error'
                ? 'bg-red-600 text-white hover:bg-red-700'
                : deployState === 'deploying'
                ? 'bg-yellow-500 text-white'
                : status.isReady
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            )}
          >
            <span className="flex items-center gap-1.5">
              {deployState === 'deploying' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {deployState === 'done' && <Check className="w-3.5 h-3.5" />}
              {deployState === 'error' && <AlertCircle className="w-3.5 h-3.5" />}
              {deployState !== 'deploying' && deployState !== 'done' && deployState !== 'error' && <Rocket className="w-3.5 h-3.5" />}
              {deployState === 'deploying' ? 'Deploying...' :
               deployState === 'done' ? 'Redeploy' :
               deployState === 'error' ? 'Deploy failed' : 'Deploy'}
            </span>
          </button>
        </div>
      </div>

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
              onChange={e => { setSelectedEnvSlug(e.target.value); setDeployFiles([]) }}
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

      {/* Generated files preview */}
      {deployFiles.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">
              Generated files ({deployFiles.length})
            </h3>
            <button
              onClick={loadDeployFiles}
              className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-1">
            {deployFiles.map(f => (
              <div key={f.path} className="text-xs text-gray-500 font-mono truncate">{f.path}</div>
            ))}
          </div>
        </div>
      )}

      {/* Deploy logs */}
      {deployLogs.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Deploy log</h3>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-0.5 max-h-48 overflow-y-auto">
            {deployLogs.map((line, i) => (
              <div
                key={i}
                className={cn(
                  'text-xs font-mono',
                  line.startsWith('ERROR') ? 'text-red-600' :
                  line.startsWith('CREATED') ? 'text-green-600' :
                  line.startsWith('EXISTS') ? 'text-yellow-600' :
                  'text-gray-500'
                )}
              >
                {line}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
