import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, AlertCircle, ExternalLink } from 'lucide-react'
import { useNav } from '../store/nav'
import { useSaveEnvironment } from '../hooks/useEnvironments'
import type { EnvironmentRecord } from '../../../shared/types'

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
  { title: 'OAuth Credentials', desc: 'APIs & Services > Credentials > Create OAuth client ID (Desktop app). Add http://localhost as redirect URI.', url: 'https://console.cloud.google.com/apis/credentials' },
  { title: 'Required APIs', desc: 'Enable container.googleapis.com and compute.googleapis.com.', url: 'https://console.cloud.google.com/apis/library' },
]

export function CreateEnvironmentDialog() {
  const { isCreateDialogOpen, setCreateDialogOpen, selectItem } = useNav()
  const saveEnv = useSaveEnvironment()
  const isOpen = isCreateDialogOpen === 'environments'

  const [form, setForm] = useState<GkeForm>(emptyGke())
  const [formError, setFormError] = useState<string | null>(null)
  const [authStatus, setAuthStatus] = useState<'idle' | 'authing' | 'done' | 'error'>('idle')

  const reset = () => {
    setForm(emptyGke())
    setFormError(null)
    setAuthStatus('idle')
  }

  const handleSave = async () => {
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
      setAuthStatus('authing')
      const authResult = await window.api.invoke('gke:auth', GKE_SLUG) as { ok: boolean }
      setAuthStatus(authResult.ok ? 'done' : 'error')
      selectItem({ type: 'environment', slug: GKE_SLUG })
      setCreateDialogOpen(null)
      reset()
    }
  }

  const updateField = (key: keyof GkeForm, value: string) => {
    setForm({ ...form, [key]: value })
    setFormError(null)
  }

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setCreateDialogOpen(null)
          reset()
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl focus:outline-none">
          <div className="flex items-center justify-between mb-5">
            <Dialog.Title className="text-sm font-semibold text-gray-900">
              Add Cloud Provider
            </Dialog.Title>
            <Dialog.Close className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
              <X className="w-4 h-4" />
            </Dialog.Close>
          </div>

          <div className="flex gap-6">
            <div className="flex-1 space-y-3">
              <p className="text-xs text-gray-400 font-mono">{GKE_SLUG}</p>

              <div>
                <label className={labelCls}>GCP Project ID</label>
                <input className={inputCls} value={form.projectId} onChange={(e) => updateField('projectId', e.target.value)} placeholder="my-gcp-project" />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Cluster name</label>
                  <input className={inputCls} value={form.clusterName} onChange={(e) => updateField('clusterName', e.target.value)} placeholder="coordina-cluster" />
                </div>
                <div>
                  <label className={labelCls}>Cluster location</label>
                  <input className={inputCls} value={form.clusterZone} onChange={(e) => updateField('clusterZone', e.target.value)} placeholder="us-central1" />
                </div>
                <div>
                  <label className={labelCls}>Disk zone</label>
                  <input className={inputCls} value={form.diskZone} onChange={(e) => updateField('diskZone', e.target.value)} placeholder="us-central1-a" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Gateway mode</label>
                  <select
                    className={inputCls}
                    value={form.gatewayMode}
                    onChange={(e) => updateField('gatewayMode', e.target.value)}
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
                    onChange={(e) => updateField('domain', e.target.value)}
                    placeholder="example.com"
                    disabled={form.gatewayMode !== 'ingress'}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>OAuth Client ID</label>
                  <input className={inputCls} value={form.clientId} onChange={(e) => updateField('clientId', e.target.value)} placeholder="0123456789-abc.apps.googleusercontent.com" />
                </div>
                <div>
                  <label className={labelCls}>OAuth Client Secret</label>
                  <input className={inputCls} type="password" value={form.clientSecret} onChange={(e) => updateField('clientSecret', e.target.value)} />
                </div>
              </div>

              {formError && (
                <div className="flex items-center gap-2 text-xs text-red-600">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {formError}
                </div>
              )}

              <button
                onClick={() => void handleSave()}
                disabled={saveEnv.isPending || authStatus === 'authing'}
                className="px-4 py-1.5 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saveEnv.isPending ? 'Saving...' : authStatus === 'authing' ? 'Signing in...' : 'Save & Sign in with Google'}
              </button>
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
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
