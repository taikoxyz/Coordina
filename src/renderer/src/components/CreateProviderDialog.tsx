import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Loader2, Check } from 'lucide-react'
import { useNav } from '../store/nav'
import { useProviders, useSaveProvider } from '../hooks/useProviders'
import type { ProviderRecord } from '../../../shared/types'

const PROVIDER_TYPES = ['anthropic', 'openai', 'deepseek', 'openrouter', 'ollama']
const PROVIDER_NAMES: Record<string, string> = {
  anthropic: 'Anthropic', openai: 'OpenAI', deepseek: 'DeepSeek', openrouter: 'OpenRouter', ollama: 'Ollama',
}

type KeyStatus = 'idle' | 'checking' | 'valid' | 'error'

const toSlug = (type: string, existing: ProviderRecord[]) => {
  const count = existing.filter((p) => p.type === type).length
  return count === 0 ? type : `${type}-${count + 1}`
}

const credentialLabel = (type: string) => (type === 'ollama' ? 'Base URL' : 'API Key')
const credentialPlaceholder = (type: string) => (type === 'ollama' ? 'http://localhost:11434' : 'sk-...')

export function CreateProviderDialog() {
  const { isCreateDialogOpen, setCreateDialogOpen, selectItem } = useNav()
  const { data: providers } = useProviders()
  const saveProvider = useSaveProvider()
  const isOpen = isCreateDialogOpen === 'providers'

  const [type, setType] = useState('anthropic')
  const [credential, setCredential] = useState('')
  const [keyStatus, setKeyStatus] = useState<KeyStatus>('idle')
  const [keyError, setKeyError] = useState<string | null>(null)
  const [models, setModels] = useState<string[]>([])
  const [model, setModel] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)

  const reset = () => {
    setType('anthropic')
    setCredential('')
    setKeyStatus('idle')
    setKeyError(null)
    setModels([])
    setModel('')
    setSaveError(null)
  }

  const handleCredentialBlur = async () => {
    if (!credential.trim()) return
    setKeyStatus('checking')
    setKeyError(null)
    setModels([])
    setModel('')

    const payload = type === 'ollama' ? { type, baseUrl: credential } : { type, apiKey: credential }
    try {
      const result = (await window.api.invoke('providers:testKey', payload)) as {
        ok: boolean; models?: string[]; error?: string
      }
      if (result.ok) {
        const m = result.models ?? []
        setKeyStatus('valid')
        setModels(m)
        setModel(m[0] ?? '')
      } else {
        setKeyStatus('error')
        setKeyError(result.error ?? 'Invalid key')
      }
    } catch (e) {
      setKeyStatus('error')
      setKeyError((e as Error).message)
    }
  }

  const handleTypeChange = (newType: string) => {
    setType(newType)
    setCredential('')
    setKeyStatus('idle')
    setKeyError(null)
    setModels([])
    setModel('')
  }

  const handleSave = async () => {
    if (keyStatus !== 'valid' || !model) return
    const slug = toSlug(type, providers ?? [])
    const name = PROVIDER_NAMES[type] ?? type
    const saveData =
      type === 'ollama'
        ? { slug, type, name, model }
        : { slug, type, name, model, apiKey: credential }
    const result = await saveProvider.mutateAsync(saveData)
    if (result.ok) {
      selectItem({ type: 'provider', slug })
      setCreateDialogOpen(null)
      reset()
    } else {
      setSaveError(result.errors?.join(', ') ?? 'Save failed')
    }
  }

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setCreateDialogOpen(null)
          reset()
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-lg bg-white p-6 shadow-xl focus:outline-none">
          <div className="flex items-center justify-between mb-5">
            <Dialog.Title className="text-sm font-semibold text-gray-900">
              Add Model Provider
            </Dialog.Title>
            <Dialog.Close className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
              <X className="w-4 h-4" />
            </Dialog.Close>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Provider type</label>
              <select
                value={type}
                onChange={(e) => handleTypeChange(e.target.value)}
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {PROVIDER_TYPES.map((t) => (
                  <option key={t} value={t}>{PROVIDER_NAMES[t]}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 font-mono mt-1">{toSlug(type, providers ?? [])}</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {credentialLabel(type)}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type={type === 'ollama' ? 'text' : 'password'}
                  value={credential}
                  onChange={(e) => {
                    setCredential(e.target.value)
                    setKeyStatus('idle')
                    setKeyError(null)
                    setModels([])
                    setModel('')
                  }}
                  onBlur={() => void handleCredentialBlur()}
                  placeholder={credentialPlaceholder(type)}
                  className="flex-1 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-mono text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {keyStatus === 'checking' && <Loader2 className="w-4 h-4 text-gray-400 animate-spin shrink-0" />}
                {keyStatus === 'valid' && <Check className="w-4 h-4 text-green-500 shrink-0" />}
                {keyStatus === 'error' && <X className="w-4 h-4 text-red-500 shrink-0" />}
              </div>
              {keyStatus === 'error' && keyError && (
                <p className="text-xs text-red-600 mt-1">{keyError}</p>
              )}
            </div>

            {keyStatus === 'valid' && models.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Model</label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {models.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            )}

            {saveError && <p className="text-xs text-red-600">{saveError}</p>}

            <div className="flex justify-end">
              <button
                onClick={() => void handleSave()}
                disabled={keyStatus !== 'valid' || !model || saveProvider.isPending}
                className="px-4 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saveProvider.isPending ? 'Saving...' : 'Save provider'}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
