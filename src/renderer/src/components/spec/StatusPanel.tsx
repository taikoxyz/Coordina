// Right panel showing live JSON, derived files, and deployment controls
// FEATURE: Status panel combining spec viewer with deployment controls and file browser
import { useState, useEffect, useCallback } from 'react'
import { useSpecStatus } from '../../hooks/useSpecStatus'
import { useEnvironments } from '../../hooks/useEnvironments'
import type { TeamSpec, DeployOptions } from '../../../../shared/types'

interface Props {
  spec: TeamSpec
  onSave: () => Promise<void>
  isSaving: boolean
}

type DeployState = 'idle' | 'deploying' | 'done' | 'error'
type DeriveState = 'idle' | 'running' | 'done' | 'error'
type Tab = 'json' | 'files'

interface DeployFile {
  path: string
  content: string
}

export function StatusPanel({ spec, onSave, isSaving }: Props) {
  const status = useSpecStatus(spec.slug)
  const { data: environments } = useEnvironments()
  const [selectedEnvSlug, setSelectedEnvSlug] = useState('')
  const [keepDisks, setKeepDisks] = useState(true)
  const [deployState, setDeployState] = useState<DeployState>('idle')
  const [deriveState, setDeriveState] = useState<DeriveState>('idle')
  const [deployLogs, setDeployLogs] = useState<string[]>([])
  const [gitMessage, setGitMessage] = useState('')
  const [gitStatus, setGitStatus] = useState<{ dirty: boolean; files: string[] }>({ dirty: false, files: [] })
  const [activeTab, setActiveTab] = useState<Tab>('json')
  const [deployFiles, setDeployFiles] = useState<DeployFile[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)

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
    if (files.length) setSelectedFile(f => f && files.find(x => x.path === f) ? f : files[0].path)
  }, [spec.slug, selectedEnvSlug, environments])

  useEffect(() => {
    if (status.derivationStatus === 'success') loadDeployFiles()
  }, [status.derivationStatus, loadDeployFiles])

  useEffect(() => {
    if (activeTab === 'files') loadDeployFiles()
  }, [activeTab, loadDeployFiles])

  const handleDeploy = async () => {
    setDeployState('deploying')
    setDeployLogs([])
    const options: DeployOptions = { keepDisks }
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

  const validationColor = status.isValid ? 'text-green-400' : (status.validationErrors.length ? 'text-red-400' : 'text-gray-500')
  const derivationColor = status.derivationStatus === 'success' ? 'text-green-400' : (status.derivationStatus === 'error' ? 'text-red-400' : status.derivationStatus === 'running' ? 'text-yellow-400' : 'text-gray-500')
  const fileContent = deployFiles.find(f => f.path === selectedFile)?.content ?? ''

  return (
    <div className="h-full flex flex-col border-l border-gray-700/60">
      {/* Tabs + status indicators */}
      <div className="px-3 py-1.5 border-b border-gray-700/60 flex items-center gap-3 shrink-0">
        <button onClick={() => setActiveTab('json')} className={`text-[10px] pb-px ${activeTab === 'json' ? 'text-blue-300 border-b border-blue-400' : 'text-gray-500 hover:text-gray-300'}`}>JSON</button>
        <button onClick={() => setActiveTab('files')} className={`text-[10px] pb-px ${activeTab === 'files' ? 'text-blue-300 border-b border-blue-400' : 'text-gray-500 hover:text-gray-300'}`}>
          Files{deployFiles.length > 0 ? ` (${deployFiles.length})` : ''}
        </button>
        <div className="flex-1" />
        <span className={`text-[10px] ${validationColor}`}>
          {status.isValid ? '✓ valid' : (status.validationErrors.length ? `✗ ${status.validationErrors.length} error${status.validationErrors.length > 1 ? 's' : ''}` : '— validating')}
        </span>
        <span className={`text-[10px] ${derivationColor}`}>
          {status.derivationStatus === 'success' ? '✓ derived' : status.derivationStatus === 'running' ? '⟳ deriving' : status.derivationStatus === 'error' ? '✗ derive failed' : '—'}
        </span>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {activeTab === 'json' && (
          <div className="flex-1 overflow-auto">
            <pre className="p-3 text-[10px] text-gray-300 font-mono leading-relaxed whitespace-pre-wrap">
              {JSON.stringify(spec, null, 2)}
            </pre>
            {status.validationErrors.length > 0 && (
              <div className="px-3 pb-3 space-y-0.5">
                {status.validationErrors.map((e, i) => (
                  <div key={i} className="text-[10px] text-red-400 font-mono">{e.field}: {e.message}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'files' && (
          <div className="flex-1 flex overflow-hidden">
            {/* File list */}
            <div className="w-44 shrink-0 border-r border-gray-700/60 overflow-y-auto py-1">
              {deployFiles.length === 0 ? (
                <div className="px-3 py-2 text-[10px] text-gray-600">
                  {status.derivationStatus === 'success' ? 'No files' : 'Waiting for derivation…'}
                </div>
              ) : deployFiles.map(f => {
                const parts = f.path.split('/')
                const name = parts.pop()!
                const dir = parts.join('/')
                return (
                  <button
                    key={f.path}
                    onClick={() => setSelectedFile(f.path)}
                    title={f.path}
                    className={`w-full text-left px-3 py-0.5 hover:bg-gray-800 ${selectedFile === f.path ? 'bg-gray-800' : ''}`}
                  >
                    {dir && <div className="text-[9px] text-gray-600 font-mono truncate">{dir}/</div>}
                    <div className={`text-[10px] font-mono truncate ${selectedFile === f.path ? 'text-blue-300' : 'text-gray-400'}`}>{name}</div>
                  </button>
                )
              })}
            </div>
            {/* File content */}
            <div className="flex-1 overflow-auto">
              {selectedFile ? (
                <>
                  <div className="px-3 py-1 border-b border-gray-700/60 text-[10px] text-gray-500 font-mono sticky top-0 bg-gray-900">{selectedFile}</div>
                  <pre className="p-3 text-[10px] text-gray-300 font-mono leading-relaxed whitespace-pre-wrap">{fileContent}</pre>
                </>
              ) : (
                <div className="p-3 text-[10px] text-gray-600">Select a file</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Action panel — always visible at bottom */}
      <div className="shrink-0 border-t border-gray-700/60 p-3 space-y-2">
        {gitStatus.dirty && (
          <div className="flex gap-1.5">
            <span className="text-[10px] text-yellow-400 self-center">● {gitStatus.files.length} changes</span>
            <input
              type="text"
              value={gitMessage}
              onChange={e => setGitMessage(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCommit()}
              placeholder="Commit message…"
              className="flex-1 bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-[11px] text-gray-200 focus:outline-none focus:border-blue-600"
            />
            <button
              onClick={handleCommit}
              disabled={!gitMessage.trim()}
              className="text-[10px] px-2 py-0.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-gray-200 rounded"
            >
              Commit
            </button>
          </div>
        )}

        {/* Environment selector + keep disks */}
        <div className="flex items-center gap-2">
          <select
            value={selectedEnvSlug}
            onChange={e => { setSelectedEnvSlug(e.target.value); setDeployFiles([]); setSelectedFile(null) }}
            className="flex-1 bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-[11px] text-gray-200 focus:outline-none focus:border-blue-600"
          >
            {(environments ?? []).map(e => <option key={e.slug} value={e.slug}>{e.name}</option>)}
          </select>
          <label className="flex items-center gap-1 text-[10px] text-gray-400 cursor-pointer whitespace-nowrap">
            <input type="checkbox" checked={keepDisks} onChange={e => setKeepDisks(e.target.checked)} className="accent-blue-500" />
            Keep disks
          </label>
        </div>

        {/* Save → Derive → Deploy action row */}
        <div className="flex items-center gap-1">
          <button
            onClick={onSave}
            disabled={isSaving}
            className="text-[11px] px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-200 rounded transition-colors"
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
          <span className="text-[10px] text-gray-600">›</span>
          <button
            onClick={handleDerive}
            disabled={deriveState === 'running' || status.derivationStatus === 'running'}
            className={`text-[11px] px-3 py-1 rounded transition-colors ${
              status.derivationStatus === 'success' ? 'bg-green-800 hover:bg-green-700 text-green-200' :
              status.derivationStatus === 'error' ? 'bg-red-900 hover:bg-red-800 text-red-200' :
              status.derivationStatus === 'running' || deriveState === 'running' ? 'bg-yellow-900 text-yellow-200 opacity-70' :
              'bg-gray-700 hover:bg-gray-600 text-gray-200'
            }`}
          >
            {status.derivationStatus === 'running' || deriveState === 'running' ? 'Deriving…' :
             status.derivationStatus === 'success' ? '✓ Derive' :
             status.derivationStatus === 'error' ? '✗ Derive' : 'Derive'}
          </button>
          <span className="text-[10px] text-gray-600">›</span>
          <button
            onClick={handleDeploy}
            disabled={!status.isReady || !selectedEnvSlug || deployState === 'deploying'}
            className={`text-[11px] px-3 py-1 rounded transition-colors ${
              deployState === 'done' ? 'bg-green-800 hover:bg-green-700 text-green-200' :
              deployState === 'error' ? 'bg-red-900 hover:bg-red-800 text-red-200' :
              deployState === 'deploying' ? 'bg-yellow-900 text-yellow-200 opacity-70' :
              status.isReady ? 'bg-blue-700 hover:bg-blue-600 text-white' :
              'bg-gray-700 text-gray-500'
            }`}
          >
            {deployState === 'deploying' ? 'Deploying…' :
             deployState === 'done' ? 'Redeploy' :
             deployState === 'error' ? '✗ Deploy' : 'Deploy'}
          </button>
        </div>

        {deployLogs.length > 0 && (
          <div className="bg-gray-950 rounded p-2 space-y-0.5 max-h-28 overflow-y-auto">
            {deployLogs.map((line, i) => (
              <div key={i} className={`text-[10px] font-mono ${line.startsWith('ERROR') ? 'text-red-400' : line.startsWith('CREATED') ? 'text-green-400' : line.startsWith('EXISTS') ? 'text-yellow-500' : line.startsWith('MC') ? 'text-purple-400' : 'text-gray-400'}`}>{line}</div>
            ))}
          </div>
        )}

        {spec.missionControl?.enabled && deployState === 'done' && (
          <div className="flex items-center gap-2 pt-1 border-t border-gray-700/40">
            <span className="text-[10px] text-gray-500">MC</span>
            <button
              onClick={async () => {
                const result = await window.api.invoke('mc:register-agents', { teamSlug: spec.slug, envSlug: selectedEnvSlug }) as { ok: boolean; registered?: string[]; errors?: Array<{ slug: string; error: string }> }
                if (result.ok) {
                  setDeployLogs(prev => [...prev, `MC: Registered ${result.registered?.length ?? 0} agents`])
                } else {
                  for (const err of result.errors ?? []) {
                    setDeployLogs(prev => [...prev, `MC ERROR: ${err.slug} — ${err.error}`])
                  }
                }
              }}
              className="text-[10px] px-2 py-0.5 bg-purple-800 hover:bg-purple-700 text-purple-200 rounded"
            >
              Register Agents
            </button>
            <button
              onClick={() => {
                const domain = spec.missionControl?.domain || `mc.${spec.domain || 'example.com'}`
                window.open(`https://${domain}`, '_blank')
              }}
              className="text-[10px] px-2 py-0.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded"
            >
              Open MC
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
