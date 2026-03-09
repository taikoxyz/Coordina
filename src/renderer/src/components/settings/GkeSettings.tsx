import { useEffect, useState } from 'react'
import { AlertCircle, Check, ExternalLink, X } from 'lucide-react'
import { useGkeConfig, useSaveGkeConfig, useGkeAuthStatus } from '../../hooks/useEnvironments'
import { Button, Input, Label, Select } from '../ui'

interface GkeForm {
  projectId: string
  clusterName: string
  clusterZone: string
  diskZone: string
  clientId: string
  clientSecret: string
  gatewayMode: 'port-forward' | 'ingress'
  domain: string
  mcEnabled: boolean
  mcImage: string
  mcSessionSecret: string
}

const emptyGke = (): GkeForm => ({
  projectId: '', clusterName: '', clusterZone: 'us-central1', diskZone: 'us-central1-a',
  clientId: '', clientSecret: '', gatewayMode: 'port-forward', domain: '',
  mcEnabled: false, mcImage: '', mcSessionSecret: '',
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

const GUIDE_STEPS = [
  { title: 'GCP Project ID', desc: 'Find this on the GCP Console home page.', url: 'https://console.cloud.google.com/home/dashboard' },
  { title: 'Cluster Name & Zone', desc: 'Go to Kubernetes Engine > Clusters.', url: 'https://console.cloud.google.com/kubernetes/list' },
  { title: 'OAuth Credentials', desc: 'APIs & Services > Credentials > Create OAuth client ID (Desktop app). Add http://localhost as redirect URI.', url: 'https://console.cloud.google.com/apis/credentials' },
  { title: 'Required APIs', desc: 'Enable container.googleapis.com and compute.googleapis.com.', url: 'https://console.cloud.google.com/apis/library' },
]

export function GkeSettings() {
  const { data: gkeConfig } = useGkeConfig()
  const { data: authStatus } = useGkeAuthStatus()
  const saveConfig = useSaveGkeConfig()
  const [form, setForm] = useState<GkeForm>(emptyGke())
  const [formError, setFormError] = useState<string | null>(null)
  const [authState, setAuthState] = useState<'idle' | 'authing' | 'done' | 'error'>('idle')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (gkeConfig?.config) {
      const c = gkeConfig.config as Record<string, string>
      setForm({
        projectId: c.projectId ?? '',
        clusterName: c.clusterName ?? '',
        clusterZone: c.clusterZone ?? 'us-central1',
        diskZone: c.diskZone ?? 'us-central1-a',
        clientId: c.clientId ?? '',
        clientSecret: c.clientSecret ?? '',
        gatewayMode: (c.gatewayMode as 'port-forward' | 'ingress') ?? 'port-forward',
        domain: c.domain ?? '',
        mcEnabled: (c.missionControl as Record<string, unknown> | undefined)?.enabled === true,
        mcImage: ((c.missionControl as Record<string, string> | undefined)?.image) ?? '',
        mcSessionSecret: ((c.missionControl as Record<string, string> | undefined)?.sessionSecret) ?? '',
      })
    }
  }, [gkeConfig])

  const handleSave = async () => {
    const error = validateForm(form)
    if (error) { setFormError(error); return }
    setFormError(null)
    await saveConfig.mutateAsync({
      projectId: form.projectId,
      clusterName: form.clusterName,
      clusterZone: form.clusterZone,
      diskZone: form.diskZone || undefined,
      clientId: form.clientId,
      clientSecret: form.clientSecret,
      gatewayMode: form.gatewayMode,
      domain: form.gatewayMode === 'ingress' ? (form.domain || undefined) : undefined,
      missionControl: form.mcEnabled ? {
        enabled: true,
        image: form.mcImage,
        sessionSecret: form.mcSessionSecret,
      } : undefined,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const handleAuth = async () => {
    const error = validateForm(form)
    if (error) { setFormError(error); return }
    setFormError(null)
    await saveConfig.mutateAsync({
      projectId: form.projectId,
      clusterName: form.clusterName,
      clusterZone: form.clusterZone,
      diskZone: form.diskZone || undefined,
      clientId: form.clientId,
      clientSecret: form.clientSecret,
      gatewayMode: form.gatewayMode,
      domain: form.gatewayMode === 'ingress' ? (form.domain || undefined) : undefined,
      missionControl: form.mcEnabled ? {
        enabled: true,
        image: form.mcImage,
        sessionSecret: form.mcSessionSecret,
      } : undefined,
    })
    setAuthState('authing')
    const result = await window.api.invoke('gke:auth', 'gke') as { ok: boolean }
    setAuthState(result.ok ? 'done' : 'error')
  }

  const updateField = (key: keyof GkeForm, value: string | boolean) => {
    setForm({ ...form, [key]: value })
    setFormError(null)
    setSaved(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Google Cloud (GKE)</h3>
          <p className="text-xs text-gray-500 mt-0.5">Configure your GKE cluster for agent deployment.</p>
        </div>
        {authStatus?.authenticated ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
            <Check className="w-3 h-3" /> Authenticated
          </span>
        ) : gkeConfig ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full">
            <X className="w-3 h-3" /> Not authenticated
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
            <X className="w-3 h-3" /> Not configured
          </span>
        )}
      </div>

      <div className="flex gap-6">
        <div className="flex-1 space-y-3">
          <div>
            <Label>GCP Project ID</Label>
            <Input mono value={form.projectId} onChange={(e) => updateField('projectId', e.target.value)} placeholder="my-gcp-project" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Cluster name</Label>
              <Input mono value={form.clusterName} onChange={(e) => updateField('clusterName', e.target.value)} placeholder="coordina-cluster" />
            </div>
            <div>
              <Label>Cluster location</Label>
              <Input mono value={form.clusterZone} onChange={(e) => updateField('clusterZone', e.target.value)} placeholder="us-central1" />
            </div>
            <div>
              <Label>Disk zone</Label>
              <Input mono value={form.diskZone} onChange={(e) => updateField('diskZone', e.target.value)} placeholder="us-central1-a" />
            </div>
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
            <div>
              <Label>OAuth Client ID</Label>
              <Input mono value={form.clientId} onChange={(e) => updateField('clientId', e.target.value)} placeholder="0123456789-abc.apps.googleusercontent.com" />
            </div>
            <div>
              <Label>OAuth Client Secret</Label>
              <Input mono type="password" value={form.clientSecret} onChange={(e) => updateField('clientSecret', e.target.value)} />
            </div>
          </div>

          {formError && (
            <div className="flex items-center gap-2 text-xs text-red-600">
              <AlertCircle className="w-3.5 h-3.5" />
              {formError}
            </div>
          )}

          <div className="pt-3 border-t border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs font-semibold text-gray-700">Mission Control</p>
                <p className="text-xs text-gray-500 mt-0.5">Optional monitoring dashboard deployed alongside your agents.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={form.mcEnabled}
                  onChange={(e) => updateField('mcEnabled', e.target.checked)}
                />
                <div className="w-8 h-4 bg-gray-200 peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-4 peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all" />
              </label>
            </div>
            {form.mcEnabled && (
              <div className="space-y-3">
                <div>
                  <Label>Docker image</Label>
                  <Input mono value={form.mcImage} onChange={(e) => updateField('mcImage', e.target.value)} placeholder="gcr.io/my-project/mission-control:latest" />
                </div>
                <div>
                  <Label>Session secret (32 chars)</Label>
                  <Input mono type="password" value={form.mcSessionSecret} onChange={(e) => updateField('mcSessionSecret', e.target.value)} />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button variant="primary" size="sm" onClick={() => void handleSave()} disabled={saveConfig.isPending}>
              {saveConfig.isPending ? 'Saving...' : saved ? 'Saved' : 'Save'}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => void handleAuth()} disabled={authState === 'authing' || saveConfig.isPending}>
              {authState === 'authing' ? 'Signing in...' : 'Sign in with Google'}
            </Button>
          </div>
        </div>

        <div className="w-44 shrink-0 space-y-4">
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
    </div>
  )
}
