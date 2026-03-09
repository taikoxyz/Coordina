import { useState } from 'react'
import { Loader2, Check, X } from 'lucide-react'
import { useNav } from '../store/nav'
import { useProviders, useSaveProvider, useOAuthProvider } from '../hooks/useProviders'
import type { ProviderRecord } from '../../../shared/types'
import { Button, Input, Select, Label, DialogShell } from './ui'

const PROVIDER_TYPES = ['claude', 'anthropic', 'openai', 'deepseek', 'openrouter', 'minimax', 'ollama']
const PROVIDER_NAMES: Record<string, string> = {
  claude: 'Claude', anthropic: 'Anthropic', openai: 'OpenAI', deepseek: 'DeepSeek', openrouter: 'OpenRouter', minimax: 'MiniMax', ollama: 'Ollama',
}
const OAUTH_PROVIDERS = new Set(['claude', 'anthropic', 'openai', 'deepseek', 'openrouter', 'minimax'])

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
  const oauthProvider = useOAuthProvider()
  const isOpen = isCreateDialogOpen === 'providers'

  const [type, setType] = useState('claude')
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

  const handleOAuthConnect = async () => {
    const slug = toSlug(type, providers ?? [])
    setKeyStatus('checking')
    setKeyError(null)
    setModels([])
    setModel('')
    const result = await oauthProvider.mutateAsync({ slug, type })
    if (result.ok) {
      const m = result.models ?? []
      setKeyStatus('valid')
      setModels(m)
      setModel(m[0] ?? '')
    } else {
      setKeyStatus('error')
      setKeyError(result.error ?? 'Authentication failed')
    }
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
    <DialogShell
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setCreateDialogOpen(null)
          reset()
        }
      }}
      title="Add Model Provider"
    >
      <div className="space-y-4">
        <div>
          <Label>Provider type</Label>
          <Select
            value={type}
            onChange={(e) => handleTypeChange(e.target.value)}
          >
            {PROVIDER_TYPES.map((t) => (
              <option key={t} value={t}>{PROVIDER_NAMES[t]}</option>
            ))}
          </Select>
          <p className="text-xs text-gray-400 font-mono mt-1">{toSlug(type, providers ?? [])}</p>
        </div>

        <div>
          {OAUTH_PROVIDERS.has(type) ? (
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                onClick={() => void handleOAuthConnect()}
                disabled={keyStatus === 'checking'}
              >
                {keyStatus === 'checking' ? <Loader2 className="w-4 h-4 animate-spin" /> : `Connect with ${PROVIDER_NAMES[type]}`}
              </Button>
              {keyStatus === 'valid' && <Check className="w-4 h-4 text-green-500 shrink-0" />}
              {keyStatus === 'error' && <X className="w-4 h-4 text-red-500 shrink-0" />}
            </div>
          ) : (
            <>
              <Label>{credentialLabel(type)}</Label>
              <div className="flex items-center gap-2">
                <Input
                  mono
                  className="flex-1"
                  type="text"
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
                />
                {keyStatus === 'checking' && <Loader2 className="w-4 h-4 text-gray-400 animate-spin shrink-0" />}
                {keyStatus === 'valid' && <Check className="w-4 h-4 text-green-500 shrink-0" />}
                {keyStatus === 'error' && <X className="w-4 h-4 text-red-500 shrink-0" />}
              </div>
            </>
          )}
          {keyStatus === 'error' && keyError && (
            <p className="text-xs text-red-600 mt-1">{keyError}</p>
          )}
        </div>

        {keyStatus === 'valid' && models.length > 0 && (
          <div>
            <Label>Model</Label>
            <Select
              value={model}
              onChange={(e) => setModel(e.target.value)}
            >
              {models.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </Select>
          </div>
        )}

        {saveError && <p className="text-xs text-red-600">{saveError}</p>}

        <div className="flex justify-end">
          <Button
            variant="primary"
            onClick={() => void handleSave()}
            disabled={keyStatus !== 'valid' || !model || saveProvider.isPending}
          >
            {saveProvider.isPending ? 'Saving...' : 'Save provider'}
          </Button>
        </div>
      </div>
    </DialogShell>
  )
}
