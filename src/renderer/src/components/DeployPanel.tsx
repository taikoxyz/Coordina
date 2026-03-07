import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, Check, ExternalLink, Loader2, Rocket, FileText, X } from 'lucide-react'
import { useEnvironments } from '../hooks/useEnvironments'
import { highlightContent } from '../lib/highlight'
import { Badge, Button, Select } from './ui'
import type { TeamSpec } from '../../../shared/types'

type DeployState = 'idle' | 'preparing' | 'deploying' | 'done' | 'error'

interface DeployFile {
  path: string
  content: string
}

type LogEntry =
  | { type: 'file'; path: string; content: string }
  | { type: 'status'; line: string; color: string }

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

  const selectedEnv = (environments ?? []).find((e) => e.slug === selectedEnvSlug)
  const gkeProjectId = selectedEnv?.type === 'gke'
    ? (selectedEnv.config as { projectId?: string }).projectId
    : undefined
  const gkeConsoleUrl = gkeProjectId
    ? `https://console.cloud.google.com/kubernetes/workload/overview?project=${gkeProjectId}`
    : 'https://console.cloud.google.com/kubernetes/workload/overview?project=coordina-489002'
  const [logEntries, setLogEntries] = useState<LogEntry[]>([])
  const [deployState, setDeployState] = useState<DeployState>('idle')
  const [viewingFile, setViewingFile] = useState<DeployFile | null>(null)
  const [recreateDisks, setRecreateDisks] = useState(false)
  const [recreatePods, setRecreatePods] = useState(false)
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

  const handleDeploy = useCallback(async () => {
    if (!selectedEnvSlug) return

    setDeployState('preparing')
    setLogEntries([])
    setViewingFile(null)
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
      const fileEntries: LogEntry[] = files.map((f) => ({ type: 'file', path: f.path, content: f.content }))
      setLogEntries((prev) => [
        ...prev,
        { type: 'status', line: `Generated ${files.length} spec file${files.length !== 1 ? 's' : ''}`, color: 'text-gray-500' },
        ...fileEntries,
        { type: 'status', line: 'Starting deployment...', color: 'text-gray-500' },
      ])
      setDeployState('deploying')

      const result = (await window.api.invoke('deploy:team', {
        teamSlug: spec.slug,
        envSlug: selectedEnvSlug,
        options: { keepDisks: !recreateDisks, forceRecreate: recreatePods },
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
  }, [selectedEnvSlug, spec.slug, onSave, recreateDisks, recreatePods])

  const statusBadgeVariant =
    deployState === 'done'
      ? 'success' as const
      : deployState === 'error'
        ? 'destructive' as const
        : deployState === 'preparing' || deployState === 'deploying'
          ? 'warning' as const
          : 'default' as const

  const statusLabel =
    deployState === 'idle' ? 'Idle'
      : deployState === 'preparing' ? 'Preparing'
        : deployState === 'deploying' ? 'Deploying'
          : deployState === 'done' ? 'Deployed'
            : 'Failed'

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-center gap-4 px-5 py-3 border-b border-gray-200 shrink-0">
        {(environments ?? []).length > 0 && (
          <Select
            className="w-auto px-2 py-1 text-xs"
            value={selectedEnvSlug}
            onChange={(e) => setSelectedEnvSlug(e.target.value)}
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
            {statusLabel}
          </Badge>
        )}
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
        <a
          href={gkeConsoleUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          GKE Workloads
        </a>
        <Button
          variant="dark"
          onClick={() => void handleDeploy()}
          disabled={!selectedEnvSlug || isSaving || deployState === 'preparing' || deployState === 'deploying'}
        >
          {deployState === 'preparing' || deployState === 'deploying' ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Deploying...
            </>
          ) : (
            <>
              <Rocket className="w-3.5 h-3.5" />
              Deploy
            </>
          )}
        </Button>
      </div>

      <div className="flex-1 flex min-h-0">
        <div className={`flex flex-col min-h-0 ${viewingFile ? 'w-1/2 border-r border-gray-200' : 'flex-1'}`}>
          <div className={`flex flex-col flex-1 min-h-0 py-5 px-6 ${viewingFile ? '' : 'max-w-2xl mx-auto w-full'}`}>
            <h5 className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400 mb-2 shrink-0">Log</h5>
            <div className="flex-1 overflow-y-auto min-h-0 space-y-0.5">
            {logEntries.length === 0 ? (
              <div className="text-sm text-gray-400">
                No logs found.
              </div>
            ) : (
              logEntries.map((entry, index) =>
                entry.type === 'file' ? (
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
                ) : (
                  <div
                    key={`${index}:${entry.line}`}
                    className={`text-xs font-mono ${entry.color}`}
                  >
                    {entry.line}
                  </div>
                ),
              )
            )}
            <div ref={logEndRef} />
            </div>
          </div>
        </div>

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
    </div>
  )
}
