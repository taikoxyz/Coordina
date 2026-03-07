import { useState } from 'react'
import { useProviders, useSaveProvider, useDeleteProvider } from '../../hooks/useProviders'
import { Trash2, Plus, Check, X, Loader2 } from 'lucide-react'
import type { ProviderRecord } from '../../../../shared/types'

const PROVIDER_TYPES = ['anthropic', 'openai', 'deepseek', 'openrouter', 'ollama']
const PROVIDER_NAMES: Record<string, string> = {
  anthropic: 'Anthropic', openai: 'OpenAI', deepseek: 'DeepSeek', openrouter: 'OpenRouter', ollama: 'Ollama'
}

type KeyStatus = 'idle' | 'checking' | 'valid' | 'error'
interface EditState {
  type: string; credential: string; keyStatus: KeyStatus; keyError: string | null; models: string[]; model: string
}

const toSlug = (type: string, existing: ProviderRecord[]) => {
  const count = existing.filter(p => p.type === type).length
  return count === 0 ? type : `${type}-${count + 1}`
}

const credentialLabel = (type: string) => type === 'ollama' ? 'Base URL' : 'API Key'
const credentialPlaceholder = (type: string) => type === 'ollama' ? 'http://localhost:11434' : 'sk-...'

export function ProvidersSettings() {
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

    const payload = type === 'ollama' ? { type, baseUrl: credential } : { type, apiKey: credential }

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
    <div className="space-y-4 max-w-xl">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Model Providers</h3>
          <p className="text-xs text-gray-500 mt-0.5">Configure LLM providers for your agents.</p>
        </div>
        <button
          onClick={() => {
            setEditing(editing ? null : { type: 'anthropic', credential: '', keyStatus: 'idle', keyError: null, models: [], model: '' })
            setSaveError(null)
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-base font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          {editing ? (
            <>Cancel</>
          ) : (
            <><Plus className="w-3.5 h-3.5" /> Add provider</>
          )}
        </button>
      </div>

      {/* Add provider form */}
      {editing && (
        <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Provider type</label>
            <select
              value={editing.type}
              onChange={e => handleTypeChange(e.target.value)}
              className="w-full rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {PROVIDER_TYPES.map(t => <option key={t} value={t}>{PROVIDER_NAMES[t]}</option>)}
            </select>
            <p className="text-xs text-gray-400 font-mono mt-1">{toSlug(editing.type, providers ?? [])}</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{credentialLabel(editing.type)}</label>
            <div className="flex items-center gap-2">
              <input
                type={editing.type === 'ollama' ? 'text' : 'password'}
                value={editing.credential}
                onChange={e => setEditing({ ...editing, credential: e.target.value, keyStatus: 'idle', keyError: null, models: [], model: '' })}
                onBlur={handleCredentialBlur}
                placeholder={credentialPlaceholder(editing.type)}
                className="flex-1 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-mono text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {editing.keyStatus === 'checking' && <Loader2 className="w-4 h-4 text-gray-400 animate-spin shrink-0" />}
              {editing.keyStatus === 'valid' && <Check className="w-4 h-4 text-green-500 shrink-0" />}
              {editing.keyStatus === 'error' && <X className="w-4 h-4 text-red-500 shrink-0" />}
            </div>
            {editing.keyStatus === 'error' && editing.keyError && (
              <p className="text-xs text-red-600 mt-1">{editing.keyError}</p>
            )}
          </div>

          {editing.keyStatus === 'valid' && editing.models.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Model</label>
              <select
                value={editing.model}
                onChange={e => setEditing({ ...editing, model: e.target.value })}
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {editing.models.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          )}

          {saveError && <p className="text-xs text-red-600">{saveError}</p>}

          <button
            onClick={handleSave}
            disabled={editing.keyStatus !== 'valid' || !editing.model || saveProvider.isPending}
            className="px-4 py-1.5 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saveProvider.isPending ? 'Saving...' : 'Save provider'}
          </button>
        </div>
      )}

      {/* Provider list */}
      {isLoading && <p className="text-sm text-gray-400">Loading...</p>}
      {!isLoading && !providers?.length && !editing && (
        <div className="rounded-lg border border-dashed border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-500">No providers configured. Add one to deploy agents.</p>
        </div>
      )}

      <div className="space-y-2">
        {providers?.map(p => (
          <div key={p.slug} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 group">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex items-center justify-center w-8 h-8 rounded-md bg-gray-100 text-xs font-semibold text-gray-600 uppercase shrink-0">
                {p.type.slice(0, 2)}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900">{p.name}</div>
                <div className="text-xs text-gray-400 font-mono truncate">
                  {p.model}
                  {p.maskedApiKey && <span className="ml-2">{p.maskedApiKey}</span>}
                </div>
              </div>
            </div>
            <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              {deleteTarget === p.slug ? (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => { deleteProvider.mutate(p.slug); setDeleteTarget(null) }}
                    className="px-2.5 py-1 text-base font-medium rounded-md bg-red-600 text-white hover:bg-red-700"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setDeleteTarget(null)}
                    className="px-2.5 py-1 text-base font-medium rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setDeleteTarget(p.slug)}
                  className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
