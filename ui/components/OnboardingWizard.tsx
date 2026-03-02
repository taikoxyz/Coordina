'use client'
import { useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import HelpPopover from '@/components/HelpPopover'

const WORKSPACE_AUTH_STEPS = [
  {
    title: 'What this grants',
    text: 'Workspace auth gives your AI agents access to Google Drive, Calendar, Gmail, and Admin SDK. Used so agents can read/write files, schedule meetings, and send emails on your behalf.',
  },
  {
    title: 'Required Google Workspace role',
    text: 'You must be a Google Workspace admin (or domain super-admin) for Admin SDK scopes to work. Drive, Calendar, and Gmail access only requires a regular Workspace account.',
  },
  {
    title: 'Scopes requested',
    text: 'admin.directory.user, admin.directory.group, drive, calendar, gmail.modify. You can revoke this at any time from https://myaccount.google.com/permissions',
  },
]

type GCPStatus = {
  connected: boolean
  email: string
  sa_email: string
  sa_created: boolean
  provisioning_status: string
  org_id: string
  billing_account: string
  oauth_configured: boolean
}

type WSStatus = { connected: boolean; email: string }

type Props = { onComplete: () => void }

export default function OnboardingWizard({ onComplete }: Props) {
  const [step, setStep] = useState(0)
  const [gcpStatus, setGCPStatus] = useState<GCPStatus | null>(null)
  const [wsStatus, setWSStatus] = useState<WSStatus | null>(null)
  const [gcpPolling, setGCPPolling] = useState(false)
  const [wsPolling, setWSPolling] = useState(false)

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

  // Manual SA key fallback
  const [showManual, setShowManual] = useState(false)
  const [manualForm, setManualForm] = useState({ gcp_org_id: '', gcp_billing_account: '', bootstrap_sa_key: '' })
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const gcpPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const wsPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
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
      setWSGCloudURL('')
      setWSGCloudCode('')
    } finally {
      setWSGCloudSubmitting(false)
    }
  }

  async function handleManualTest() {
    setTesting(true)
    setTestResult(null)
    try {
      await api.saveGlobalSettings(manualForm)
      const result = await api.testGlobalSettings()
      setTestResult(result)
    } catch (err) {
      setTestResult({ ok: false, message: err instanceof Error ? err.message : 'Test failed' })
    } finally {
      setTesting(false)
    }
  }

  async function handleManualSave() {
    setSaving(true)
    try {
      await api.saveGlobalSettings(manualForm)
      const s = await api.getGCPAuthStatus()
      setGCPStatus(s)
    } catch { /* ignore */ }
    setSaving(false)
  }

  async function handleFinish() {
    setSaving(true)
    try { onComplete() } finally { setSaving(false) }
  }

  const steps = ['Welcome', 'Connect GCP', 'Connect Workspace', 'Done']
  const gcpDone = gcpStatus?.connected && gcpStatus?.sa_created
  const gcpConnectedNotDone = gcpStatus?.connected && !gcpStatus?.sa_created
  const provStatus = gcpStatus?.provisioning_status ?? ''

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.9)' }}
    >
      <div
        className="w-[540px] rounded-xl shadow-2xl"
        style={{ background: 'var(--c-bg-modal)', border: '1px solid var(--c-border-strong)' }}
      >
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 pt-6 pb-4">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors',
                  i === step ? 'bg-blue-600 text-white' : i < step ? 'bg-green-600 text-white' : 'text-gray-600',
                )}
                style={i > step ? { background: 'var(--c-bg-elevated)' } : undefined}
              >
                {i < step ? '✓' : i + 1}
              </div>
              {i < steps.length - 1 && (
                <div className="w-8 h-px" style={{ background: i < step ? '#16a34a' : 'var(--c-border-strong)' }} />
              )}
            </div>
          ))}
        </div>

        <div className="px-8 pb-8">
          {/* Step 0 — Welcome */}
          {step === 0 && (
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--c-text-primary)' }}>Welcome to Coordina</h2>
              <p className="text-sm mb-2" style={{ color: 'var(--c-text-secondary)' }}>
                Coordina lets you create and manage AI agent teams powered by ZeroClaw.
              </p>
              <p className="text-sm mb-6" style={{ color: 'var(--c-text-secondary)' }}>
                Before creating your first team, connect your Google accounts. This enables automatic
                GCP project provisioning and grants your agents access to Google Workspace.
              </p>
              <button
                onClick={() => setStep(1)}
                className="px-6 py-2.5 rounded-lg text-sm font-medium text-white transition-colors"
                style={{ background: '#2563eb' }}
              >
                Get Started →
              </button>
            </div>
          )}

          {/* Step 1 — Connect GCP */}
          {step === 1 && (
            <div>
              <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--c-text-primary)' }}>Connect Google Cloud</h2>
              <p className="text-sm mb-5" style={{ color: 'var(--c-text-muted)' }}>
                Sign in with a Google account that has GCP Organization access. Coordina will
                auto-create a <code className="text-xs px-1 py-0.5 rounded" style={{ background: 'var(--c-bg-elevated)' }}>coordina-service-account</code> with the required IAM roles.
              </p>

              {!gcpStatus?.connected ? (
                gcpStatus && !gcpStatus.oauth_configured ? (
                  <div className="mb-4 rounded-lg px-4 py-3 text-sm space-y-3" style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border)' }}>
                    {gcloudError && <p className="text-xs text-red-400">{gcloudError}</p>}
                    {!gcloudURL ? (
                      <button
                        onClick={startGCloudAuth}
                        className="w-full py-2.5 rounded text-sm font-medium text-white flex items-center justify-center gap-2"
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
                          className="w-full py-2.5 rounded text-sm font-medium text-white disabled:opacity-50"
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
                  disabled={gcpPolling}
                  className="w-full py-3 rounded-lg text-sm font-medium text-white mb-4 flex items-center justify-center gap-2 disabled:opacity-60"
                  style={{ background: '#2563eb' }}
                >
                  {gcpPolling ? (
                    <><span className="animate-spin">⟳</span> Waiting for authentication…</>
                  ) : (
                    '🔗 Connect Google Account'
                  )}
                </button>
                )
              ) : (
                <div className="mb-4 rounded-lg px-4 py-3 text-sm" style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border)' }}>
                  <p className="text-green-400 font-medium">✓ Connected as {gcpStatus.email}</p>
                  {gcpStatus.sa_created ? (
                    <p className="text-xs mt-1" style={{ color: 'var(--c-text-muted)' }}>
                      ✓ coordina-service-account created
                      {gcpStatus.org_id && <> · Org: {gcpStatus.org_id}</>}
                      {gcpStatus.billing_account && <> · Billing: {gcpStatus.billing_account}</>}
                    </p>
                  ) : provStatus === 'running' ? (
                    <p className="text-xs mt-1 text-yellow-400">⟳ Provisioning service account…</p>
                  ) : provStatus.startsWith('error') ? (
                    <p className="text-xs mt-1 text-red-400">✗ {provStatus}</p>
                  ) : (
                    <p className="text-xs mt-1" style={{ color: 'var(--c-text-muted)' }}>Checking provisioning status…</p>
                  )}
                  <button
                    onClick={startGCPAuth}
                    className="mt-2 text-xs underline"
                    style={{ color: 'var(--c-text-muted)' }}
                  >
                    Re-authenticate
                  </button>
                </div>
              )}

              {/* Manual SA key fallback */}
              <button
                onClick={() => setShowManual((v) => !v)}
                className="text-xs underline mb-3"
                style={{ color: 'var(--c-text-faint)' }}
              >
                {showManual ? 'Hide' : 'Use service account key manually (advanced)'}
              </button>

              {showManual && (
                <div className="space-y-3 mb-4">
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: 'var(--c-text-secondary)' }}>GCP Organization ID</label>
                    <input
                      className="w-full px-3 py-2 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500"
                      style={{ background: 'var(--c-bg-base)', border: '1px solid var(--c-border-strong)', color: 'var(--c-text-primary)' }}
                      placeholder="123456789"
                      value={manualForm.gcp_org_id}
                      onChange={(e) => setManualForm((p) => ({ ...p, gcp_org_id: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: 'var(--c-text-secondary)' }}>GCP Billing Account ID</label>
                    <input
                      className="w-full px-3 py-2 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500"
                      style={{ background: 'var(--c-bg-base)', border: '1px solid var(--c-border-strong)', color: 'var(--c-text-primary)' }}
                      placeholder="ABCDEF-123456-789012"
                      value={manualForm.gcp_billing_account}
                      onChange={(e) => setManualForm((p) => ({ ...p, gcp_billing_account: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: 'var(--c-text-secondary)' }}>Bootstrap SA Key (JSON)</label>
                    <textarea
                      className="w-full px-3 py-2 rounded text-xs outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                      style={{ background: 'var(--c-bg-base)', border: '1px solid var(--c-border-strong)', height: 90, color: 'var(--c-text-primary)' }}
                      placeholder='{"type":"service_account","project_id":"..."}'
                      value={manualForm.bootstrap_sa_key}
                      onChange={(e) => setManualForm((p) => ({ ...p, bootstrap_sa_key: e.target.value }))}
                    />
                  </div>
                  {testResult && (
                    <div className="rounded px-3 py-2 text-xs" style={{ background: testResult.ok ? '#0a2a0a' : '#2a0a0a', color: testResult.ok ? '#4ade80' : '#f87171', border: `1px solid ${testResult.ok ? '#1e4a1e' : '#4a1e1e'}` }}>
                      {testResult.ok ? '✓' : '✗'} {testResult.message}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={handleManualTest}
                      disabled={testing || !manualForm.bootstrap_sa_key}
                      className="flex-1 py-2 rounded text-xs disabled:opacity-40"
                      style={{ color: 'var(--c-text-secondary)', border: '1px solid var(--c-border-strong)' }}
                    >
                      {testing ? 'Testing…' : 'Test permissions'}
                    </button>
                    <button
                      onClick={handleManualSave}
                      disabled={saving || !manualForm.bootstrap_sa_key}
                      className="flex-1 py-2 rounded text-xs font-medium text-white disabled:opacity-40"
                      style={{ background: '#2563eb' }}
                    >
                      {saving ? 'Saving…' : 'Save key'}
                    </button>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setStep(2)}
                  disabled={!gcpDone && !gcpConnectedNotDone && !gcpStatus?.sa_created}
                  className="flex-1 py-2 rounded text-sm font-medium text-white disabled:opacity-40"
                  style={{ background: '#2563eb' }}
                >
                  Continue →
                </button>
              </div>
            </div>
          )}

          {/* Step 2 — Connect Workspace */}
          {step === 2 && (
            <div>
              <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--c-text-primary)' }}>Connect Google Workspace</h2>
              <p className="text-sm mb-5" style={{ color: 'var(--c-text-muted)' }}>
                Grant your AI agents access to Drive, Calendar, Gmail, and Admin SDK.
                <HelpPopover title="About Workspace access" steps={WORKSPACE_AUTH_STEPS} />
              </p>

              {!wsStatus?.connected ? (
                gcpStatus?.oauth_configured ? (
                  <button
                    onClick={startWSAuth}
                    disabled={wsPolling}
                    className="w-full py-3 rounded-lg text-sm font-medium text-white mb-4 flex items-center justify-center gap-2 disabled:opacity-60"
                    style={{ background: '#2563eb' }}
                  >
                    {wsPolling ? (
                      <><span className="animate-spin">⟳</span> Waiting for authentication…</>
                    ) : (
                      '🔗 Connect Google Workspace'
                    )}
                  </button>
                ) : (
                  <div className="mb-4 rounded-lg px-4 py-3 text-sm space-y-3" style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border)' }}>
                    {wsGcloudError && <p className="text-xs text-red-400">{wsGcloudError}</p>}
                    {!wsGcloudURL ? (
                      <button
                        onClick={startWSGCloudAuth}
                        className="w-full py-2.5 rounded-lg text-sm font-medium text-white flex items-center justify-center gap-2"
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
                          className="w-full py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                          style={{ background: '#1a6b3e' }}
                        >
                          {wsGcloudSubmitting ? 'Verifying…' : 'Submit'}
                        </button>
                      </>
                    )}
                  </div>
                )
              ) : (
                <div className="mb-4 rounded-lg px-4 py-3 text-sm" style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border)' }}>
                  <p className="text-green-400 font-medium">✓ Connected as {wsStatus.email}</p>
                  <button
                    onClick={startWSAuth}
                    className="mt-1 text-xs underline"
                    style={{ color: 'var(--c-text-muted)' }}
                  >
                    Re-authenticate
                  </button>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setStep(3)}
                  className="py-2 px-4 rounded text-xs"
                  style={{ color: 'var(--c-text-muted)', border: '1px solid var(--c-border)' }}
                >
                  Skip for now
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!wsStatus?.connected}
                  className="flex-1 py-2 rounded text-sm font-medium text-white disabled:opacity-40"
                  style={{ background: '#2563eb' }}
                >
                  Continue →
                </button>
              </div>
            </div>
          )}

          {/* Step 3 — Done */}
          {step === 3 && (
            <div className="text-center">
              <div className="text-5xl mb-4">✅</div>
              <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--c-text-primary)' }}>You&apos;re all set!</h2>
              <p className="text-sm mb-2" style={{ color: 'var(--c-text-secondary)' }}>
                {gcpStatus?.connected
                  ? 'GCP credentials configured — a project will be automatically provisioned for each team.'
                  : 'You can configure GCP credentials later in Settings.'}
              </p>
              {wsStatus?.connected && (
                <p className="text-sm mb-4" style={{ color: 'var(--c-text-secondary)' }}>
                  Google Workspace connected — agents can access Drive, Calendar, and Gmail.
                </p>
              )}
              <button
                onClick={handleFinish}
                disabled={saving}
                className="px-6 py-2.5 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
                style={{ background: '#2563eb' }}
              >
                {saving ? 'Saving…' : 'Create my first team →'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
