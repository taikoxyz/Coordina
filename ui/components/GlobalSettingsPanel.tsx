'use client'
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { api } from '@/lib/api'
import HelpPanel from '@/components/HelpPanel'

const BOOTSTRAP_SA_STEPS = [
  {
    title: 'Open Service Accounts',
    text: 'Go to https://console.cloud.google.com → IAM & Admin → Service Accounts. Select (or create) a project to host the bootstrap SA.',
  },
  {
    title: 'Create Service Account',
    text: 'Click "+ Create Service Account". Enter a name (e.g. coordina-bootstrap) and click "Create and continue".',
  },
  {
    title: 'Grant required roles',
    text: 'Add these four roles: Billing Account User, Project Creator, Service Account Admin, Service Usage Admin. Click "Continue → Done".',
  },
  {
    title: 'Create a JSON key',
    text: 'Click the new SA in the list → Keys tab → Add Key → Create new key → JSON → Create. A .json file downloads automatically.',
  },
  {
    title: 'Paste the key',
    text: 'Open the downloaded .json file in a text editor and paste its entire contents into this field.',
  },
]

type Props = { onClose: () => void }

export default function GlobalSettingsPanel({ onClose }: Props) {
  const [form, setForm] = useState({
    gcp_org_id: '',
    gcp_billing_account: '',
    bootstrap_sa_key: '',
  })
  const [hasKey, setHasKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)

  useEffect(() => {
    api.getGlobalSettings()
      .then((s) => {
        setForm((p) => ({
          ...p,
          gcp_org_id: s.gcp_org_id,
          gcp_billing_account: s.gcp_billing_account,
        }))
        setHasKey(s.has_bootstrap_sa_key)
      })
      .catch(() => {})
  }, [])

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
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
            title="How to get your Bootstrap SA Key"
            steps={BOOTSTRAP_SA_STEPS}
            onClose={() => setHelpOpen(false)}
          />
        )}

        {/* Settings panel — right */}
        <div
          className="flex flex-col h-full w-96 shadow-2xl overflow-y-auto"
          style={{ background: '#141414', borderLeft: '1px solid #2a2a2a' }}
        >
          <div
            className="flex items-center justify-between px-5 py-4 shrink-0"
            style={{ borderBottom: '1px solid #2a2a2a' }}
          >
            <h3 className="text-white font-semibold">Global Settings</h3>
            <button onClick={onClose} className="p-1 rounded hover:bg-white/10 transition-colors">
              <X size={16} style={{ color: '#666' }} />
            </button>
          </div>

          <div className="flex-1 px-5 py-5 space-y-5">
            <div>
              <h4 className="text-sm font-medium text-white/80 mb-3">GCP Bootstrap Credentials</h4>
              <p className="text-xs mb-4" style={{ color: '#666' }}>
                Used to auto-provision a GCP project for each team. Entered once; shared across all teams.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs mb-1" style={{ color: '#888' }}>
                    GCP Organization ID
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
                  <label className="block text-xs mb-1" style={{ color: '#888' }}>
                    GCP Billing Account ID
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
                  <label className="flex items-center gap-1.5 text-xs mb-1 flex-wrap" style={{ color: '#888' }}>
                    Bootstrap SA Key (JSON)
                    <button
                      type="button"
                      onClick={() => setHelpOpen((v) => !v)}
                      className="w-4 h-4 rounded-full inline-flex items-center justify-center text-xs font-bold transition-colors shrink-0"
                      style={{ background: helpOpen ? '#2563eb' : '#2a2a2a', color: helpOpen ? '#fff' : '#666' }}
                      aria-label="Help"
                    >
                      ?
                    </button>
                    {hasKey && <span className="text-green-500">✓ configured</span>}
                  </label>
                  <textarea
                    className="w-full px-3 py-2 rounded text-xs text-white outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                    style={{ background: '#111', border: '1px solid #333', height: 100 }}
                    placeholder={hasKey ? '(leave blank to keep existing key)' : '{"type":"service_account",...}'}
                    value={form.bootstrap_sa_key}
                    onChange={(e) => setForm((p) => ({ ...p, bootstrap_sa_key: e.target.value }))}
                  />
                </div>
              </div>

              {testResult && (
                <div
                  className="mt-3 rounded-lg px-4 py-2.5 text-sm"
                  style={{
                    background: testResult.ok ? '#0a2a0a' : '#2a0a0a',
                    color: testResult.ok ? '#4ade80' : '#f87171',
                    border: `1px solid ${testResult.ok ? '#1e4a1e' : '#4a1e1e'}`,
                  }}
                >
                  {testResult.ok ? '✓' : '✗'} {testResult.message}
                </div>
              )}

              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleTest}
                  disabled={testing}
                  className="flex-1 py-2 rounded text-sm transition-colors disabled:opacity-40"
                  style={{ color: '#aaa', border: '1px solid #333' }}
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
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
