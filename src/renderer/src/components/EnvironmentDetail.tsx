import { useState } from 'react'
import { Trash2, RefreshCw, Check, AlertCircle, ExternalLink } from 'lucide-react'
import { useEnvironments, useSaveEnvironment, useDeleteEnvironment } from '../hooks/useEnvironments'
import { useNav } from '../store/nav'
import type { EnvironmentRecord } from '../../../shared/types'

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

const GKE_SLUG = 'goog-gke'
const GKE_NAME = 'Google Kubernetes Engine'

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

const GUIDE_STEPS = [
  { title: 'GCP Project ID', desc: 'Find this on the GCP Console home page.', url: 'https://console.cloud.google.com/home/dashboard' },
  { title: 'Cluster Name & Zone', desc: 'Go to Kubernetes Engine > Clusters.', url: 'https://console.cloud.google.com/kubernetes/list' },
  { title: 'OAuth Credentials', desc: 'APIs & Services > Credentials > Create OAuth client ID (Desktop app).', url: 'https://console.cloud.google.com/apis/credentials' },
  { title: 'Required APIs', desc: 'Enable container.googleapis.com and compute.googleapis.com.', url: 'https://console.cloud.google.com/apis/library' },
]

export function EnvironmentDetail({ slug }: { slug: string }) {
  const { data: environments } = useEnvironments()
  const saveEnv = useSaveEnvironment()
  const deleteEnv = useDeleteEnvironment()
  const { selectItem } = useNav()

  const env = environments?.find((e) => e.slug === slug)

  const [isEditing, setIsEditing] = useState(false)
  const [form, setForm] = useState<GkeForm | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [authStatus, setAuthStatus] = useState<'idle' | 'authing' | 'done' | 'error'>('idle')
  const [authError, setAuthError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (!env) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-gray-400">
        Environment not found
      </div>
    )
  }

  const config = env.config as Record<string, string | undefined>

  const handleEdit = () => {
    setForm(fromRecord(env))
    setIsEditing(true)
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
      setIsEditing(false)
      setForm(null)
      await handleAuth()
    }
  }

  const handleDelete = () => {
    deleteEnv.mutate(slug)
    selectItem(null as never)
  }

  const updateField = (key: keyof GkeForm, value: string) => {
    if (form) {
      setForm({ ...form, [key]: value })
      setFormError(null)
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-50 text-sm font-semibold text-blue-600">
              GKE
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{env.name}</h2>
              <p className="text-xs text-gray-400 font-mono">{env.slug}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isEditing && (
              <button onClick={handleEdit} className="px-3 py-1.5 text-xs font-medium rounded-md text-gray-600 hover:bg-gray-100 transition-colors">
                Edit
              </button>
            )}
            <button
              onClick={() => void handleAuth()}
              disabled={authStatus === 'authing'}
              className="p-1.5 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              title="Re-authenticate"
            >
              <RefreshCw className={`w-4 h-4 ${authStatus === 'authing' ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {authStatus === 'done' && (
          <div className="flex items-center gap-2 rounded-md bg-green-50 border border-green-200 px-3 py-2">
            <Check className="w-4 h-4 text-green-600" />
            <span className="text-sm text-green-700">Signed in with Google</span>
          </div>
        )}
        {authStatus === 'error' && (
          <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span className="text-sm text-red-700">Sign-in failed{authError ? `: ${authError}` : ''}</span>
          </div>
        )}

        {isEditing && form ? (
          <div className="flex gap-6">
            <div className="flex-1 rounded-lg border border-blue-200 bg-blue-50/50 p-4 space-y-3">
              <div>
                <label className={labelCls}>GCP Project ID</label>
                <input className={inputCls} value={form.projectId} onChange={(e) => updateField('projectId', e.target.value)} placeholder="my-gcp-project" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className={labelCls}>Cluster name</label><input className={inputCls} value={form.clusterName} onChange={(e) => updateField('clusterName', e.target.value)} /></div>
                <div><label className={labelCls}>Cluster location</label><input className={inputCls} value={form.clusterZone} onChange={(e) => updateField('clusterZone', e.target.value)} /></div>
                <div><label className={labelCls}>Disk zone</label><input className={inputCls} value={form.diskZone} onChange={(e) => updateField('diskZone', e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Gateway mode</label>
                  <select className={inputCls} value={form.gatewayMode} onChange={(e) => updateField('gatewayMode', e.target.value)}>
                    <option value="port-forward">Port-forward (no domain)</option>
                    <option value="ingress">Ingress (domain + IAP)</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Base domain</label>
                  <input className={inputCls} value={form.domain} onChange={(e) => updateField('domain', e.target.value)} placeholder="example.com" disabled={form.gatewayMode !== 'ingress'} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>OAuth Client ID</label><input className={inputCls} value={form.clientId} onChange={(e) => updateField('clientId', e.target.value)} /></div>
                <div><label className={labelCls}>OAuth Client Secret</label><input className={inputCls} type="password" value={form.clientSecret} onChange={(e) => updateField('clientSecret', e.target.value)} /></div>
              </div>
              {formError && (
                <div className="flex items-center gap-2 text-xs text-red-600">
                  <AlertCircle className="w-3.5 h-3.5" />{formError}
                </div>
              )}
              <div className="flex items-center gap-2">
                <button onClick={() => void handleSave()} disabled={saveEnv.isPending} className="px-4 py-1.5 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {saveEnv.isPending ? 'Saving...' : 'Save & Sign in with Google'}
                </button>
                <button onClick={() => { setIsEditing(false); setForm(null) }} className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700">
                  Cancel
                </button>
              </div>
            </div>

            <div className="w-48 shrink-0 space-y-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Setup Guide</p>
              {GUIDE_STEPS.map((s) => (
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
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-xs font-medium text-gray-500 mb-1">Project ID</label><p className="text-sm text-gray-900 font-mono">{config.projectId}</p></div>
              <div><label className="block text-xs font-medium text-gray-500 mb-1">Cluster</label><p className="text-sm text-gray-900 font-mono">{config.clusterName}</p></div>
              <div><label className="block text-xs font-medium text-gray-500 mb-1">Cluster Zone</label><p className="text-sm text-gray-900 font-mono">{config.clusterZone}</p></div>
              <div><label className="block text-xs font-medium text-gray-500 mb-1">Disk Zone</label><p className="text-sm text-gray-900 font-mono">{config.diskZone}</p></div>
              <div><label className="block text-xs font-medium text-gray-500 mb-1">Gateway Mode</label><p className="text-sm text-gray-900">{config.gatewayMode ?? 'port-forward'}</p></div>
              {config.domain && <div><label className="block text-xs font-medium text-gray-500 mb-1">Domain</label><p className="text-sm text-gray-900 font-mono">{config.domain}</p></div>}
            </div>
          </div>
        )}

        <div className="pt-2">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <button onClick={handleDelete} className="px-3 py-1.5 text-xs font-medium rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors">Confirm delete</button>
              <button onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md text-red-600 hover:bg-red-50 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />Delete environment
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
