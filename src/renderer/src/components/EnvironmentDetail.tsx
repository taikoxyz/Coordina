import { useState } from 'react'
import { Trash2, RefreshCw, Check, AlertCircle, ExternalLink } from 'lucide-react'
import { useEnvironments, useSaveEnvironment, useDeleteEnvironment } from '../hooks/useEnvironments'
import { useNav } from '../store/nav'
import type { EnvironmentRecord } from '../../../shared/types'
import { Button, Card, CardContent, Input, Label, ReadField, Select } from './ui'

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
              <Button variant="ghost" onClick={handleEdit}>
                Edit
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void handleAuth()}
              disabled={authStatus === 'authing'}
              title="Re-authenticate"
            >
              <RefreshCw className={`w-4 h-4 ${authStatus === 'authing' ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {authStatus === 'done' && (
          <div className="flex items-center gap-2 bg-green-50 px-3 py-2">
            <Check className="w-4 h-4 text-green-600" />
            <span className="text-sm text-green-700">Signed in with Google</span>
          </div>
        )}
        {authStatus === 'error' && (
          <div className="flex items-center gap-2 bg-red-50 px-3 py-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span className="text-sm text-red-700">Sign-in failed{authError ? `: ${authError}` : ''}</span>
          </div>
        )}

        {isEditing && form ? (
          <div className="flex gap-6">
            <div className="flex-1 border-b border-blue-200 bg-blue-50/30 p-4 space-y-3">
              <div>
                <Label>GCP Project ID</Label>
                <Input mono value={form.projectId} onChange={(e) => updateField('projectId', e.target.value)} placeholder="my-gcp-project" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Cluster name</Label><Input mono value={form.clusterName} onChange={(e) => updateField('clusterName', e.target.value)} /></div>
                <div><Label>Cluster location</Label><Input mono value={form.clusterZone} onChange={(e) => updateField('clusterZone', e.target.value)} /></div>
                <div><Label>Disk zone</Label><Input mono value={form.diskZone} onChange={(e) => updateField('diskZone', e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Gateway mode</Label>
                  <Select mono value={form.gatewayMode} onChange={(e) => updateField('gatewayMode', e.target.value)}>
                    <option value="port-forward">Port-forward (no domain)</option>
                    <option value="ingress">Ingress (domain + IAP)</option>
                  </Select>
                </div>
                <div>
                  <Label>Base domain</Label>
                  <Input mono value={form.domain} onChange={(e) => updateField('domain', e.target.value)} placeholder="example.com" disabled={form.gatewayMode !== 'ingress'} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>OAuth Client ID</Label><Input mono value={form.clientId} onChange={(e) => updateField('clientId', e.target.value)} /></div>
                <div><Label>OAuth Client Secret</Label><Input mono type="password" value={form.clientSecret} onChange={(e) => updateField('clientSecret', e.target.value)} /></div>
              </div>
              {formError && (
                <div className="flex items-center gap-2 text-xs text-red-600">
                  <AlertCircle className="w-3.5 h-3.5" />{formError}
                </div>
              )}
              <div className="flex items-center gap-2">
                <Button variant="primary" size="lg" onClick={() => void handleSave()} disabled={saveEnv.isPending}>
                  {saveEnv.isPending ? 'Saving...' : 'Save & Sign in with Google'}
                </Button>
                <Button variant="ghost" onClick={() => { setIsEditing(false); setForm(null) }}>
                  Cancel
                </Button>
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
          <Card>
            <CardContent>
              <ReadField label="Project ID" value={config.projectId} monospace />
              <ReadField label="Cluster" value={config.clusterName} monospace />
              <ReadField label="Cluster Zone" value={config.clusterZone} monospace />
              <ReadField label="Disk Zone" value={config.diskZone} monospace />
              <ReadField label="Gateway Mode" value={config.gatewayMode ?? 'port-forward'} />
              {config.domain && <ReadField label="Domain" value={config.domain} monospace />}
            </CardContent>
          </Card>
        )}

        <div className="pt-2">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <Button variant="destructive" onClick={handleDelete}>Confirm delete</Button>
              <Button variant="secondary" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            </div>
          ) : (
            <Button variant="ghost-destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="w-3.5 h-3.5" />Delete environment
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
