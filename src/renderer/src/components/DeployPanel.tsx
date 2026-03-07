import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, Check, HardDrive, Loader2, Rocket, FileText, Server, X } from 'lucide-react'
import { useEnvironments } from '../hooks/useEnvironments'
import { highlightContent } from '../lib/highlight'
import { Badge, Button, Select } from './ui'
import type { TeamSpec } from '../../../shared/types'

type DeployState = 'idle' | 'preparing' | 'reviewing' | 'deploying' | 'done' | 'error'

interface DeployFile {
  path: string
  content: string
}

type LogEntry =
  | { type: 'file'; path: string; content: string }
  | { type: 'status'; line: string; color: string }

interface AgentSelection {
  disk: boolean
  pod: boolean
}

function extractAgentSlugs(files: DeployFile[]): string[] {
  const slugs = new Set<string>()
  for (const f of files) {
    const match = f.path.match(/^agents\/([^/]+)\//)
    if (match) slugs.add(match[1])
  }
  return [...slugs].sort()
}

function computeSelectedPaths(files: DeployFile[], selections: Map<string, AgentSelection>): string[] {
  const paths: string[] = []
  for (const f of files) {
    const match = f.path.match(/^agents\/([^/]+)\/(.+)$/)
    if (!match) {
      if (f.path !== 'ingress.yaml') paths.push(f.path)
      continue
    }
    const [, slug, filename] = match
    const sel = selections.get(slug)
    if (!sel) continue
    const isDisk = filename === 'pv.yaml' || filename === 'pvc.yaml'
    const isPod = !isDisk && filename.endsWith('.yaml')
    if ((isDisk && sel.disk) || (isPod && sel.pod)) paths.push(f.path)
  }
  const anyPod = [...selections.values()].some(s => s.pod)
  if (anyPod && files.some(f => f.path === 'ingress.yaml')) paths.push('ingress.yaml')
  return paths
}

export function DeployPanel({
  spec,
  onSave,
  isSaving,
}: {
  spec: TeamSpec
  onSave: () => Promise<void>
  isSaving: boolean
}) {
  const { data: environments } = useEnvironments()
  const [selectedEnvSlug, setSelectedEnvSlug] = useState('')
  const [logEntries, setLogEntries] = useState<LogEntry[]>([])
  const [deployState, setDeployState] = useState<DeployState>('idle')
  const [viewingFile, setViewingFile] = useState<DeployFile | null>(null)
  const [recreateDisks, setRecreateDisks] = useState(false)
  const [recreatePods, setRecreatePods] = useState(false)
  const [previewFiles, setPreviewFiles] = useState<DeployFile[]>([])
  const [agentSelections, setAgentSelections] = useState<Map<string, AgentSelection>>(new Map())
  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (environments?.length && !selectedEnvSlug) {
      setSelectedEnvSlug(environments[0].slug)
    }
  }, [environments, selectedEnvSlug])

  useEffect(() => {
    window.api
      .invoke('deploy:getLogs', { teamSlug: spec.slug })
      .then((entries) => {
        const loaded = entries as LogEntry[]
        if (loaded.length > 0) setLogEntries(loaded)
      })
      .catch(() => {})
  }, [spec.slug])

  useEffect(() => {
    return window.api.on?.('deploy:status', (data: unknown) => {
      const d = data as { resource: string; status: string; message?: string }
      const line = `${d.status.toUpperCase().padEnd(8)} ${d.resource}${d.message ? ` — ${d.message}` : ''}`
      const color = d.status.toUpperCase().startsWith('ERROR') ? 'text-red-600'
        : d.status.toUpperCase().startsWith('CREATED') ? 'text-green-600'
          : d.status.toUpperCase().startsWith('EXISTS') ? 'text-yellow-600'
            : 'text-gray-600'
      setLogEntries((prev) => [...prev, { type: 'status', line, color }])
    })
  }, [])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logEntries])

  useEffect(() => {
    if (logEntries.length > 0 && deployState !== 'idle') {
      window.api.invoke('deploy:saveLogs', { teamSlug: spec.slug, entries: logEntries }).catch(() => {})
    }
  }, [deployState, logEntries, spec.slug])

  const handlePreview = useCallback(async () => {
    if (!selectedEnvSlug) return

    setDeployState('preparing')
    setLogEntries([])
    setViewingFile(null)
    setPreviewFiles([])
    await window.api.invoke('deploy:clearLogs', { teamSlug: spec.slug }).catch(() => {})

    try {
      await onSave()
      setLogEntries([{ type: 'status', line: 'Deriving deploy specs...', color: 'text-gray-500' }])

      const preview = (await window.api.invoke('deploy:preview', {
        teamSlug: spec.slug,
        envSlug: selectedEnvSlug,
      })) as { ok: boolean; reason?: string; files?: DeployFile[] }

      if (!preview.ok) {
        setDeployState('error')
        setLogEntries((prev) => [...prev, { type: 'status', line: `ERROR: ${preview.reason}`, color: 'text-red-600' }])
        return
      }

      const files = preview.files ?? []
      setPreviewFiles(files)

      const slugs = extractAgentSlugs(files)
      setAgentSelections(new Map(slugs.map(s => [s, { disk: true, pod: true }])))

      const fileEntries: LogEntry[] = files.map((f) => ({ type: 'file', path: f.path, content: f.content }))
      setLogEntries((prev) => [
        ...prev,
        { type: 'status', line: `Generated ${files.length} spec file${files.length !== 1 ? 's' : ''}`, color: 'text-gray-500' },
        ...fileEntries,
      ])
      setDeployState('reviewing')
    } catch (error) {
      setDeployState('error')
      setLogEntries((prev) => [...prev, { type: 'status', line: `ERROR: ${error instanceof Error ? error.message : String(error)}`, color: 'text-red-600' }])
    }
  }, [selectedEnvSlug, spec.slug, onSave])

  const handleApprove = useCallback(async () => {
    const selectedPaths = computeSelectedPaths(previewFiles, agentSelections)
    const allSelected = selectedPaths.length === previewFiles.filter(f => f.path.endsWith('.yaml')).length

    setLogEntries((prev) => [
      ...prev,
      { type: 'status', line: `Deploying ${selectedPaths.length} resource${selectedPaths.length !== 1 ? 's' : ''}...`, color: 'text-gray-500' },
    ])
    setDeployState('deploying')

    try {
      const result = (await window.api.invoke('deploy:team', {
        teamSlug: spec.slug,
        envSlug: selectedEnvSlug,
        options: {
          keepDisks: !recreateDisks,
          forceRecreate: recreatePods,
          ...(allSelected ? {} : { selectedPaths }),
        },
      })) as { ok: boolean; reason?: string }

      if (result.ok) {
        setDeployState('done')
        setLogEntries((prev) => [...prev, { type: 'status', line: 'Deployment complete', color: 'text-green-600' }])
      } else {
        setDeployState('error')
        setLogEntries((prev) => [...prev, { type: 'status', line: `ERROR: ${result.reason}`, color: 'text-red-600' }])
      }
    } catch (error) {
      setDeployState('error')
      setLogEntries((prev) => [...prev, { type: 'status', line: `ERROR: ${error instanceof Error ? error.message : String(error)}`, color: 'text-red-600' }])
    }
  }, [previewFiles, agentSelections, spec.slug, selectedEnvSlug, recreateDisks, recreatePods])

  const toggleAgentSelection = (slug: string, field: 'disk' | 'pod') => {
    setAgentSelections((prev) => {
      const next = new Map(prev)
      const current = next.get(slug) ?? { disk: true, pod: true }
      next.set(slug, { ...current, [field]: !current[field] })
      return next
    })
  }

  const statusBadgeVariant =
    deployState === 'done'
      ? 'success' as const
      : deployState === 'error'
        ? 'destructive' as const
        : deployState === 'preparing' || deployState === 'deploying'
          ? 'warning' as const
          : 'default' as const

  const agentNameMap = new Map(spec.agents.map(a => [a.slug, a.name || a.slug]))

  const fileEntries = logEntries.filter((e): e is LogEntry & { type: 'file' } => e.type === 'file')
  const statusEntries = logEntries.filter((e): e is LogEntry & { type: 'status' } => e.type === 'status')

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-center gap-4 px-5 py-3 border-b border-gray-200 shrink-0">
        {(environments ?? []).length > 0 && (
          <Select
            className="w-auto px-2 py-1 text-xs"
            value={selectedEnvSlug}
            onChange={(e) => setSelectedEnvSlug(e.target.value)}
            disabled={deployState === 'reviewing' || deployState === 'deploying'}
          >
            {(environments ?? []).map((env) => {
              const cfg = env.config as { clusterName?: string }
              const label = cfg.clusterName ? `${env.type}-${cfg.clusterName}` : env.slug
              return <option key={env.slug} value={env.slug}>{label}</option>
            })}
          </Select>
        )}
        {(deployState === 'done' || deployState === 'error') && (
          <Badge variant={statusBadgeVariant} className="uppercase tracking-wider">
            {deployState === 'done' && <Check className="w-3 h-3" />}
            {deployState === 'error' && <AlertCircle className="w-3 h-3" />}
            {deployState === 'done' ? 'Deployed' : 'Failed'}
          </Badge>
        )}
        {deployState !== 'reviewing' && (
          <>
            <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={recreateDisks}
                onChange={(e) => setRecreateDisks(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Recreate disks
            </label>
            <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={recreatePods}
                onChange={(e) => setRecreatePods(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Recreate pods
            </label>
          </>
        )}
        {deployState === 'reviewing' ? (
          <>
            <Button variant="secondary" size="sm" onClick={() => setDeployState('idle')}>
              Cancel
            </Button>
            <Button
              variant="dark"
              onClick={() => void handleApprove()}
              disabled={![...agentSelections.values()].some(s => s.disk || s.pod)}
            >
              <Check className="w-3.5 h-3.5" />
              Approve
            </Button>
          </>
        ) : (
          <Button
            variant="dark"
            onClick={() => void handlePreview()}
            disabled={!selectedEnvSlug || isSaving || deployState === 'preparing' || deployState === 'deploying'}
          >
            {deployState === 'preparing' || deployState === 'deploying' ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {deployState === 'preparing' ? 'Preparing...' : 'Deploying...'}
              </>
            ) : (
              <>
                <Rocket className="w-3.5 h-3.5" />
                Deploy
              </>
            )}
          </Button>
        )}
      </div>

      {/* Upper panel: deployment plan (agent selections + file list / file preview) */}
      <div className="flex-1 flex min-h-0">
        <div className={`flex flex-col min-h-0 overflow-y-auto ${viewingFile ? 'w-1/2 border-r border-gray-200' : 'flex-1'}`}>
          <div className="py-5 px-6 max-w-2xl mx-auto w-full space-y-4">
            {/* Agent selections (reviewing state) */}
            {deployState === 'reviewing' && agentSelections.size > 0 && (
              <div className="space-y-2">
                <h5 className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">Deployment Plan</h5>
                <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {[...agentSelections.entries()].map(([slug, sel]) => (
                    <div key={slug} className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-sm font-medium text-gray-800 min-w-0 truncate">
                        {agentNameMap.get(slug) ?? slug}
                      </span>
                      <div className="flex items-center gap-4 shrink-0">
                        <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={sel.disk}
                            onChange={() => toggleAgentSelection(slug, 'disk')}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <HardDrive className="w-3 h-3" />
                          Disk
                        </label>
                        <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={sel.pod}
                            onChange={() => toggleAgentSelection(slug, 'pod')}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <Server className="w-3 h-3" />
                          Pod
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* File list */}
            {fileEntries.length > 0 && (
              <div className="space-y-1">
                <h5 className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
                  Files ({fileEntries.length})
                </h5>
                {fileEntries.map((entry, index) => (
                  <button
                    key={`${index}:${entry.path}`}
                    onClick={() => setViewingFile({ path: entry.path, content: entry.content })}
                    className={`flex items-center gap-1.5 text-xs font-mono transition-colors w-full text-left py-0.5 ${
                      viewingFile?.path === entry.path
                        ? 'text-blue-800 font-semibold'
                        : 'text-blue-600 hover:text-blue-800 hover:underline'
                    }`}
                  >
                    <FileText className="w-3 h-3 shrink-0" />
                    {entry.path}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* File preview (right side) */}
        {viewingFile && (
          <div className="w-1/2 flex flex-col min-h-0">
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 shrink-0 bg-gray-50">
              <span className="text-xs font-semibold text-gray-700 font-mono truncate">
                {viewingFile.path}
              </span>
              <button
                onClick={() => setViewingFile(null)}
                className="rounded-md p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 min-h-0">
              <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap break-words">
                {highlightContent(viewingFile.content, viewingFile.path)}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* Lower panel: logs */}
      <div className="h-48 shrink-0 border-t border-gray-200 flex flex-col min-h-0 bg-gray-50">
        <div className="px-6 py-2 border-b border-gray-100 shrink-0">
          <h5 className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">Log</h5>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0 px-6 py-2 space-y-0.5">
          {statusEntries.length === 0 ? (
            <div className="text-xs text-gray-400">No logs yet.</div>
          ) : (
            statusEntries.map((entry, index) => (
              <div
                key={`${index}:${entry.line}`}
                className={`text-xs font-mono ${entry.color}`}
              >
                {entry.line}
              </div>
            ))
          )}
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  )
}
