import { useState } from 'react'
import { useProviders, useSaveProvider, useDeleteProvider, useOAuthProvider } from '../../hooks/useProviders'
import { Trash2, Plus, Check, X, Loader2, RefreshCw } from 'lucide-react'
import type { ProviderRecord } from '../../../../shared/types'
import { Button, Input, Select, Label } from '../ui'

const PROVIDER_TYPES = ['anthropic', 'openai', 'deepseek', 'openrouter', 'minimax', 'ollama']
const PROVIDER_NAMES: Record<string, string> = {
  anthropic: 'Anthropic', openai: 'OpenAI', deepseek: 'DeepSeek', openrouter: 'OpenRouter', minimax: 'MiniMax', ollama: 'Ollama'
}
const OAUTH_PROVIDERS = new Set(['anthropic', 'openai', 'deepseek', 'openrouter', 'minimax'])

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
  const oauthProvider = useOAuthProvider()

  const [editing, setEditing] = useState<EditState | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [reconnectTarget, setReconnectTarget] = useState<string | null>(null)

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

  const handleOAuthConnect = async () => {
    if (!editing) return
    const slug = toSlug(editing.type, providers ?? [])
    setEditing(e => e ? { ...e, keyStatus: 'checking', keyError: null, models: [], model: '' } : null)
    const result = await oauthProvider.mutateAsync({ slug, type: editing.type })
    if (result.ok) {
      const models = result.models ?? []
      setEditing(e => e ? { ...e, keyStatus: 'valid', models, model: models[0] ?? '' } : null)
    } else {
      setEditing(e => e ? { ...e, keyStatus: 'error', keyError: result.error ?? 'Authentication failed' } : null)
    }
  }

  const handleReconnect = async (p: ProviderRecord) => {
    setReconnectTarget(p.slug)
    const result = await oauthProvider.mutateAsync({ slug: p.slug, type: p.type })
    setReconnectTarget(null)
    if (!result.ok) setSaveError(result.error ?? 'Reconnection failed')
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
        <Button
          variant="primary"
          onClick={() => {
            setEditing(editing ? null : { type: 'anthropic', credential: '', keyStatus: 'idle', keyError: null, models: [], model: '' })
            setSaveError(null)
          }}
        >
          {editing ? (
            <>Cancel</>
          ) : (
            <><Plus className="w-3.5 h-3.5" /> Add provider</>
          )}
        </Button>
      </div>

      {/* Add provider form */}
      {editing && (
        <div className="border-b border-blue-200 bg-blue-50/30 p-4 space-y-3">
          <div>
            <Label>Provider type</Label>
            <Select
              value={editing.type}
              onChange={e => handleTypeChange(e.target.value)}
            >
              {PROVIDER_TYPES.map(t => <option key={t} value={t}>{PROVIDER_NAMES[t]}</option>)}
            </Select>
            <p className="text-xs text-gray-400 font-mono mt-1">{toSlug(editing.type, providers ?? [])}</p>
          </div>

          <div>
            {OAUTH_PROVIDERS.has(editing.type) ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  onClick={() => void handleOAuthConnect()}
                  disabled={editing.keyStatus === 'checking'}
                >
                  {editing.keyStatus === 'checking' ? <Loader2 className="w-4 h-4 animate-spin" /> : `Connect with ${PROVIDER_NAMES[editing.type]}`}
                </Button>
                {editing.keyStatus === 'valid' && <Check className="w-4 h-4 text-green-500 shrink-0" />}
                {editing.keyStatus === 'error' && <X className="w-4 h-4 text-red-500 shrink-0" />}
              </div>
            ) : (
              <>
                <Label>{credentialLabel(editing.type)}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    mono
                    className="flex-1"
                    type="text"
                    value={editing.credential}
                    onChange={e => setEditing({ ...editing, credential: e.target.value, keyStatus: 'idle', keyError: null, models: [], model: '' })}
                    onBlur={handleCredentialBlur}
                    placeholder={credentialPlaceholder(editing.type)}
                  />
                  {editing.keyStatus === 'checking' && <Loader2 className="w-4 h-4 text-gray-400 animate-spin shrink-0" />}
                  {editing.keyStatus === 'valid' && <Check className="w-4 h-4 text-green-500 shrink-0" />}
                  {editing.keyStatus === 'error' && <X className="w-4 h-4 text-red-500 shrink-0" />}
                </div>
              </>
            )}
            {editing.keyStatus === 'error' && editing.keyError && (
              <p className="text-xs text-red-600 mt-1">{editing.keyError}</p>
            )}
          </div>

          {editing.keyStatus === 'valid' && editing.models.length > 0 && (
            <div>
              <Label>Model</Label>
              <Select
                value={editing.model}
                onChange={e => setEditing({ ...editing, model: e.target.value })}
              >
                {editing.models.map(m => <option key={m} value={m}>{m}</option>)}
              </Select>
            </div>
          )}

          {saveError && <p className="text-xs text-red-600">{saveError}</p>}

          <Button
            variant="primary"
            size="lg"
            onClick={handleSave}
            disabled={editing.keyStatus !== 'valid' || !editing.model || saveProvider.isPending}
          >
            {saveProvider.isPending ? 'Saving...' : 'Save provider'}
          </Button>
        </div>
      )}

      {/* Provider list */}
      {isLoading && <p className="text-sm text-gray-400">Loading...</p>}
      {!isLoading && !providers?.length && !editing && (
        <div className="border-b border-dashed border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-500">No providers configured. Add one to deploy agents.</p>
        </div>
      )}

      <div className="space-y-2">
        {providers?.map(p => (
          <div key={p.slug} className="flex items-center justify-between border-b border-gray-200 px-4 py-3 group">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex items-center justify-center w-8 h-8 rounded-md bg-gray-100 text-xs font-semibold text-gray-600 uppercase shrink-0">
                {p.type.slice(0, 2)}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900">{p.name}</div>
                <div className="text-xs text-gray-400 font-mono truncate">
                  {p.model}
                  {OAUTH_PROVIDERS.has(p.type)
                    ? <span className="ml-2 text-green-600">Connected</span>
                    : p.maskedApiKey && <span className="ml-2">{p.maskedApiKey}</span>
                  }
                </div>
              </div>
            </div>
            <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
              {OAUTH_PROVIDERS.has(p.type) && deleteTarget !== p.slug && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => void handleReconnect(p)}
                  disabled={reconnectTarget === p.slug}
                  title="Reconnect"
                >
                  {reconnectTarget === p.slug
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <RefreshCw className="w-3.5 h-3.5" />
                  }
                </Button>
              )}
              {deleteTarget === p.slug ? (
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => { deleteProvider.mutate(p.slug); setDeleteTarget(null) }}
                  >
                    Confirm
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setDeleteTarget(null)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost-destructive"
                  size="icon"
                  onClick={() => setDeleteTarget(p.slug)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
