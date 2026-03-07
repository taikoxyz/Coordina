import { useCallback, useEffect, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { AlertCircle, Check, Loader2, Rocket, X, FileText } from 'lucide-react'
import { useEnvironments } from '../hooks/useEnvironments'
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
  const [logEntries, setLogEntries] = useState<LogEntry[]>([])
  const [deployState, setDeployState] = useState<DeployState>('idle')
  const [viewingFile, setViewingFile] = useState<DeployFile | null>(null)
  const [recreateDisks, setRecreateDisks] = useState(false)
  const [recreatePods, setRecreatePods] = useState(false)
  const logEndRef = useRef<HTMLDivElement>(null)
  const logEntriesRef = useRef(logEntries)
  logEntriesRef.current = logEntries

  const persistLogs = useCallback(() => {
    window.api.invoke('deploy:saveLogs', { teamSlug: spec.slug, entries: logEntriesRef.current }).catch(() => {})
  }, [spec.slug])

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

  const handleDeploy = useCallback(async () => {
    if (!selectedEnvSlug) return

    setDeployState('preparing')
    setLogEntries([])
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
        queueMicrotask(persistLogs)
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
      queueMicrotask(persistLogs)
    } catch (error) {
      setDeployState('error')
      setLogEntries((prev) => [...prev, { type: 'status', line: `ERROR: ${error instanceof Error ? error.message : String(error)}`, color: 'text-red-600' }])
      queueMicrotask(persistLogs)
    }
  }, [selectedEnvSlug, spec.slug, onSave, persistLogs, recreateDisks, recreatePods])

  const statusBadgeCls =
    deployState === 'done'
      ? 'bg-green-50 text-green-700'
      : deployState === 'error'
        ? 'bg-red-50 text-red-700'
        : deployState === 'preparing' || deployState === 'deploying'
          ? 'bg-yellow-50 text-yellow-700'
          : 'bg-gray-100 text-gray-500'

  const statusLabel =
    deployState === 'idle' ? 'Idle'
      : deployState === 'preparing' ? 'Preparing'
        : deployState === 'deploying' ? 'Deploying'
          : deployState === 'done' ? 'Deployed'
            : 'Failed'

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-4 px-5 py-3 border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-3">
          <h4 className="text-sm font-semibold text-gray-900">Deploy</h4>
          {(environments ?? []).length > 0 && (
            <select
              className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedEnvSlug}
              onChange={(e) => setSelectedEnvSlug(e.target.value)}
            >
              {(environments ?? []).map((env) => (
                <option key={env.slug} value={env.slug}>{env.name}</option>
              ))}
            </select>
          )}
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-wider ${statusBadgeCls}`}>
            {deployState === 'done' && <Check className="w-3 h-3" />}
            {deployState === 'error' && <AlertCircle className="w-3 h-3" />}
            {(deployState === 'preparing' || deployState === 'deploying') && <Loader2 className="w-3 h-3 animate-spin" />}
            {statusLabel}
          </span>
        </div>
        <div className="flex items-center gap-4">
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

      <div className="flex-1 flex flex-col p-4 min-h-0">
        <h5 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2 shrink-0">Log</h5>
        <div className="flex-1 overflow-y-auto min-h-0 space-y-0.5 rounded-lg border border-gray-100 bg-gray-50/50 p-3">
          {logEntries.length === 0 ? (
            <div className="text-xs text-gray-400">
              {deployState === 'preparing' ? 'Preparing deployment...' : 'Click Deploy to start.'}
            </div>
          ) : (
            logEntries.map((entry, index) =>
              entry.type === 'file' ? (
                <button
                  key={`${index}:${entry.path}`}
                  onClick={() => setViewingFile({ path: entry.path, content: entry.content })}
                  className="flex items-center gap-1.5 text-xs font-mono text-blue-600 hover:text-blue-800 hover:underline transition-colors w-full text-left py-0.5"
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

      <Dialog.Root open={!!viewingFile} onOpenChange={(open) => { if (!open) setViewingFile(null) }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl max-h-[80vh] rounded-lg bg-white shadow-xl focus:outline-none flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 shrink-0">
              <Dialog.Title className="text-sm font-semibold text-gray-900 font-mono truncate">
                {viewingFile?.path}
              </Dialog.Title>
              <Dialog.Close className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
                <X className="w-4 h-4" />
              </Dialog.Close>
            </div>
            <div className="flex-1 overflow-auto p-4 min-h-0">
              <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap break-words">
                {viewingFile?.content}
              </pre>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
