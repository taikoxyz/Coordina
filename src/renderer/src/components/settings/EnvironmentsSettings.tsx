import { useState } from 'react'
import { useEnvironments, useSaveEnvironment, useDeleteEnvironment } from '../../hooks/useEnvironments'
import { Plus, Trash2, ExternalLink, RefreshCw, Check, AlertCircle } from 'lucide-react'
import type { EnvironmentRecord } from '../../../../shared/types'

const GKE_SLUG = 'goog-gke'
const GKE_NAME = 'Google Kubernetes Engine'

interface GkeForm {
  projectId: string
  clusterName: string
  clusterZone: string
  diskZone: string
  clientId: string
  clientSecret: string
  gatewayMode: 'port-forward' | 'ingress'
  domain: string
}

const emptyGke = (): GkeForm => ({
  projectId: '', clusterName: '', clusterZone: 'us-central1', diskZone: 'us-central1-a',
  clientId: '', clientSecret: '', gatewayMode: 'port-forward', domain: '',
})

function fromRecord(env: EnvironmentRecord): GkeForm {
  const c = env.config as Record<string, string | undefined>
  const inferredMode = c.gatewayMode === 'ingress' || c.gatewayMode === 'port-forward'
    ? c.gatewayMode as GkeForm['gatewayMode']
    : (c.domain ? 'ingress' : 'port-forward')
  return {
    projectId: c.projectId ?? '', clusterName: c.clusterName ?? '',
    clusterZone: c.clusterZone ?? 'us-central1', diskZone: c.diskZone ?? 'us-central1-a',
    clientId: c.clientId ?? '', clientSecret: c.clientSecret ?? '',
    gatewayMode: inferredMode, domain: c.domain ?? '',
  }
}

function validateForm(form: GkeForm): string | null {
  if (!form.projectId.trim()) return 'GCP project ID is required'
  if (!form.clusterName.trim()) return 'Cluster name is required'
  if (!form.clientId.trim()) return 'OAuth client ID is required'
  if (!form.clientId.includes('.apps.googleusercontent.com')) return 'OAuth client ID must end with .apps.googleusercontent.com'
  if (!form.clientSecret.trim()) return 'OAuth client secret is required'
  if (form.gatewayMode === 'ingress' && !form.domain.trim()) return 'Base domain is required when using ingress mode'
  return null
}

const inputCls = 'w-full rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 font-mono placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
const labelCls = 'block text-xs font-medium text-gray-600 mb-1'

export function EnvironmentsSettings() {
  const { data: environments, isLoading } = useEnvironments()
  const saveEnv = useSaveEnvironment()
  const deleteEnv = useDeleteEnvironment()

  const [form, setForm] = useState<GkeForm | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [authStatus, setAuthStatus] = useState<'idle' | 'authing' | 'done' | 'error'>('idle')
  const [authError, setAuthError] = useState<string | null>(null)

  const gkeExists = environments?.some(e => e.type === 'gke')

  const openForm = () => {
    const existing = environments?.find(e => e.type === 'gke')
    setForm(existing ? fromRecord(existing) : emptyGke())
    setFormError(null)
  }

  const handleAuth = async () => {
    setAuthStatus('authing')
    setAuthError(null)
    const result = await window.api.invoke('gke:auth', GKE_SLUG) as { ok: boolean; reason?: string }
    setAuthStatus(result.ok ? 'done' : 'error')
    if (!result.ok) setAuthError(result.reason ?? 'Authentication failed')
  }

  const handleSave = async () => {
    if (!form) return
    const error = validateForm(form)
    if (error) { setFormError(error); return }
    setFormError(null)

    const record: EnvironmentRecord = {
      slug: GKE_SLUG, type: 'gke', name: GKE_NAME,
      config: {
        projectId: form.projectId, clusterName: form.clusterName,
        clusterZone: form.clusterZone, diskZone: form.diskZone || undefined,
        clientId: form.clientId, clientSecret: form.clientSecret,
        gatewayMode: form.gatewayMode,
        domain: form.gatewayMode === 'ingress' ? (form.domain || undefined) : undefined,
      },
    }
    const result = await saveEnv.mutateAsync(record)
    if ((result as { ok: boolean }).ok) {
      setForm(null)
      await handleAuth()
    }
  }

  const field = (key: keyof GkeForm, label: string, placeholder = '', type = 'text') => form && (
    <div>
      <label className={labelCls}>{label}</label>
      <input
        type={type}
        className={inputCls}
        value={form[key]}
        onChange={e => { setForm({ ...form, [key]: e.target.value }); setFormError(null) }}
        placeholder={placeholder}
      />
    </div>
  )

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Deployment Environments</h3>
          <p className="text-xs text-gray-500 mt-0.5">Configure cloud environments for deploying agent teams.</p>
        </div>
        {!gkeExists && !form && (
          <button
            onClick={openForm}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add GKE
          </button>
        )}
        {form && (
          <button onClick={() => setForm(null)} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
        )}
      </div>

      {/* Status messages */}
      {authStatus === 'done' && !form && (
        <div className="flex items-center gap-2 rounded-md bg-green-50 border border-green-200 px-3 py-2">
          <Check className="w-4 h-4 text-green-600" />
          <span className="text-sm text-green-700">Signed in with Google</span>
        </div>
      )}
      {authStatus === 'error' && !form && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <span className="text-sm text-red-700">Sign-in failed{authError ? `: ${authError}` : ''}. Use Re-auth to try again.</span>
        </div>
      )}

      {/* GKE form */}
      {form && (
        <div className="flex gap-6">
          <div className="flex-1 rounded-lg border border-blue-200 bg-blue-50/50 p-4 space-y-3">
            <p className="text-xs text-gray-400 font-mono">{GKE_SLUG}</p>
            {field('projectId', 'GCP Project ID', 'my-gcp-project')}
            <div className="grid grid-cols-3 gap-3">
              {field('clusterName', 'Cluster name', 'coordina-cluster')}
              {field('clusterZone', 'Cluster location', 'us-central1')}
              {field('diskZone', 'Disk zone', 'us-central1-a')}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Gateway mode</label>
                <select
                  className={inputCls}
                  value={form.gatewayMode}
                  onChange={e => { setForm({ ...form, gatewayMode: e.target.value as GkeForm['gatewayMode'] }); setFormError(null) }}
                >
                  <option value="port-forward">Port-forward (no domain)</option>
                  <option value="ingress">Ingress (domain + IAP)</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Base domain</label>
                <input
                  className={inputCls}
                  value={form.domain}
                  onChange={e => { setForm({ ...form, domain: e.target.value }); setFormError(null) }}
                  placeholder="example.com"
                  disabled={form.gatewayMode !== 'ingress'}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {field('clientId', 'OAuth Client ID', '0123456789-abc.apps.googleusercontent.com')}
              {field('clientSecret', 'OAuth Client Secret', '', 'password')}
            </div>
            {formError && (
              <div className="flex items-center gap-2 text-xs text-red-600">
                <AlertCircle className="w-3.5 h-3.5" />
                {formError}
              </div>
            )}
            <button
              onClick={handleSave}
              disabled={saveEnv.isPending || authStatus === 'authing'}
              className="px-4 py-1.5 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saveEnv.isPending ? 'Saving...' : authStatus === 'authing' ? 'Signing in...' : 'Save & Sign in with Google'}
            </button>
          </div>

          {/* Help panel */}
          <div className="w-56 shrink-0 space-y-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Setup Guide</p>
            {[
              { title: 'GCP Project ID', desc: 'Find this on the GCP Console home page.', url: 'https://console.cloud.google.com/home/dashboard' },
              { title: 'Cluster Name & Zone', desc: 'Go to Kubernetes Engine > Clusters.', url: 'https://console.cloud.google.com/kubernetes/list' },
              { title: 'OAuth Credentials', desc: 'APIs & Services > Credentials > Create OAuth client ID (Desktop app). Add http://localhost as redirect URI.', url: 'https://console.cloud.google.com/apis/credentials' },
              { title: 'Required APIs', desc: 'Enable container.googleapis.com and compute.googleapis.com.', url: 'https://console.cloud.google.com/apis/library' },
            ].map(s => (
              <div key={s.title} className="space-y-1">
                <p className="text-xs font-medium text-gray-700">{s.title}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{s.desc}</p>
                <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
                  Open <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Environment list */}
      {isLoading && <p className="text-sm text-gray-400">Loading...</p>}
      {!isLoading && !environments?.length && !form && (
        <div className="rounded-lg border border-dashed border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-500">No environments. Add GKE to enable deployment.</p>
        </div>
      )}

      {environments?.map(env => (
        <div key={env.slug} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 group">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-blue-50 text-xs font-semibold text-blue-600 shrink-0">
              GKE
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">{env.name}</span>
                {authStatus === 'done' && (
                  <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                    <Check className="w-3 h-3" /> Authenticated
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-400 font-mono truncate">
                {(env.config as { projectId?: string }).projectId}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={openForm} className="px-2.5 py-1 text-xs font-medium rounded-md text-gray-600 hover:bg-gray-100 transition-colors">
              Edit
            </button>
            <button
              onClick={handleAuth}
              disabled={authStatus === 'authing'}
              className="p-1.5 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              title="Re-authenticate"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${authStatus === 'authing' ? 'animate-spin' : ''}`} />
            </button>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              {deleteTarget === env.slug ? (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => { deleteEnv.mutate(env.slug); setDeleteTarget(null) }}
                    className="px-2.5 py-1 text-xs font-medium rounded-md bg-red-600 text-white hover:bg-red-700"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setDeleteTarget(null)}
                    className="px-2.5 py-1 text-xs font-medium rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setDeleteTarget(env.slug)}
                  className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
