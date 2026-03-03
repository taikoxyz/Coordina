import { useState } from 'react'
import { useEnvironments, useCreateEnvironment, useDeleteEnvironment } from '../hooks/useEnvironments'

type WizardStep = 'type' | 'auth' | 'gcp-login' | 'gcp-project' | 'gcp-cluster' | 'cluster' | 'confirm'

interface GcpProject { projectId: string; name: string }
interface GkeCluster { name: string; location: string; status: string }

interface WizardState {
  type: string
  projectId: string
  clusterName: string
  clusterZone: string
  authMethod: 'oauth' | 'service-account'
}

function uniqueName(base: string, taken: string[]): string {
  if (!taken.includes(base)) return base
  let n = 2
  while (taken.includes(`${base} ${n}`)) n++
  return `${base} ${n}`
}

function AddEnvironmentWizard({ existingNames, onClose }: { existingNames: string[]; onClose: () => void }) {
  const [step, setStep] = useState<WizardStep>('type')
  const [state, setState] = useState<WizardState>({
    type: 'gke', projectId: '', clusterName: '', clusterZone: '', authMethod: 'oauth',
  })
  const [projects, setProjects] = useState<GcpProject[]>([])
  const [clusters, setClusters] = useState<GkeCluster[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const createEnv = useCreateEnvironment()

  const update = (fields: Partial<WizardState>) => setState(s => ({ ...s, ...fields }))

  async function handleGcpLogin() {
    setIsLoading(true)
    setError(null)
    try {
      const { installed } = await window.api.invoke('gcp:isInstalled') as { installed: boolean }
      if (!installed) {
        setError('gcloud CLI not found. Install it from cloud.google.com/sdk and restart the app.')
        return
      }
      const loginResult = await window.api.invoke('gcp:login') as { ok: boolean; error?: string }
      if (!loginResult.ok) { setError(loginResult.error ?? 'Login failed'); return }
      const listResult = await window.api.invoke('gcp:projects:list') as { ok: boolean; projects?: GcpProject[]; error?: string }
      if (!listResult.ok) { setError(listResult.error ?? 'Failed to list projects'); return }
      setProjects(listResult.projects ?? [])
      setStep('gcp-project')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unexpected error — check that gcloud is installed and try again.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleProjectSelect(projectId: string) {
    update({ projectId })
    setIsLoading(true)
    setError(null)
    try {
      const result = await window.api.invoke('gcp:clusters:list', projectId) as { ok: boolean; clusters?: GkeCluster[]; error?: string }
      if (!result.ok) { setError(result.error ?? 'Failed to list clusters'); return }
      setClusters(result.clusters ?? [])
      setStep('gcp-cluster')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to list clusters')
    } finally {
      setIsLoading(false)
    }
  }

  function handleClusterSelect(cluster: GkeCluster) {
    update({ clusterName: cluster.name, clusterZone: cluster.location })
    setStep('confirm')
  }

  async function handleConfirm() {
    const base = state.clusterName || state.projectId || 'GKE'
    const name = uniqueName(base, existingNames)
    const config = {
      projectId: state.projectId,
      clusterName: state.clusterName,
      clusterZone: state.clusterZone,
      authMethod: state.authMethod,
    }
    try {
      await createEnv.mutateAsync({ type: state.type, name, config })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save environment')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Add Environment</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>

        {step === 'type' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-300">Select environment type:</p>
            <button
              onClick={() => { update({ type: 'gke' }); setStep('auth') }}
              className="w-full text-left p-4 bg-gray-700 border border-blue-500 rounded-lg hover:bg-gray-600"
            >
              <div className="font-medium text-white">Google Kubernetes Engine (GKE)</div>
              <div className="text-sm text-gray-400 mt-1">Deploy agent teams to Google Cloud Kubernetes</div>
            </button>
            <button disabled className="w-full text-left p-4 bg-gray-700/50 border border-gray-600 rounded-lg opacity-50 cursor-not-allowed">
              <div className="font-medium text-gray-400">AWS EKS <span className="text-xs ml-2 bg-gray-600 px-2 py-0.5 rounded">Coming soon</span></div>
            </button>
            <button disabled className="w-full text-left p-4 bg-gray-700/50 border border-gray-600 rounded-lg opacity-50 cursor-not-allowed">
              <div className="font-medium text-gray-400">Azure AKS <span className="text-xs ml-2 bg-gray-600 px-2 py-0.5 rounded">Coming soon</span></div>
            </button>
            <div className="flex justify-start mt-2">
              <button onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white">Cancel</button>
            </div>
          </div>
        )}

        {step === 'auth' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-300">How would you like to authenticate with GCP?</p>
            <button
              onClick={() => { update({ authMethod: 'oauth' }); setStep('gcp-login') }}
              className="w-full text-left p-4 rounded-lg border border-blue-500 bg-gray-700 hover:bg-gray-600"
            >
              <div className="font-medium text-white">Sign in with Google</div>
              <div className="text-sm text-gray-400 mt-1">Projects and clusters are discovered automatically — recommended</div>
            </button>
            <button
              onClick={() => { update({ authMethod: 'service-account' }); setStep('cluster') }}
              className="w-full text-left p-4 rounded-lg border border-gray-600 bg-gray-700 hover:bg-gray-600"
            >
              <div className="font-medium text-white">Service Account JSON</div>
              <div className="text-sm text-yellow-400 mt-1">⚠ Credentials stored in keychain. Rotate regularly.</div>
            </button>
            <div className="flex justify-start mt-2">
              <button onClick={() => setStep('type')} className="px-4 py-2 text-gray-400 hover:text-white">Back</button>
            </div>
          </div>
        )}

        {step === 'gcp-login' && (
          <div className="space-y-4">
            <div className="text-center py-4">
              <div className="text-4xl mb-3">☁️</div>
              <h3 className="text-white font-medium mb-2">Sign in to Google Cloud</h3>
              <p className="text-sm text-gray-400 mb-1">
                Opens a browser window to authenticate with your Google account.
              </p>
              <p className="text-xs text-gray-500 mb-6">
                Requires <code className="bg-gray-700 px-1 rounded">gcloud CLI</code> to be installed.
              </p>
              {error && (
                <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded text-sm text-red-300 text-left">{error}</div>
              )}
              <button
                onClick={handleGcpLogin}
                disabled={isLoading}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
              >
                {isLoading ? 'Waiting for browser…' : 'Sign in with Google'}
              </button>
            </div>
            <div className="flex justify-start">
              <button onClick={() => { setError(null); setStep('auth') }} className="px-4 py-2 text-gray-400 hover:text-white">Back</button>
            </div>
          </div>
        )}

        {step === 'gcp-project' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-300 mb-2">Select a GCP project:</p>
            {isLoading ? (
              <div className="text-center py-8 text-gray-400">Loading projects…</div>
            ) : projects.length === 0 ? (
              <div className="text-center py-8 text-gray-400">No projects found</div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {projects.map(p => (
                  <button
                    key={p.projectId}
                    onClick={() => handleProjectSelect(p.projectId)}
                    className="w-full text-left p-3 rounded-lg border border-gray-600 bg-gray-700 hover:bg-gray-600 hover:border-blue-500 transition-colors"
                  >
                    <div className="font-medium text-white text-sm">{p.name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{p.projectId}</div>
                  </button>
                ))}
              </div>
            )}
            {error && <div className="p-3 bg-red-900/50 border border-red-700 rounded text-sm text-red-300">{error}</div>}
            <div className="flex justify-start mt-2">
              <button onClick={() => { setError(null); setStep('gcp-login') }} className="px-4 py-2 text-gray-400 hover:text-white">Back</button>
            </div>
          </div>
        )}

        {step === 'gcp-cluster' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-300 mb-2">
              Select a cluster in <span className="text-white font-medium">{state.projectId}</span>:
            </p>
            {isLoading ? (
              <div className="text-center py-8 text-gray-400">Loading clusters…</div>
            ) : clusters.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400 mb-2">No clusters found in this project.</p>
                <p className="text-xs text-gray-500">Create a GKE cluster in the Google Cloud Console first.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {clusters.map(c => (
                  <button
                    key={c.name}
                    onClick={() => handleClusterSelect(c)}
                    className="w-full text-left p-3 rounded-lg border border-gray-600 bg-gray-700 hover:bg-gray-600 hover:border-blue-500 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-white text-sm">{c.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${c.status === 'RUNNING' ? 'bg-green-900/50 text-green-300 border-green-700' : 'bg-yellow-900/50 text-yellow-300 border-yellow-700'}`}>
                        {c.status}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">{c.location}</div>
                  </button>
                ))}
              </div>
            )}
            {error && <div className="p-3 bg-red-900/50 border border-red-700 rounded text-sm text-red-300">{error}</div>}
            <div className="flex justify-start mt-2">
              <button onClick={() => { setError(null); setStep('gcp-project') }} className="px-4 py-2 text-gray-400 hover:text-white">Back</button>
            </div>
          </div>
        )}

        {step === 'cluster' && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-300 mb-1">GCP Project ID</label>
              <input
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                placeholder="my-gcp-project"
                value={state.projectId}
                onChange={e => update({ projectId: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Cluster Name</label>
              <input
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                placeholder="my-cluster"
                value={state.clusterName}
                onChange={e => update({ clusterName: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Cluster Zone</label>
              <input
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                placeholder="us-central1-a"
                value={state.clusterZone}
                onChange={e => update({ clusterZone: e.target.value })}
              />
            </div>
            <div className="flex justify-between mt-4">
              <button onClick={() => setStep('auth')} className="px-4 py-2 text-gray-400 hover:text-white">Back</button>
              <button
                disabled={!state.projectId || !state.clusterName || !state.clusterZone}
                onClick={() => setStep('confirm')}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >Next</button>
            </div>
          </div>
        )}

        {step === 'confirm' && (
          <div className="space-y-4">
            <div className="bg-gray-700/50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Name</span>
                <span className="text-white">{uniqueName(state.clusterName || state.projectId || 'GKE', existingNames)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Type</span><span className="text-white">GKE</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Project</span><span className="text-white">{state.projectId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Cluster</span><span className="text-white">{state.clusterName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Zone</span><span className="text-white">{state.clusterZone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Auth</span>
                <span className="text-white">{state.authMethod === 'oauth' ? 'Google OAuth' : 'Service Account'}</span>
              </div>
            </div>
            <div className="flex justify-between mt-4">
              <button onClick={() => setStep(state.authMethod === 'oauth' ? 'gcp-cluster' : 'cluster')} className="px-4 py-2 text-gray-400 hover:text-white">Back</button>
              <button
                onClick={handleConfirm}
                disabled={createEnv.isPending}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                {createEnv.isPending ? 'Saving…' : 'Add Environment'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function EnvironmentsPage() {
  const { data: environments = [], isLoading } = useEnvironments()
  const deleteEnv = useDeleteEnvironment()
  const [showWizard, setShowWizard] = useState(false)

  if (isLoading) {
    return <div className="p-8 text-gray-400">Loading environments…</div>
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Deployment Environments</h1>
          <p className="text-gray-400 text-sm mt-1">Configure GKE clusters for deploying agent teams</p>
        </div>
        <button
          onClick={() => setShowWizard(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          + Add Environment
        </button>
      </div>

      {environments.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <div className="text-4xl mb-4">☁️</div>
          <p className="text-lg mb-2">No environments configured</p>
          <p className="text-sm">Add a GKE cluster to start deploying agent teams</p>
        </div>
      ) : (
        <div className="space-y-3">
          {environments.map(env => {
            const cfg = env.config as { projectId?: string; clusterName?: string; clusterZone?: string; domain?: string }
            return (
              <div key={env.id} className="bg-gray-800 border border-gray-700 rounded-lg p-5 flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-white">{env.name}</h3>
                    <span className="text-xs px-2 py-0.5 bg-blue-900/50 text-blue-300 rounded-full border border-blue-700">
                      {env.type.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-sm text-gray-400 space-y-0.5">
                    {cfg.projectId && <div><span className="text-gray-500">Project:</span> {cfg.projectId}</div>}
                    {cfg.clusterName && (
                      <div>
                        <span className="text-gray-500">Cluster:</span> {cfg.clusterName}
                        {cfg.clusterZone && <span className="text-gray-600 ml-1">({cfg.clusterZone})</span>}
                      </div>
                    )}
                    {cfg.domain && <div><span className="text-gray-500">Domain:</span> {cfg.domain}</div>}
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (window.confirm(`Delete environment "${env.name}"? This cannot be undone.`))
                      deleteEnv.mutate(env.id)
                  }}
                  className="ml-4 text-gray-500 hover:text-red-400 text-sm px-3 py-1.5 rounded border border-gray-600 hover:border-red-500/50"
                >
                  Delete
                </button>
              </div>
            )
          })}
        </div>
      )}

      {showWizard && (
        <AddEnvironmentWizard
          existingNames={environments.map(e => e.name)}
          onClose={() => setShowWizard(false)}
        />
      )}
    </div>
  )
}
