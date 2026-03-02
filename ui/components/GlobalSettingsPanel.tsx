'use client'
import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { api } from '@/lib/api'
import HelpPanel from '@/components/HelpPanel'

const GCP_ORG_STEPS = [
  {
    title: 'What is it?',
    text: 'Your GCP Organization ID is a numeric identifier (e.g. 123456789) that represents the root of your Google Cloud resource hierarchy.',
  },
  {
    title: 'Find it in the Console',
    text: 'Go to https://console.cloud.google.com, click the project/org selector at the very top of the page, then switch to the "All" tab. Your organization name appears with its numeric ID below it.',
  },
  {
    title: 'Find it with gcloud',
    text: 'Run: gcloud organizations list — the ID is in the NAME column (numeric part after "organizations/").',
  },
  {
    title: 'No organization?',
    text: 'If you do not have a GCP Organization, you need to create one via Google Workspace or Cloud Identity before using Coordina. See https://cloud.google.com/resource-manager/docs/creating-managing-organization',
  },
]

const GCP_BILLING_STEPS = [
  {
    title: 'What is it?',
    text: 'The Billing Account ID is in the format ABCDEF-123456-789012. It links GCP projects to a payment method.',
  },
  {
    title: 'Find it in the Console',
    text: 'Go to https://console.cloud.google.com/billing — your billing accounts are listed. The ID appears below each account name.',
  },
  {
    title: 'Find it with gcloud',
    text: 'Run: gcloud billing accounts list — the ACCOUNT_ID column shows the ID in XXXXXX-XXXXXX-XXXXXX format.',
  },
  {
    title: 'No billing account?',
    text: 'Create one at https://console.cloud.google.com/billing/create — you will need a credit card. New accounts receive a free trial credit.',
  },
]

const BOOTSTRAP_SA_STEPS = [
  {
    title: 'Create the Service Account',
    text: 'Go to https://console.cloud.google.com → IAM & Admin → Service Accounts. Pick any project to host it. Click "+ Create Service Account", enter a name (e.g. coordina-bootstrap), then click "Create and continue" → "Done". Skip the role step here — roles are granted at different levels below.',
  },
  {
    title: 'Grant org-level roles (Project Creator + Service Usage Admin)',
    text: 'Go to https://console.cloud.google.com/iam-admin/iam and switch the resource picker at the top from a project to your Organization. Click "+ Grant Access", paste the SA email, and add two roles: "Project Creator" and "Service Usage Admin". Save.',
  },
  {
    title: 'Grant billing-level role (Billing Account User)',
    text: 'Go to https://console.cloud.google.com/billing, open your billing account, click "Account Management" in the left menu, then "Add Principal". Paste the SA email and assign the role "Billing Account User". Save.',
  },
  {
    title: 'Create a JSON key',
    text: 'Back in https://console.cloud.google.com/iam-admin/serviceaccounts, click the SA you created → Keys tab → Add Key → Create new key → JSON → Create. A .json file downloads automatically.',
  },
  {
    title: 'Paste the key',
    text: 'Open the downloaded .json file in a text editor and paste its entire contents into this field.',
  },
]

type HelpField = 'org' | 'billing' | 'sa'
const HELP_CONFIG: Record<HelpField, { title: string; steps: { title?: string; text: string }[] }> = {
  org:     { title: 'GCP Organization ID',      steps: GCP_ORG_STEPS },
  billing: { title: 'GCP Billing Account ID',   steps: GCP_BILLING_STEPS },
  sa:      { title: 'How to get your Bootstrap SA Key', steps: BOOTSTRAP_SA_STEPS },
}

type GCPStatus = {
  connected: boolean; email: string; sa_email: string; sa_created: boolean
  provisioning_status: string; org_id: string; billing_account: string
  oauth_configured: boolean
}
type WSStatus = { connected: boolean; email: string }

type Props = { onClose: () => void }

export default function GlobalSettingsPanel({ onClose }: Props) {
  const [form, setForm] = useState({
    gcp_org_id: '',
    gcp_billing_account: '',
    bootstrap_sa_key: '',
  })
  const [hasKey, setHasKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{
    ok: boolean
    message: string
    sa_email?: string
    checks?: Array<{ name: string; level: string; has: boolean }>
  } | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [helpOpen, setHelpOpen] = useState<HelpField | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Auth status
  const [gcpStatus, setGCPStatus] = useState<GCPStatus | null>(null)
  const [wsStatus, setWSStatus] = useState<WSStatus | null>(null)
  const [gcpPolling, setGCPPolling] = useState(false)
  const [wsPolling, setWSPolling] = useState(false)
  const gcpPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const wsPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // gcloud device auth (GCP)
  const [gcloudURL, setGCloudURL] = useState('')
  const [gcloudCode, setGCloudCode] = useState('')
  const [gcloudError, setGCloudError] = useState('')
  const [gcloudSubmitting, setGCloudSubmitting] = useState(false)

  // gcloud ADC auth (Workspace)
  const [wsGcloudURL, setWSGCloudURL] = useState('')
  const [wsGcloudCode, setWSGCloudCode] = useState('')
  const [wsGcloudError, setWSGCloudError] = useState('')
  const [wsGcloudSubmitting, setWSGCloudSubmitting] = useState(false)

  const DRAFT_KEY = 'coordina_settings_draft'

  useEffect(() => {
    const draft = (() => {
      try { return JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null') } catch { return null }
    })()
    api.getGlobalSettings()
      .then((s) => {
        setForm({
          gcp_org_id: draft?.gcp_org_id ?? s.gcp_org_id,
          gcp_billing_account: draft?.gcp_billing_account ?? s.gcp_billing_account,
          bootstrap_sa_key: draft?.bootstrap_sa_key ?? '',
        })
        setHasKey(s.has_bootstrap_sa_key)
      })
      .catch(() => {})
    api.getGCPAuthStatus().then(setGCPStatus).catch(() => {})
    api.getWorkspaceAuthStatus().then(setWSStatus).catch(() => {})
    return () => {
      if (gcpPollRef.current) clearInterval(gcpPollRef.current)
      if (wsPollRef.current) clearInterval(wsPollRef.current)
    }
  }, [])

  async function startGCPAuth() {
    try {
      const { url } = await api.getGCPAuthURL()
      window.open(url, '_blank')
      setGCPPolling(true)
      gcpPollRef.current = setInterval(async () => {
        const s = await api.getGCPAuthStatus().catch(() => null)
        if (s) {
          setGCPStatus(s)
          if (s.connected && s.sa_created) {
            clearInterval(gcpPollRef.current!)
            setGCPPolling(false)
          }
        }
      }, 2000)
    } catch { /* ignore */ }
  }

  async function startGCloudAuth() {
    setGCloudError('')
    try {
      const { url } = await api.gcloudBegin()
      setGCloudURL(url)
    } catch (err) {
      setGCloudError(err instanceof Error ? err.message : 'Failed to start login')
    }
  }

  async function submitGCloudCode() {
    setGCloudSubmitting(true)
    setGCloudError('')
    try {
      await api.gcloudSubmit(gcloudCode)
      setGCloudURL('')
      setGCloudCode('')
      setGCPPolling(true)
      gcpPollRef.current = setInterval(async () => {
        const s = await api.getGCPAuthStatus().catch(() => null)
        if (s) {
          setGCPStatus(s)
          if (s.connected && s.sa_created) {
            clearInterval(gcpPollRef.current!)
            setGCPPolling(false)
          }
        }
      }, 2000)
    } catch (err) {
      setGCloudError(err instanceof Error ? err.message : 'Authentication failed')
      setGCloudURL('')
      setGCloudCode('')
    } finally {
      setGCloudSubmitting(false)
    }
  }

  async function startWSAuth() {
    try {
      const { url } = await api.getWorkspaceAuthURL()
      window.open(url, '_blank')
      setWSPolling(true)
      wsPollRef.current = setInterval(async () => {
        const s = await api.getWorkspaceAuthStatus().catch(() => null)
        if (s) {
          setWSStatus(s)
          if (s.connected) {
            clearInterval(wsPollRef.current!)
            setWSPolling(false)
          }
        }
      }, 2000)
    } catch { /* ignore */ }
  }

  async function startWSGCloudAuth() {
    setWSGCloudError('')
    try {
      const { url } = await api.gcloudADCBegin()
      setWSGCloudURL(url)
    } catch (err) {
      setWSGCloudError(err instanceof Error ? err.message : 'Failed to start login')
    }
  }

  async function submitWSGCloudCode() {
    setWSGCloudSubmitting(true)
    setWSGCloudError('')
    try {
      const { email } = await api.gcloudADCSubmit(wsGcloudCode)
      setWSGCloudURL('')
      setWSGCloudCode('')
      setWSStatus({ connected: true, email })
    } catch (err) {
      setWSGCloudError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setWSGCloudSubmitting(false)
    }
  }

  async function revokeGCP() {
    await api.revokeGCPAuth().catch(() => {})
    api.getGCPAuthStatus().then(setGCPStatus).catch(() => {})
  }

  async function revokeWS() {
    await api.revokeWorkspaceAuth().catch(() => {})
    api.getWorkspaceAuthStatus().then(setWSStatus).catch(() => {})
  }

  function updateForm(patch: Partial<typeof form>) {
    setForm((prev) => {
      const next = { ...prev, ...patch }
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      await api.saveGlobalSettings(form)
      setHasKey(!!form.bootstrap_sa_key || hasKey)
      const result = await api.testGlobalSettings()
      setTestResult(result)
    } catch (err) {
      setTestResult({ ok: false, message: err instanceof Error ? err.message : 'Test failed' })
    } finally {
      setTesting(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    try {
      await api.saveGlobalSettings(form)
      setSaved(true)
      setHasKey(!!form.bootstrap_sa_key || hasKey)
      setTestResult(null)
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...form, bootstrap_sa_key: '' })) } catch { /* ignore */ }
      setTimeout(() => setSaved(false), 3000)
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div className="flex h-full" onClick={(e) => e.stopPropagation()}>
        {/* Docs panel — left */}
        {helpOpen && (
          <HelpPanel
            title={HELP_CONFIG[helpOpen].title}
            steps={HELP_CONFIG[helpOpen].steps}
            onClose={() => setHelpOpen(null)}
          />
        )}

        {/* Settings panel — right */}
        <div
          className="flex flex-col h-full w-96 shadow-2xl overflow-y-auto"
          style={{ background: 'var(--c-bg-panel)', borderLeft: '1px solid var(--c-border-muted)' }}
        >
          <div
            className="flex items-center justify-between px-5 py-4 shrink-0"
            style={{ borderBottom: '1px solid var(--c-border-muted)' }}
          >
            <h3 className="font-semibold" style={{ color: 'var(--c-text-primary)' }}>Global Settings</h3>
            <button onClick={onClose} className="p-1 rounded hover:bg-white/10 transition-colors">
              <X size={16} style={{ color: 'var(--c-text-muted)' }} />
            </button>
          </div>

          <div className="flex-1 px-5 py-5 space-y-5">
            {/* GCP Auth Status */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--c-text-faint)' }}>Google Cloud</h4>
              {gcpStatus?.connected ? (
                <div className="rounded-lg px-3 py-3 text-sm space-y-1" style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border)' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-green-400 text-xs font-medium">● {gcpStatus.email}</span>
                    <button onClick={revokeGCP} className="text-xs hover:text-red-400 transition-colors" style={{ color: 'var(--c-text-faint)' }}>Revoke</button>
                  </div>
                  {gcpStatus.sa_created ? (
                    <p className="text-xs" style={{ color: 'var(--c-text-muted)' }}>
                      ✓ coordina-service-account
                      {gcpStatus.org_id && <> · Org {gcpStatus.org_id}</>}
                      {gcpStatus.billing_account && <> · {gcpStatus.billing_account}</>}
                    </p>
                  ) : gcpStatus.provisioning_status === 'running' ? (
                    <p className="text-xs text-yellow-400">⟳ Provisioning service account…</p>
                  ) : gcpStatus.provisioning_status?.startsWith('error') ? (
                    <p className="text-xs text-red-400">✗ {gcpStatus.provisioning_status}</p>
                  ) : null}
                  <button onClick={startGCPAuth} disabled={gcpPolling} className="text-xs underline disabled:opacity-50" style={{ color: 'var(--c-text-faint)' }}>
                    {gcpPolling ? 'Waiting…' : 'Re-authenticate'}
                  </button>
                </div>
              ) : gcpStatus && !gcpStatus.oauth_configured ? (
                <div className="rounded-lg px-3 py-3 text-sm space-y-2" style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border)' }}>
                  {gcloudError && (
                    <p className="text-xs text-red-400">{gcloudError}</p>
                  )}
                  {!gcloudURL ? (
                    <button
                      onClick={startGCloudAuth}
                      className="w-full py-2 rounded text-sm font-medium text-white flex items-center justify-center gap-2"
                      style={{ background: '#2563eb' }}
                    >
                      🔗 Sign in with Google
                    </button>
                  ) : (
                    <>
                      <p className="text-xs" style={{ color: 'var(--c-text-muted)' }}>Run this command on your local machine (requires gcloud CLI):</p>
                      <div className="flex items-start gap-2">
                        <code className="text-xs flex-1 break-all font-mono p-2 rounded" style={{ background: 'var(--c-bg-base)', color: 'var(--c-text-secondary)' }}>{gcloudURL}</code>
                        <button
                          onClick={() => navigator.clipboard.writeText(gcloudURL)}
                          className="text-xs px-2 py-1 rounded shrink-0 mt-1"
                          style={{ border: '1px solid var(--c-border-strong)', color: 'var(--c-text-muted)' }}
                        >Copy</button>
                      </div>
                      <p className="text-xs" style={{ color: 'var(--c-text-muted)' }}>Then paste the output here:</p>
                      <textarea
                        className="w-full px-3 py-2 rounded text-xs outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                        style={{ background: 'var(--c-bg-base)', border: '1px solid var(--c-border-strong)', color: 'var(--c-text-primary)', height: 80 }}
                        placeholder="Paste the output of the command here"
                        value={gcloudCode}
                        onChange={(e) => setGCloudCode(e.target.value)}
                      />
                      <button
                        onClick={submitGCloudCode}
                        disabled={gcloudSubmitting || !gcloudCode}
                        className="w-full py-2 rounded text-sm font-medium text-white disabled:opacity-50"
                        style={{ background: '#2563eb' }}
                      >
                        {gcloudSubmitting ? 'Verifying…' : 'Submit'}
                      </button>
                    </>
                  )}
                  {gcpPolling && <p className="text-xs text-yellow-400">⟳ Provisioning service account…</p>}
                </div>
              ) : (
                <button
                  onClick={startGCPAuth}
                  disabled={gcpPolling || gcpStatus === null}
                  className="w-full py-2.5 rounded-lg text-sm font-medium text-white flex items-center justify-center gap-2 disabled:opacity-60"
                  style={{ background: '#2563eb' }}
                >
                  {gcpPolling ? <><span className="animate-spin">⟳</span> Waiting…</> : '🔗 Connect Google Account'}
                </button>
              )}
            </div>

            {/* Workspace Auth Status */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--c-text-faint)' }}>Google Workspace</h4>
              {wsStatus?.connected ? (
                <div className="rounded-lg px-3 py-3 text-sm" style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border)' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-green-400 text-xs font-medium">● {wsStatus.email}</span>
                    <button onClick={revokeWS} className="text-xs hover:text-red-400 transition-colors" style={{ color: 'var(--c-text-faint)' }}>Revoke</button>
                  </div>
                  <button onClick={startWSAuth} disabled={wsPolling} className="mt-1 text-xs underline disabled:opacity-50" style={{ color: 'var(--c-text-faint)' }}>
                    {wsPolling ? 'Waiting…' : 'Re-authenticate'}
                  </button>
                </div>
              ) : gcpStatus && !gcpStatus.oauth_configured ? (
                <div className="rounded-lg px-3 py-3 text-sm space-y-2" style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border)' }}>
                  {wsGcloudError && <p className="text-xs text-red-400">{wsGcloudError}</p>}
                  {!wsGcloudURL ? (
                    <button
                      onClick={startWSGCloudAuth}
                      className="w-full py-2 rounded text-sm font-medium text-white flex items-center justify-center gap-2"
                      style={{ background: '#1a6b3e' }}
                    >
                      🔗 Sign in with Google Workspace
                    </button>
                  ) : (
                    <>
                      <p className="text-xs" style={{ color: 'var(--c-text-muted)' }}>Run this command on your local machine (requires gcloud CLI):</p>
                      <div className="flex items-start gap-2">
                        <code className="text-xs flex-1 break-all font-mono p-2 rounded" style={{ background: 'var(--c-bg-base)', color: 'var(--c-text-secondary)' }}>{wsGcloudURL}</code>
                        <button
                          onClick={() => navigator.clipboard.writeText(wsGcloudURL)}
                          className="text-xs px-2 py-1 rounded shrink-0 mt-1"
                          style={{ border: '1px solid var(--c-border-strong)', color: 'var(--c-text-muted)' }}
                        >Copy</button>
                      </div>
                      <p className="text-xs" style={{ color: 'var(--c-text-muted)' }}>Then paste the output here:</p>
                      <textarea
                        className="w-full px-3 py-2 rounded text-xs outline-none focus:ring-1 focus:ring-green-500 font-mono"
                        style={{ background: 'var(--c-bg-base)', border: '1px solid var(--c-border-strong)', color: 'var(--c-text-primary)', height: 80 }}
                        placeholder="Paste the output of the command here"
                        value={wsGcloudCode}
                        onChange={(e) => setWSGCloudCode(e.target.value)}
                      />
                      <button
                        onClick={submitWSGCloudCode}
                        disabled={wsGcloudSubmitting || !wsGcloudCode}
                        className="w-full py-2 rounded text-sm font-medium text-white disabled:opacity-50"
                        style={{ background: '#1a6b3e' }}
                      >
                        {wsGcloudSubmitting ? 'Verifying…' : 'Submit'}
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <button
                  onClick={startWSAuth}
                  disabled={wsPolling || gcpStatus === null}
                  className="w-full py-2.5 rounded-lg text-sm font-medium text-white flex items-center justify-center gap-2 disabled:opacity-60"
                  style={{ background: '#1a6b3e' }}
                >
                  {wsPolling ? <><span className="animate-spin">⟳</span> Waiting…</> : '🔗 Connect Workspace'}
                </button>
              )}
            </div>

            {/* Advanced: manual SA key */}
            <div>
              <button
                onClick={() => setShowAdvanced((v) => !v)}
                className="text-xs underline"
                style={{ color: 'var(--c-text-faint)' }}
              >
                {showAdvanced ? 'Hide' : 'Advanced: manual SA key'}
              </button>
            </div>

            {showAdvanced && <div>
              <h4 className="text-sm font-medium mb-3" style={{ color: 'var(--c-text-secondary)' }}>GCP Bootstrap Credentials</h4>
              <p className="text-xs mb-4" style={{ color: 'var(--c-text-muted)' }}>
                Used to auto-provision a GCP project for each team. Entered once; shared across all teams.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="flex items-center gap-1.5 text-xs mb-1" style={{ color: 'var(--c-text-secondary)' }}>
                    GCP Organization ID
                    <button
                      type="button"
                      onClick={() => setHelpOpen((v) => v === 'org' ? null : 'org')}
                      className="w-4 h-4 rounded-full inline-flex items-center justify-center text-xs font-bold transition-colors shrink-0"
                      style={{ background: helpOpen === 'org' ? '#2563eb' : 'var(--c-bg-elevated)', color: helpOpen === 'org' ? '#fff' : 'var(--c-text-muted)' }}
                      aria-label="Help"
                    >?</button>
                  </label>
                  <input
                    className="w-full px-3 py-2 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500"
                    style={{ background: 'var(--c-bg-base)', border: '1px solid var(--c-border-strong)', color: 'var(--c-text-primary)' }}
                    placeholder="123456789"
                    value={form.gcp_org_id}
                    onChange={(e) => updateForm({ gcp_org_id: e.target.value })}
                  />
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-xs mb-1" style={{ color: 'var(--c-text-secondary)' }}>
                    GCP Billing Account ID
                    <button
                      type="button"
                      onClick={() => setHelpOpen((v) => v === 'billing' ? null : 'billing')}
                      className="w-4 h-4 rounded-full inline-flex items-center justify-center text-xs font-bold transition-colors shrink-0"
                      style={{ background: helpOpen === 'billing' ? '#2563eb' : 'var(--c-bg-elevated)', color: helpOpen === 'billing' ? '#fff' : 'var(--c-text-muted)' }}
                      aria-label="Help"
                    >?</button>
                  </label>
                  <input
                    className="w-full px-3 py-2 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500"
                    style={{ background: 'var(--c-bg-base)', border: '1px solid var(--c-border-strong)', color: 'var(--c-text-primary)' }}
                    placeholder="ABCDEF-123456-789012"
                    value={form.gcp_billing_account}
                    onChange={(e) => updateForm({ gcp_billing_account: e.target.value })}
                  />
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-xs mb-1 flex-wrap" style={{ color: 'var(--c-text-secondary)' }}>
                    Bootstrap SA Key (JSON)
                    <button
                      type="button"
                      onClick={() => setHelpOpen((v) => v === 'sa' ? null : 'sa')}
                      className="w-4 h-4 rounded-full inline-flex items-center justify-center text-xs font-bold transition-colors shrink-0"
                      style={{ background: helpOpen === 'sa' ? '#2563eb' : 'var(--c-bg-elevated)', color: helpOpen === 'sa' ? '#fff' : 'var(--c-text-muted)' }}
                      aria-label="Help"
                    >
                      ?
                    </button>
                    {hasKey && <span className="text-green-500">✓ configured</span>}
                  </label>
                  <textarea
                    className="w-full px-3 py-2 rounded text-xs outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                    style={{ background: 'var(--c-bg-base)', border: '1px solid var(--c-border-strong)', color: 'var(--c-text-primary)', height: 100 }}
                    placeholder={hasKey ? '(leave blank to keep existing key)' : '{"type":"service_account",...}'}
                    value={form.bootstrap_sa_key}
                    onChange={(e) => updateForm({ bootstrap_sa_key: e.target.value })}
                  />
                </div>
              </div>

              {testResult && (
                <div
                  className="mt-3 rounded-lg overflow-hidden text-sm"
                  style={{
                    background: testResult.ok ? '#0a2a0a' : '#1a0a0a',
                    border: `1px solid ${testResult.ok ? '#1e4a1e' : '#3a1a1a'}`,
                  }}
                >
                  <div
                    className="px-4 py-2.5 flex items-start gap-2"
                    style={{ color: testResult.ok ? '#4ade80' : '#f87171' }}
                  >
                    <span className="shrink-0">{testResult.ok ? '✓' : '✗'}</span>
                    <div className="min-w-0">
                      <p>{testResult.message}</p>
                      {testResult.sa_email && (
                        <p className="text-xs mt-0.5 opacity-60">{testResult.sa_email}</p>
                      )}
                    </div>
                  </div>
                  {testResult.checks && testResult.checks.length > 0 && (
                    <div style={{ borderTop: `1px solid ${testResult.ok ? '#1e4a1e' : '#3a1a1a'}` }}>
                      {testResult.checks.map((c) => (
                        <div
                          key={c.name}
                          className="flex items-center gap-2 px-4 py-1.5 text-xs"
                          style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                        >
                          <span style={{ color: c.has ? '#4ade80' : '#f87171' }}>
                            {c.has ? '✓' : '✗'}
                          </span>
                          <span className="flex-1 font-mono" style={{ color: c.has ? 'var(--c-text-secondary)' : '#fca5a5' }}>
                            {c.name}
                          </span>
                          <span className="opacity-40 shrink-0">{c.level}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleTest}
                  disabled={testing}
                  className="flex-1 py-2 rounded text-sm transition-colors disabled:opacity-40"
                  style={{ color: 'var(--c-text-secondary)', border: '1px solid var(--c-border-strong)' }}
                >
                  {testing ? 'Testing…' : 'Test permissions'}
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-2 rounded text-sm font-medium text-white transition-colors disabled:opacity-50"
                  style={{ background: saved ? '#16a34a' : '#2563eb' }}
                >
                  {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
                </button>
              </div>
            </div>}
          </div>
        </div>
      </div>
    </div>
  )
}
