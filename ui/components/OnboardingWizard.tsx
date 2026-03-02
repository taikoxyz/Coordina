'use client'
import { useState } from 'react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

type Props = { onComplete: () => void }

export default function OnboardingWizard({ onComplete }: Props) {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({
    gcp_org_id: '',
    gcp_billing_account: '',
    bootstrap_sa_key: '',
  })
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      await api.saveGlobalSettings(form)
      const result = await api.testGlobalSettings()
      setTestResult(result)
    } catch (err) {
      setTestResult({ ok: false, message: err instanceof Error ? err.message : 'Test failed' })
    } finally {
      setTesting(false)
    }
  }

  async function handleFinish() {
    setSaving(true)
    try {
      await api.saveGlobalSettings(form)
      onComplete()
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  const steps = ['Welcome', 'GCP Setup', 'Done']

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.9)' }}
    >
      <div
        className="w-[520px] rounded-xl shadow-2xl"
        style={{ background: '#1a1a1a', border: '1px solid #333' }}
      >
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 pt-6 pb-4">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors',
                  i === step
                    ? 'bg-blue-600 text-white'
                    : i < step
                    ? 'bg-green-600 text-white'
                    : 'text-gray-600',
                )}
                style={i > step ? { background: '#2a2a2a' } : undefined}
              >
                {i < step ? '✓' : i + 1}
              </div>
              {i < steps.length - 1 && (
                <div
                  className="w-8 h-px"
                  style={{ background: i < step ? '#16a34a' : '#333' }}
                />
              )}
            </div>
          ))}
        </div>

        <div className="px-8 pb-8">
          {step === 0 && (
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white mb-3">Welcome to ClawTeam</h2>
              <p className="text-sm mb-2" style={{ color: '#999' }}>
                ClawTeam lets you create and manage AI agent teams powered by ZeroClaw.
              </p>
              <p className="text-sm mb-6" style={{ color: '#999' }}>
                Before creating your first team, you need to configure your GCP bootstrap credentials.
                This enables automatic project provisioning for each team.
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

          {step === 1 && (
            <div>
              <h2 className="text-xl font-bold text-white mb-1">GCP Setup</h2>
              <p className="text-sm mb-5" style={{ color: '#777' }}>
                Configure your Google Cloud bootstrap credentials. These are stored securely and used
                to auto-provision a GCP project for each team you create.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs mb-1 font-medium" style={{ color: '#888' }}>
                    GCP Organization ID *
                  </label>
                  <input
                    className="w-full px-3 py-2 rounded text-sm text-white outline-none focus:ring-1 focus:ring-blue-500"
                    style={{ background: '#111', border: '1px solid #333' }}
                    placeholder="123456789"
                    value={form.gcp_org_id}
                    onChange={(e) => setForm((p) => ({ ...p, gcp_org_id: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1 font-medium" style={{ color: '#888' }}>
                    GCP Billing Account ID *
                  </label>
                  <input
                    className="w-full px-3 py-2 rounded text-sm text-white outline-none focus:ring-1 focus:ring-blue-500"
                    style={{ background: '#111', border: '1px solid #333' }}
                    placeholder="ABCDEF-123456-789012"
                    value={form.gcp_billing_account}
                    onChange={(e) => setForm((p) => ({ ...p, gcp_billing_account: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1 font-medium" style={{ color: '#888' }}>
                    Bootstrap Service Account Key (JSON) *
                  </label>
                  <textarea
                    className="w-full px-3 py-2 rounded text-xs text-white outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                    style={{ background: '#111', border: '1px solid #333', height: 120 }}
                    placeholder='{"type":"service_account","project_id":"...","private_key":"..."}'
                    value={form.bootstrap_sa_key}
                    onChange={(e) => setForm((p) => ({ ...p, bootstrap_sa_key: e.target.value }))}
                  />
                  <p className="text-xs mt-1" style={{ color: '#555' }}>
                    Needs: resourcemanager.projects.create, billing.resourceAssociations.create,
                    iam.serviceAccountAdmin, serviceusage.services.enable
                  </p>
                </div>

                {testResult && (
                  <div
                    className="rounded-lg px-4 py-2.5 text-sm"
                    style={{
                      background: testResult.ok ? '#0a2a0a' : '#2a0a0a',
                      color: testResult.ok ? '#4ade80' : '#f87171',
                      border: `1px solid ${testResult.ok ? '#1e4a1e' : '#4a1e1e'}`,
                    }}
                  >
                    {testResult.ok ? '✓' : '✗'} {testResult.message}
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleTest}
                    disabled={testing || !form.bootstrap_sa_key}
                    className="flex-1 py-2 rounded text-sm transition-colors disabled:opacity-40"
                    style={{ color: '#aaa', border: '1px solid #333' }}
                  >
                    {testing ? 'Testing…' : 'Test permissions'}
                  </button>
                  <button
                    onClick={() => setStep(2)}
                    disabled={
                      !form.gcp_org_id ||
                      !form.gcp_billing_account ||
                      !form.bootstrap_sa_key ||
                      testResult?.ok === false
                    }
                    className="flex-1 py-2 rounded text-sm font-medium text-white transition-colors disabled:opacity-40"
                    style={{ background: '#2563eb' }}
                  >
                    Continue →
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="text-center">
              <div className="text-5xl mb-4">✅</div>
              <h2 className="text-2xl font-bold text-white mb-3">You&apos;re all set!</h2>
              <p className="text-sm mb-6" style={{ color: '#999' }}>
                Your GCP bootstrap credentials are configured. You can now create your first team —
                a GCP project will be automatically provisioned for each team.
              </p>
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
