// Providers page with inline editing panel replacing modal dialogs
// FEATURE: Model provider management page with no-dialog dense inline layout
import { useState } from 'react'
import { useProviders, useSaveProvider, useDeleteProvider } from '../hooks/useProviders'
import type { ProviderRecord } from '../../../shared/types'

const PROVIDER_TYPES = ['anthropic', 'openai', 'deepseek', 'openrouter', 'ollama']
const PROVIDER_NAMES: Record<string, string> = { anthropic: 'Anthropic', openai: 'OpenAI', deepseek: 'DeepSeek', openrouter: 'OpenRouter', ollama: 'Ollama' }
const inputCls = 'bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-[11px] text-gray-200 focus:outline-none focus:border-blue-600 w-full font-mono'
const labelCls = 'text-[10px] text-gray-500 block mb-0.5'

type KeyStatus = 'idle' | 'checking' | 'valid' | 'error'
interface EditState { type: string; credential: string; keyStatus: KeyStatus; keyError: string | null; models: string[]; model: string }

const toSlug = (type: string, existing: ProviderRecord[]) => {
  const count = existing.filter(p => p.type === type).length
  return count === 0 ? type : `${type}-${count + 1}`
}

const credentialLabel = (type: string) => type === 'ollama' ? 'base URL' : 'API key'
const credentialPlaceholder = (type: string) => type === 'ollama' ? 'http://localhost:11434' : 'sk-...'
const emptyEdit = (): EditState => ({ type: 'anthropic', credential: '', keyStatus: 'idle', keyError: null, models: [], model: '' })

export function ProvidersPage() {
  const { data: providers, isLoading } = useProviders()
  const saveProvider = useSaveProvider()
  const deleteProvider = useDeleteProvider()

  const [editing, setEditing] = useState<EditState | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const handleCredentialBlur = async () => {
    if (!editing || !editing.credential.trim()) return
    const { type, credential } = editing
    setEditing(e => e ? { ...e, keyStatus: 'checking', keyError: null, models: [], model: '' } : null)

    const payload = type === 'ollama'
      ? { type, baseUrl: credential }
      : { type, apiKey: credential }

    try {
      const result = await window.api.invoke('providers:testKey', payload) as { ok: boolean; models?: string[]; error?: string }
      if (result.ok) {
        const models = result.models ?? []
        setEditing(e => e ? { ...e, keyStatus: 'valid', models, model: models[0] ?? '' } : null)
      } else {
        setEditing(e => e ? { ...e, keyStatus: 'error', keyError: result.error ?? 'Invalid key' } : null)
      }
    } catch (e) {
      setEditing(prev => prev ? { ...prev, keyStatus: 'error', keyError: (e as Error).message } : null)
    }
  }

  const handleTypeChange = (type: string) => {
    setEditing(e => e ? { ...e, type, credential: '', keyStatus: 'idle', keyError: null, models: [], model: '' } : null)
  }

  const handleSave = async () => {
    if (!editing || editing.keyStatus !== 'valid' || !editing.model) return
    const slug = toSlug(editing.type, providers ?? [])
    const name = PROVIDER_NAMES[editing.type] ?? editing.type
    const saveData = editing.type === 'ollama'
      ? { slug, type: editing.type, name, model: editing.model }
      : { slug, type: editing.type, name, model: editing.model, apiKey: editing.credential }
    const result = await saveProvider.mutateAsync(saveData)
    if (result.ok) { setEditing(null); setSaveError(null) }
    else setSaveError(result.errors?.join(', ') ?? 'Save failed')
  }

  return (
    <div className="h-full flex overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-2 max-w-xl">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[12px] font-medium text-gray-300">Model Providers</span>
          <button onClick={() => { setEditing(editing ? null : emptyEdit()); setSaveError(null) }} className="text-[10px] text-blue-500 hover:text-blue-400">
            {editing ? 'Cancel' : '+ add provider'}
          </button>
        </div>

        {editing && (
          <div className="border border-blue-700/50 bg-gray-800/50 rounded p-2.5 space-y-1.5">
            <div>
              <label className={labelCls}>type</label>
              <select value={editing.type} onChange={e => handleTypeChange(e.target.value)} className={inputCls}>
                {PROVIDER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <p className="text-[10px] text-gray-600 font-mono mt-0.5">{toSlug(editing.type, providers ?? [])}</p>
            </div>

            <div>
              <label className={labelCls}>{credentialLabel(editing.type)}</label>
              <div className="flex items-center gap-1.5">
                <input
                  className={inputCls}
                  type={editing.type === 'ollama' ? 'text' : 'password'}
                  value={editing.credential}
                  onChange={e => setEditing({ ...editing, credential: e.target.value, keyStatus: 'idle', keyError: null, models: [], model: '' })}
                  onBlur={handleCredentialBlur}
                  placeholder={credentialPlaceholder(editing.type)}
                />
                {editing.keyStatus === 'checking' && <span className="text-[10px] text-gray-500 shrink-0">Checking…</span>}
                {editing.keyStatus === 'valid' && <span className="text-[10px] text-green-500 shrink-0">✓ valid</span>}
                {editing.keyStatus === 'error' && <span className="text-[10px] text-red-400 shrink-0">✗</span>}
              </div>
              {editing.keyStatus === 'error' && editing.keyError && (
                <p className="text-[10px] text-red-400 mt-0.5">{editing.keyError}</p>
              )}
            </div>

            {editing.keyStatus === 'valid' && editing.models.length > 0 && (
              <div>
                <label className={labelCls}>model</label>
                <select value={editing.model} onChange={e => setEditing({ ...editing, model: e.target.value })} className={inputCls}>
                  {editing.models.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            )}

            {saveError && <p className="text-[10px] text-red-400">{saveError}</p>}

            <button
              onClick={handleSave}
              disabled={editing.keyStatus !== 'valid' || !editing.model || saveProvider.isPending}
              className="text-[10px] px-3 py-0.5 bg-blue-700 hover:bg-blue-600 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded"
            >
              {saveProvider.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}

        {isLoading && <p className="text-[11px] text-gray-500">Loading…</p>}
        {!isLoading && !providers?.length && (
          <p className="text-[11px] text-gray-600 py-6 text-center">No providers. Add one to deploy agents.</p>
        )}

        {providers?.map(p => (
          <div key={p.slug} className="flex items-center justify-between px-2.5 py-1.5 bg-gray-800/40 border border-gray-700/60 rounded group">
            <div className="min-w-0">
              <span className="text-[11px] text-gray-200">{p.name}</span>
              <span className="text-[10px] text-gray-600 font-mono ml-2">{p.slug}</span>
              {p.model && <span className="text-[10px] text-gray-500 font-mono ml-2">{p.model}</span>}
              {p.maskedApiKey && <span className="text-[10px] text-gray-600 font-mono ml-2">{p.maskedApiKey}</span>}
            </div>
            <div className="flex gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              {deleteTarget === p.slug ? (
                <>
                  <button onClick={() => { deleteProvider.mutate(p.slug); setDeleteTarget(null) }} className="text-[10px] px-1.5 py-0.5 bg-red-800 hover:bg-red-700 text-red-200 rounded">Confirm</button>
                  <button onClick={() => setDeleteTarget(null)} className="text-[10px] px-1.5 py-0.5 bg-gray-700 text-gray-400 rounded">Cancel</button>
                </>
              ) : (
                <button onClick={() => setDeleteTarget(p.slug)} className="text-[10px] text-gray-600 hover:text-red-500">Delete</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
