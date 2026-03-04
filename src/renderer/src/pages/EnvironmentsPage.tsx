// Environments page with inline GKE form, auto-slug, OAuth validation, and side help panel
// FEATURE: Deployment environment management with dense no-dialog inline layout
import { useState } from 'react'
import { useEnvironments, useSaveEnvironment, useDeleteEnvironment } from '../hooks/useEnvironments'
import type { EnvironmentRecord } from '../../../shared/types'

const inputCls = 'bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-[11px] text-gray-200 focus:outline-none focus:border-blue-600 w-full font-mono'
const labelCls = 'text-[10px] text-gray-500 block mb-0.5'

const GKE_SLUG = 'goog-gke'
const GKE_NAME = 'Google Kubernetes Engine'

interface GkeForm { projectId: string; clusterName: string; clusterZone: string; diskZone: string; clientId: string; clientSecret: string }
const emptyGke = (): GkeForm => ({ projectId: '', clusterName: '', clusterZone: 'us-central1', diskZone: 'us-central1-a', clientId: '', clientSecret: '' })

function fromRecord(env: EnvironmentRecord): GkeForm {
  const c = env.config as { projectId?: string; clusterName?: string; clusterZone?: string; diskZone?: string; clientId?: string; clientSecret?: string }
  return { projectId: c.projectId ?? '', clusterName: c.clusterName ?? '', clusterZone: c.clusterZone ?? 'us-central1', diskZone: c.diskZone ?? 'us-central1-a', clientId: c.clientId ?? '', clientSecret: c.clientSecret ?? '' }
}

function validateForm(form: GkeForm): string | null {
  if (!form.projectId.trim()) return 'GCP project ID is required'
  if (!form.clusterName.trim()) return 'Cluster name is required'
  if (!form.clientId.trim()) return 'OAuth client ID is required'
  if (!form.clientId.includes('.apps.googleusercontent.com')) return 'OAuth client ID must end with .apps.googleusercontent.com'
  if (!form.clientSecret.trim()) return 'OAuth client secret is required'
  return null
}

export function EnvironmentsPage() {
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
      slug: GKE_SLUG,
      type: 'gke',
      name: GKE_NAME,
      config: { projectId: form.projectId, clusterName: form.clusterName, clusterZone: form.clusterZone, diskZone: form.diskZone || undefined, clientId: form.clientId, clientSecret: form.clientSecret },
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
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-gray-700/60 flex items-center justify-between shrink-0">
        <span className="text-[12px] font-medium text-gray-300">Deployment Environments</span>
        {!gkeExists && !form && (
          <button onClick={openForm} className="text-[10px] text-blue-500 hover:text-blue-400">+ add GKE</button>
        )}
        {form && (
          <button onClick={() => setForm(null)} className="text-[10px] text-gray-500 hover:text-gray-400">Cancel</button>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: form + list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 min-w-0">
          {form && (
            <div className="border border-blue-700/50 bg-gray-800/50 rounded p-2.5 space-y-1.5">
              <p className="text-[10px] text-gray-500 font-mono">{GKE_SLUG} · {GKE_NAME}</p>
              {field('projectId', 'GCP project ID', 'my-gcp-project')}
              <div className="grid grid-cols-3 gap-1.5">
                {field('clusterName', 'cluster name', 'coordina-cluster')}
                {field('clusterZone', 'cluster location', 'us-central1')}
                {field('diskZone', 'disk zone', 'us-central1-a')}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {field('clientId', 'OAuth client ID', '0123456789-abc.apps.googleusercontent.com')}
                {field('clientSecret', 'OAuth client secret', '', 'password')}
              </div>
              {formError && (
                <p className="text-[10px] text-red-400">{formError}</p>
              )}
              <button
                onClick={handleSave}
                disabled={saveEnv.isPending || authStatus === 'authing'}
                className="text-[10px] px-3 py-0.5 bg-blue-700 hover:bg-blue-600 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded"
              >
                {saveEnv.isPending ? 'Saving…' : authStatus === 'authing' ? '⟳ Signing in…' : 'Save & Sign in with Google'}
              </button>
            </div>
          )}

          {authStatus === 'done' && !form && (
            <p className="text-[10px] text-green-400">✓ Signed in with Google</p>
          )}
          {authStatus === 'error' && !form && (
            <p className="text-[10px] text-red-400">Sign-in failed{authError ? `: ${authError}` : ''}. Use Re-auth to try again.</p>
          )}

          {isLoading && <p className="text-[11px] text-gray-500">Loading…</p>}
          {!isLoading && !environments?.length && !form && (
            <p className="text-[11px] text-gray-600 py-6 text-center">No environments. Add GKE to enable deployment.</p>
          )}

          {environments?.map(env => (
            <div key={env.slug} className="flex items-center justify-between px-2.5 py-1.5 bg-gray-800/40 border border-gray-700/60 rounded group">
              <div className="min-w-0">
                <span className="text-[11px] text-gray-200">{env.name}</span>
                <span className="text-[10px] text-gray-600 font-mono ml-2">{env.slug}</span>
                {authStatus === 'done' && <span className="text-[10px] text-green-500 ml-2">✓ authenticated</span>}
                {(env.config as { projectId?: string }).projectId && (
                  <span className="text-[10px] text-gray-600 font-mono ml-2">{(env.config as { projectId: string }).projectId}</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={openForm} className="text-[10px] text-gray-500 hover:text-blue-400">Edit</button>
                <button
                  onClick={handleAuth}
                  disabled={authStatus === 'authing'}
                  className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${authStatus === 'error' ? 'text-red-400 hover:text-red-300' : 'text-gray-600 hover:text-blue-400 hover:bg-blue-900/30'}`}
                >
                  {authStatus === 'authing' ? '⟳' : authStatus === 'error' ? '↻ Re-auth' : '↻ Re-auth'}
                </button>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  {deleteTarget === env.slug ? (
                    <>
                      <button onClick={() => { deleteEnv.mutate(env.slug); setDeleteTarget(null) }} className="text-[10px] px-1.5 py-0.5 bg-red-800 hover:bg-red-700 text-red-200 rounded mr-1">Confirm</button>
                      <button onClick={() => setDeleteTarget(null)} className="text-[10px] px-1.5 py-0.5 bg-gray-700 text-gray-400 rounded">Cancel</button>
                    </>
                  ) : (
                    <button onClick={() => setDeleteTarget(env.slug)} className="text-[10px] text-gray-600 hover:text-red-500">Delete</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Right: help panel */}
        {form && (
          <div className="w-64 shrink-0 border-l border-gray-700/60 overflow-y-auto p-3 space-y-3 bg-gray-900/50">
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Setup Guide</p>

            <section className="space-y-1">
              <p className="text-[10px] font-medium text-gray-300">GCP Project ID</p>
              <p className="text-[10px] text-gray-500 leading-relaxed">Find this on the GCP Console home page, shown below the project name.</p>
              <a href="https://console.cloud.google.com/home/dashboard" target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 hover:text-blue-400 underline block truncate">
                console.cloud.google.com/home
              </a>
            </section>

            <section className="space-y-1">
              <p className="text-[10px] font-medium text-gray-300">Cluster Name &amp; Zone</p>
              <p className="text-[10px] text-gray-500 leading-relaxed">Go to Kubernetes Engine → Clusters. Copy the cluster name and location (e.g. <span className="font-mono">us-central1-a</span>).</p>
              <a href="https://console.cloud.google.com/kubernetes/list" target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 hover:text-blue-400 underline block truncate">
                console.cloud.google.com/kubernetes
              </a>
            </section>

            <section className="space-y-1">
              <p className="text-[10px] font-medium text-gray-300">OAuth Client ID &amp; Secret</p>
              <p className="text-[10px] text-gray-500 leading-relaxed">Go to APIs &amp; Services → Credentials → Create Credentials → OAuth client ID. Choose <span className="font-mono">Desktop app</span> as the type. The client ID ends with <span className="font-mono">.apps.googleusercontent.com</span>.</p>
              <p className="text-[10px] text-gray-500 leading-relaxed">Under <span className="font-mono text-gray-400">Authorized redirect URIs</span>, add <span className="font-mono text-gray-400">http://localhost</span>.</p>
              <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 hover:text-blue-400 underline block truncate">
                console.cloud.google.com/apis/credentials
              </a>
            </section>

            <section className="space-y-1">
              <p className="text-[10px] font-medium text-gray-300">Required APIs</p>
              <p className="text-[10px] text-gray-500 leading-relaxed">Enable these APIs in your project:</p>
              <ul className="space-y-0.5">
                <li className="text-[10px] font-mono text-gray-500">container.googleapis.com</li>
                <li className="text-[10px] font-mono text-gray-500">compute.googleapis.com</li>
              </ul>
              <a href="https://console.cloud.google.com/apis/library" target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 hover:text-blue-400 underline block truncate">
                console.cloud.google.com/apis/library
              </a>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
