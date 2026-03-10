import { useEffect, useState } from 'react'
import { AlertCircle, Check, ExternalLink, X } from 'lucide-react'
import { useGkeConfig, useSaveGkeConfig, useGkeAuthStatus, useTestGkeAuth, useGcpProjects, useGcpRegions, useGcpZones } from '../../hooks/useEnvironments'
import { Button, Input, Label, Select } from '../ui'

export function GkeStatusBadge() {
  const { data: gkeConfig } = useGkeConfig()
  const { data: authStatus } = useGkeAuthStatus()
  if (authStatus?.authenticated) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
        <Check className="w-3 h-3" /> Connected
      </span>
    )
  }
  if (gkeConfig) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full">
        <X className="w-3 h-3" /> Not connected
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
      <X className="w-3 h-3" /> Not configured
    </span>
  )
}

interface GkeForm {
  projectId: string
  clusterZone: string
  diskZone: string
  clientId: string
  clientSecret: string
  gatewayMode: 'port-forward' | 'ingress'
  domain: string
}

const emptyGke = (): GkeForm => ({
  projectId: '', clusterZone: 'us-central1', diskZone: 'us-central1-a',
  clientId: '', clientSecret: '', gatewayMode: 'port-forward', domain: '',
})

function validateForm(form: GkeForm): string | null {
  if (!form.clientId.trim()) return 'OAuth client ID is required'
  if (!form.clientId.includes('.apps.googleusercontent.com')) return 'OAuth client ID must end with .apps.googleusercontent.com'
  if (!form.clientSecret.trim()) return 'OAuth client secret is required'
  if (!form.projectId.trim()) return 'GCP project ID is required'
  if (form.gatewayMode === 'ingress' && !form.domain.trim()) return 'Base domain is required when using ingress mode'
  return null
}

function validateAuth(form: GkeForm): string | null {
  if (!form.clientId.trim()) return 'OAuth client ID is required'
  if (!form.clientId.includes('.apps.googleusercontent.com')) return 'OAuth client ID must end with .apps.googleusercontent.com'
  if (!form.clientSecret.trim()) return 'OAuth client secret is required'
  return null
}

const GUIDE_STEPS = [
  { title: 'OAuth Credentials', desc: 'APIs & Services > Credentials > Create OAuth client ID (Desktop app). Add http://localhost as redirect URI.', url: 'https://console.cloud.google.com/apis/credentials' },
  { title: 'GCP Project', desc: 'After signing in, select your project from the dropdown.', url: 'https://console.cloud.google.com/home/dashboard' },
  { title: 'Cluster Location', desc: 'Go to Kubernetes Engine > Clusters. Each team gets its own cluster.', url: 'https://console.cloud.google.com/kubernetes/list' },
  { title: 'Required APIs', desc: 'Enable container.googleapis.com and compute.googleapis.com.', url: 'https://console.cloud.google.com/apis/library' },
  { title: 'Required IAM Role', desc: 'Grant the signing-in Google account the "Kubernetes Engine Developer" role (roles/container.developer) on your GCP project. For ingress mode with IAP, also grant "IAP-secured Web App User".', url: 'https://console.cloud.google.com/iam-admin/iam' },
]

export function GkeSettings() {
  const { data: gkeConfig } = useGkeConfig()
  const { data: authStatus } = useGkeAuthStatus()
  const saveConfig = useSaveGkeConfig()
  const testAuth = useTestGkeAuth()
  const [form, setForm] = useState<GkeForm>(emptyGke())
  const [formError, setFormError] = useState<string | null>(null)
  const [authState, setAuthState] = useState<'idle' | 'authing' | 'done' | 'error'>('idle')
  const [authTestResult, setAuthTestResult] = useState<'idle' | 'ok' | 'fail'>('idle')
  const [authEmail, setAuthEmail] = useState<string | null>(null)
  const [showReauth, setShowReauth] = useState(false)
  const [saved, setSaved] = useState(false)
  const { data: projects } = useGcpProjects(!!authStatus?.authenticated)
  const { data: regions } = useGcpRegions(form.projectId || undefined)
  const { data: zones } = useGcpZones(form.projectId || undefined, form.clusterZone || undefined)

  useEffect(() => {
    if (gkeConfig?.config) {
      const c = gkeConfig.config as Record<string, string>
      setForm({
        projectId: c.projectId ?? '',
        clusterZone: c.clusterZone ?? 'us-central1',
        diskZone: c.diskZone ?? 'us-central1-a',
        clientId: c.clientId ?? '',
        clientSecret: c.clientSecret ?? '',
        gatewayMode: (c.gatewayMode as 'port-forward' | 'ingress') ?? 'port-forward',
        domain: c.domain ?? '',
      })
    }
  }, [gkeConfig])

  useEffect(() => {
    if (authStatus?.authenticated && !authEmail) {
      void testAuth.mutateAsync().then((result) => {
        if (result.ok) setAuthEmail(result.email ?? null)
      })
    }
  }, [authStatus?.authenticated]) // eslint-disable-line react-hooks/exhaustive-deps

  const buildPayload = () => ({
    projectId: form.projectId,
    clusterZone: form.clusterZone,
    diskZone: form.diskZone || undefined,
    clientId: form.clientId,
    clientSecret: form.clientSecret,
    gatewayMode: form.gatewayMode,
    domain: form.gatewayMode === 'ingress' ? (form.domain || undefined) : undefined,
  })

  const handleSave = async () => {
    const error = validateForm(form)
    if (error) { setFormError(error); return }
    setFormError(null)
    await saveConfig.mutateAsync(buildPayload())
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const handleTestAuth = async () => {
    setAuthTestResult('idle')
    setFormError(null)
    const result = await testAuth.mutateAsync()
    if (result.ok) {
      setAuthTestResult('ok')
      setAuthEmail(result.email ?? null)
      setTimeout(() => setAuthTestResult('idle'), 3000)
    } else {
      setAuthTestResult('fail')
      setAuthEmail(null)
      setFormError(result.error ?? 'Authentication test failed')
    }
  }

  const handleAuth = async () => {
    const error = validateAuth(form)
    if (error) { setFormError(error); return }
    setFormError(null)
    await saveConfig.mutateAsync(buildPayload())
    setAuthState('authing')
    const result = await window.api.invoke('gke:auth', 'gke') as { ok: boolean }
    setAuthState(result.ok ? 'done' : 'error')
    if (result.ok) setShowReauth(false)
  }

  const updateField = (key: keyof GkeForm, value: string | boolean) => {
    setForm({ ...form, [key]: value })
    setFormError(null)
    setSaved(false)
  }

  return (
    <div className="space-y-3">
      <hr className="border-gray-200" />
      <h4 className="text-sm font-semibold text-gray-900 mb-1">Authentication</h4>

      {authStatus?.authenticated && !showReauth ? (
        <div className="space-y-3">
          {authEmail && (
            <p className="text-xs text-gray-500">
              Connected as <span className="font-mono text-gray-700">{authEmail}</span>
            </p>
          )}
          {!authEmail && (
            <p className="text-xs text-gray-500">
              Your Google credentials are stored securely.
            </p>
          )}
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void handleTestAuth()}
              disabled={testAuth.isPending}
            >
              {testAuth.isPending ? 'Testing...' : authTestResult === 'ok' ? 'Connection valid' : 'Test connection'}
            </Button>
            {authTestResult === 'ok' && <Check className="w-4 h-4 text-green-600" />}
            <Button variant="ghost-destructive" size="sm" onClick={() => setShowReauth(true)}>
              Disconnect
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <Label>OAuth Client ID</Label>
            <Input mono value={form.clientId} onChange={(e) => updateField('clientId', e.target.value)} placeholder="0123456789-abc.apps.googleusercontent.com" />
          </div>

          <div>
            <Label>OAuth Client Secret</Label>
            <Input mono type="password" value={form.clientSecret} onChange={(e) => updateField('clientSecret', e.target.value)} />
          </div>

          <p className="text-xs text-gray-400 leading-relaxed">
            The signing-in Google account must have the{' '}
            <span className="font-mono text-gray-500">Kubernetes Engine Developer</span>{' '}
            role (<span className="font-mono text-gray-500">roles/container.developer</span>) on the GCP project.
            For ingress mode with IAP, also grant{' '}
            <span className="font-mono text-gray-500">IAP-secured Web App User</span>.
          </p>

          <div className="flex items-center gap-3">
            <Button variant="primary" size="sm" onClick={() => void handleAuth()} disabled={authState === 'authing' || saveConfig.isPending}>
              {authState === 'authing' ? 'Signing in...' : 'Sign in with Google'}
            </Button>
            {showReauth && (
              <Button variant="ghost" size="sm" onClick={() => setShowReauth(false)}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      )}

      <hr className="border-gray-200" />
      <h4 className="text-sm font-semibold text-gray-900 mb-1">Deployment</h4>

      <div>
        <Label>GCP Project</Label>
        {authStatus?.authenticated && projects && projects.length > 0 ? (
          <Select mono value={form.projectId} onChange={(e) => updateField('projectId', e.target.value)}>
            {form.projectId && !projects.some(p => p.projectId === form.projectId) && (
              <option value={form.projectId}>{form.projectId}</option>
            )}
            <option value="">Select a project...</option>
            {projects.map(p => <option key={p.projectId} value={p.projectId}>{p.projectId}{p.name !== p.projectId ? ` (${p.name})` : ''}</option>)}
          </Select>
        ) : (
          <Input mono value={form.projectId} onChange={(e) => updateField('projectId', e.target.value)} placeholder="my-gcp-project" />
        )}
      </div>

      <div>
        <Label>Cluster location</Label>
        <Select mono value={form.clusterZone} onChange={(e) => updateField('clusterZone', e.target.value)}>
          {form.clusterZone && (!regions || !regions.includes(form.clusterZone)) && (
            <option value={form.clusterZone}>{form.clusterZone}</option>
          )}
          <option value="">Select a region...</option>
          {(regions ?? []).map(r => <option key={r} value={r}>{r}</option>)}
        </Select>
      </div>

      <div>
        <Label>Disk zone</Label>
        <Select mono value={form.diskZone} onChange={(e) => updateField('diskZone', e.target.value)}>
          {form.diskZone && (!zones || !zones.includes(form.diskZone)) && (
            <option value={form.diskZone}>{form.diskZone}</option>
          )}
          <option value="">Select a zone...</option>
          {(zones ?? []).map(z => <option key={z} value={z}>{z}</option>)}
        </Select>
        <p className="text-xs text-gray-400 italic mt-1">Location and zone only apply when creating new clusters for teams.</p>
      </div>

      <div>
        <Label>Gateway mode</Label>
        <Select mono value={form.gatewayMode} onChange={(e) => updateField('gatewayMode', e.target.value)}>
          <option value="port-forward">Port-forward (no domain)</option>
          <option value="ingress">Ingress (domain + IAP)</option>
        </Select>
      </div>

      {form.gatewayMode === 'ingress' && (
        <div>
          <Label>Base domain</Label>
          <Input mono value={form.domain} onChange={(e) => updateField('domain', e.target.value)} placeholder="example.com" />
        </div>
      )}

      {formError && (
        <div className="flex items-center gap-2 text-xs text-red-600">
          <AlertCircle className="w-3.5 h-3.5" />
          {formError}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button variant="primary" size="sm" onClick={() => void handleSave()} disabled={saveConfig.isPending}>
          {saveConfig.isPending ? 'Saving...' : saved ? 'Saved' : 'Save'}
        </Button>
      </div>
    </div>
  )
}

export function GkeHelpPanel() {
  return (
    <div className="space-y-5">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Guide</p>
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
  )
}
