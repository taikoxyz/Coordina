import { useState } from 'react'
import { useEnvironments, useCreateEnvironment, useDeleteEnvironment } from '../hooks/useEnvironments'

type WizardStep = 'name' | 'type' | 'auth' | 'cluster' | 'confirm'

interface WizardState {
  name: string
  type: string
  projectId: string
  clusterName: string
  clusterZone: string
  domain: string
  authMethod: 'oauth' | 'service-account'
}

function AddEnvironmentWizard({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<WizardStep>('name')
  const [state, setState] = useState<WizardState>({
    name: '', type: 'gke', projectId: '', clusterName: '', clusterZone: '', domain: '', authMethod: 'oauth',
  })
  const createEnv = useCreateEnvironment()

  const update = (fields: Partial<WizardState>) => setState(s => ({ ...s, ...fields }))

  async function handleConfirm() {
    const config = {
      projectId: state.projectId,
      clusterName: state.clusterName,
      clusterZone: state.clusterZone,
      ...(state.domain ? { domain: state.domain } : {}),
      authMethod: state.authMethod,
    }
    await createEnv.mutateAsync({ type: state.type, name: state.name, config })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Add Environment</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>

        {step === 'name' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Environment Name</label>
              <input
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                placeholder="e.g. Production GKE"
                value={state.name}
                onChange={e => update({ name: e.target.value })}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white">Cancel</button>
              <button
                disabled={!state.name.trim()}
                onClick={() => setStep('type')}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >Next</button>
            </div>
          </div>
        )}

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
              <div className="font-medium text-gray-400">
                AWS EKS <span className="text-xs ml-2 bg-gray-600 px-2 py-0.5 rounded">Coming soon</span>
              </div>
            </button>
            <button disabled className="w-full text-left p-4 bg-gray-700/50 border border-gray-600 rounded-lg opacity-50 cursor-not-allowed">
              <div className="font-medium text-gray-400">
                Azure AKS <span className="text-xs ml-2 bg-gray-600 px-2 py-0.5 rounded">Coming soon</span>
              </div>
            </button>
            <div className="flex justify-start mt-2">
              <button onClick={() => setStep('name')} className="px-4 py-2 text-gray-400 hover:text-white">Back</button>
            </div>
          </div>
        )}

        {step === 'auth' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-300">How would you like to authenticate with GCP?</p>
            <button
              onClick={() => { update({ authMethod: 'oauth' }); setStep('cluster') }}
              className="w-full text-left p-4 rounded-lg border border-blue-500 bg-gray-700 hover:bg-gray-600"
            >
              <div className="font-medium text-white">Sign in with Google</div>
              <div className="text-sm text-gray-400 mt-1">Use your Google account via OAuth — recommended</div>
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
            <div>
              <label className="block text-sm text-gray-300 mb-1">
                Base Domain <span className="text-gray-500">(optional)</span>
              </label>
              <input
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                placeholder="example.com"
                value={state.domain}
                onChange={e => update({ domain: e.target.value })}
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
                <span className="text-gray-400">Name</span><span className="text-white">{state.name}</span>
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
              {state.domain && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Domain</span><span className="text-white">{state.domain}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-400">Auth</span>
                <span className="text-white">{state.authMethod === 'oauth' ? 'Google OAuth' : 'Service Account'}</span>
              </div>
            </div>
            <div className="flex justify-between mt-4">
              <button onClick={() => setStep('cluster')} className="px-4 py-2 text-gray-400 hover:text-white">Back</button>
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
                  onClick={() => deleteEnv.mutate(env.id)}
                  className="ml-4 text-gray-500 hover:text-red-400 text-sm px-3 py-1.5 rounded border border-gray-600 hover:border-red-500/50"
                >
                  Delete
                </button>
              </div>
            )
          })}
        </div>
      )}

      {showWizard && <AddEnvironmentWizard onClose={() => setShowWizard(false)} />}
    </div>
  )
}
