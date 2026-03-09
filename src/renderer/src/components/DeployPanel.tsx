import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, ExternalLink, Loader2, Rocket, FileText, Trash2, X } from 'lucide-react'
import { useGkeConfig } from '../hooks/useEnvironments'
import { useTeam, useSaveTeam } from '../hooks/useTeams'
import { useNav } from '../store/nav'
import { highlightContent } from '../lib/highlight'
import { Badge, Button, DialogShell } from './ui'

type DeployState = 'idle' | 'preparing' | 'deploying' | 'done' | 'error'

interface DeployFile {
  path: string
  content: string
}

type LogEntry =
  | { type: 'file'; path: string; content: string }
  | { type: 'status'; line: string; color: string }

export function DeployPanel({
  teamSlug,
  agentSlug,
}: {
  teamSlug: string
  agentSlug?: string
}) {
  const { data: spec } = useTeam(teamSlug)
  const saveTeam = useSaveTeam()
  const onSave = async () => { if (spec) await saveTeam.mutateAsync(spec) }

  const { data: gkeConfig } = useGkeConfig()
  const { deployingTeamSlug, setDeploying } = useNav()
  const isAnyDeploying = !!deployingTeamSlug
  const isThisDeploying = deployingTeamSlug === teamSlug

  const gkeProjectId = gkeConfig?.config.projectId as string | undefined
  const gkeClusterZone = gkeConfig?.config.clusterZone as string | undefined
  const gkeClusterName = gkeConfig?.config.clusterName as string | undefined
  const gkeConsoleUrl = gkeProjectId && gkeClusterZone && gkeClusterName && agentSlug
    ? `https://console.cloud.google.com/kubernetes/statefulset/${gkeClusterZone}/${gkeClusterName}/${teamSlug}/agent-${agentSlug}/details?project=${gkeProjectId}`
    : gkeProjectId
      ? `https://console.cloud.google.com/kubernetes/workload/overview?project=${gkeProjectId}`
      : 'https://console.cloud.google.com/kubernetes/workload/overview?project=coordina-489002'
  const [logEntries, setLogEntries] = useState<LogEntry[]>([])
  const [deployState, setDeployState] = useState<DeployState>('idle')
  const [viewingFile, setViewingFile] = useState<DeployFile | null>(null)
  const [recreateDisks, setRecreateDisks] = useState(false)
  const [recreatePods, setRecreatePods] = useState(false)
  const [showDeployDialog, setShowDeployDialog] = useState(false)
  const [deployScope, setDeployScope] = useState<'team' | 'agent'>('team')
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteScope, setDeleteScope] = useState<'team' | 'agent'>('team')
  const [deleteDisks, setDeleteDisks] = useState(false)
  useEffect(() => {
    if (!spec) return
    window.api
      .invoke('deploy:getLogs', { teamSlug: spec.slug })
      .then((entries) => {
        const loaded = entries as LogEntry[]
        if (loaded.length > 0) setLogEntries(loaded)
      })
      .catch(() => {})
  }, [spec?.slug])

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
    if (!spec) return
    if (logEntries.length > 0 && deployState !== 'idle') {
      window.api.invoke('deploy:saveLogs', { teamSlug: spec.slug, entries: logEntries }).catch(() => {})
    }
  }, [deployState, logEntries, spec?.slug])

  const handleDeploy = useCallback(async (deployAgentSlug?: string) => {
    if (!gkeConfig || !spec || isAnyDeploying) return

    setDeployState('preparing')
    setDeploying(spec.slug, deployAgentSlug)
    setLogEntries([])
    setViewingFile(null)
    await window.api.invoke('deploy:clearLogs', { teamSlug: spec.slug }).catch(() => {})

    try {
      await onSave()
      setLogEntries([{ type: 'status', line: 'Deriving deploy specs...', color: 'text-gray-500' }])

      const preview = (await window.api.invoke('deploy:preview', {
        teamSlug: spec.slug,
        envSlug: 'gke',
        ...(deployAgentSlug ? { agentSlug: deployAgentSlug } : {}),
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
        envSlug: 'gke',
        options: { recreateDisks, forceRecreatePods: recreatePods },
        ...(deployAgentSlug ? { agentSlug: deployAgentSlug } : {}),
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
    } finally {
      setDeploying(null)
    }
  }, [gkeConfig, spec, recreateDisks, recreatePods, isAnyDeploying])

  const handleUndeploy = useCallback(async (scope: 'team' | 'agent') => {
    if (!gkeConfig || !spec || isAnyDeploying) return
    setShowDeleteDialog(false)
    setDeploying(spec.slug)
    setLogEntries([{ type: 'status', line: scope === 'agent' ? 'Deleting agent...' : 'Deleting deployment...', color: 'text-red-500' }])
    setViewingFile(null)
    await window.api.invoke('deploy:clearLogs', { teamSlug: spec.slug }).catch(() => {})

    try {
      const result = (await window.api.invoke(scope === 'agent' ? 'undeploy:agent' : 'undeploy:team', {
        teamSlug: spec.slug,
        ...(scope === 'agent' ? { agentSlug } : {}),
        envSlug: 'gke',
        deleteDisks,
      })) as { ok: boolean; reason?: string }

      setLogEntries((prev) => [...prev, {
        type: 'status',
        line: result.ok ? (scope === 'agent' ? 'Agent deleted' : 'Deployment deleted') : `ERROR: ${result.reason}`,
        color: result.ok ? 'text-green-600' : 'text-red-600',
      }])
    } catch (error) {
      setLogEntries((prev) => [...prev, { type: 'status', line: `ERROR: ${error instanceof Error ? error.message : String(error)}`, color: 'text-red-600' }])
    } finally {
      setDeploying(null)
    }
  }, [gkeConfig, spec, deleteDisks, isAnyDeploying, agentSlug])

  if (!spec) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-gray-400">
        Loading...
      </div>
    )
  }

  const isDeploying = deployState === 'preparing' || deployState === 'deploying'
  const buttonDisabled = !gkeConfig || isAnyDeploying
  const disabledTitle = !gkeConfig
    ? 'Configure Google Cloud in Settings first'
    : (isAnyDeploying && !isThisDeploying)
      ? 'Another deployment is in progress'
      : undefined

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-gray-200 shrink-0 px-5 py-4 space-y-3">
        {/* Row 1: Deploy buttons + status badge */}
        <div className="flex items-center gap-2">
          {agentSlug && (
            <Button
              variant="dark"
              onClick={() => { setDeployScope('agent'); setShowDeployDialog(true) }}
              disabled={buttonDisabled}
              title={disabledTitle}
            >
              <Loader2 className={`w-3.5 h-3.5 ${isDeploying ? 'animate-spin' : 'hidden'}`} />
              <Rocket className={`w-3.5 h-3.5 ${isDeploying ? 'hidden' : ''}`} />
              Deploy Agent{isDeploying ? ' ...' : ''}
            </Button>
          )}
          {!agentSlug && (
            <Button
              variant="dark"
              onClick={() => { setDeployScope('team'); setShowDeployDialog(true) }}
              disabled={buttonDisabled}
              title={disabledTitle}
            >
              <Loader2 className={`w-3.5 h-3.5 ${isDeploying ? 'animate-spin' : 'hidden'}`} />
              <Rocket className={`w-3.5 h-3.5 ${isDeploying ? 'hidden' : ''}`} />
              Deploy Team{isDeploying ? ' ...' : ''}
            </Button>
          )}
          <div className="flex-1" />
          {agentSlug && (
            <Button
              variant="ghost-destructive"
              onClick={() => { setDeleteDisks(false); setDeleteScope('agent'); setShowDeleteDialog(true) }}
              disabled={buttonDisabled}
              title={disabledTitle}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Agent Deployment
            </Button>
          )}
          {!agentSlug && (
            <Button
              variant="ghost-destructive"
              onClick={() => { setDeleteDisks(false); setDeleteScope('team'); setShowDeleteDialog(true) }}
              disabled={buttonDisabled}
              title={disabledTitle}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Team Deployment
            </Button>
          )}
          {deployState === 'error' && (
            <Badge
              variant="destructive"
              className="uppercase tracking-wider"
            >
              <AlertCircle className="w-3 h-3" />
              Failed
            </Badge>
          )}
          {!gkeConfig && (
            <span className="text-xs text-amber-600">Configure Google Cloud in Settings</span>
          )}
        </div>

        {/* Row 2: GKE link */}
        <div className="flex items-center gap-4">
          <a
            href={gkeConsoleUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            GKE Workload
          </a>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        <div className={`flex flex-col min-h-0 ${viewingFile ? 'w-1/2 border-r border-gray-200' : 'flex-1'}`}>
          <div className="flex flex-col flex-1 min-h-0 py-5 px-6">
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

      <DialogShell
        open={showDeployDialog}
        onOpenChange={setShowDeployDialog}
        title={deployScope === 'agent' ? 'Deploy Agent' : 'Deploy Team'}
      >
        <div className="space-y-4">
          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={recreateDisks}
              onChange={(e) => setRecreateDisks(e.target.checked)}
              className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm">
              <span className="font-medium text-foreground">Recreate disks</span>
              <span className="block text-xs text-muted-foreground mt-0.5">Delete existing disks and create fresh ones. All agent memory and workspace data will be lost.</span>
            </span>
          </label>
          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={recreatePods}
              onChange={(e) => setRecreatePods(e.target.checked)}
              className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm">
              <span className="font-medium text-foreground">Force recreate pods</span>
              <span className="block text-xs text-muted-foreground mt-0.5">Delete and recreate pods even if config hasn't changed. Active sessions will be interrupted.</span>
            </span>
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setShowDeployDialog(false)}>Cancel</Button>
            <Button
              variant="dark"
              onClick={() => { setShowDeployDialog(false); void handleDeploy(deployScope === 'agent' ? agentSlug : undefined) }}
            >
              <Rocket className="w-3.5 h-3.5" />
              {deployScope === 'agent' ? 'Deploy Agent' : 'Deploy Team'}
            </Button>
          </div>
        </div>
      </DialogShell>

      <DialogShell
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title={deleteScope === 'agent' ? 'Delete Agent Deployment' : 'Delete Team Deployment'}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {deleteScope === 'agent'
              ? <>This will delete the Kubernetes resources for agent <span className="font-medium text-foreground">{agentSlug}</span> — StatefulSet and Service. The pod will be terminated immediately.</>
              : <>This will delete all Kubernetes resources for <span className="font-medium text-foreground">{spec.name}</span> — StatefulSets, Services, and Ingress. Pods will be terminated immediately.</>
            }
          </p>
          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={deleteDisks}
              onChange={(e) => setDeleteDisks(e.target.checked)}
              className="mt-0.5 rounded border-gray-300 text-destructive focus:ring-destructive"
            />
            <span className="text-sm">
              <span className="font-medium text-foreground">Also delete disks</span>
              <span className="block text-xs text-muted-foreground mt-0.5">Permanently removes all agent memory, workspace files, and stored data. This cannot be undone.</span>
            </span>
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => void handleUndeploy(deleteScope)}>
              <Trash2 className="w-3.5 h-3.5" />
              {deleteScope === 'agent' ? 'Delete Agent Deployment' : 'Delete Team Deployment'}
            </Button>
          </div>
        </div>
      </DialogShell>
    </div>
  )
}
