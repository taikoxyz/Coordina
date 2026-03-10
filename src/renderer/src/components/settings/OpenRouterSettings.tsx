import { useState } from 'react'
import { Check, ExternalLink, X } from 'lucide-react'
import { useOpenRouterStatus, useConnectOpenRouter, useDisconnectOpenRouter } from '../../hooks/useProviders'
import { Button, Input, Label } from '../ui'

export function OpenRouterSettings() {
  const { data: status } = useOpenRouterStatus()
  const connect = useConnectOpenRouter()
  const disconnect = useDisconnectOpenRouter()
  const [apiKey, setApiKey] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleConnect = async () => {
    if (!apiKey.trim()) return
    setError(null)
    const result = await connect.mutateAsync(apiKey.trim())
    if (result.ok) {
      setApiKey('')
    } else {
      setError(result.error ?? 'Connection failed')
    }
  }

  const handleDisconnect = async () => {
    await disconnect.mutateAsync()
    setApiKey('')
    setError(null)
  }

  return (
    <div className="space-y-3 max-w-lg">
      <div className="flex items-start justify-between gap-4">
        <p className="text-xs text-gray-500">
          Connect your OpenRouter account to use AI models for your agents.
        </p>
        {status?.connected ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 px-2.5 py-1 rounded-full shrink-0">
            <Check className="w-3 h-3" /> Connected
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full shrink-0">
            <X className="w-3 h-3" /> Not configured
          </span>
        )}
      </div>

      {status?.connected ? (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            Your OpenRouter API key is stored securely in the system keychain.
          </p>
          <Button variant="secondary" size="sm" onClick={() => void handleDisconnect()} disabled={disconnect.isPending}>
            {disconnect.isPending ? 'Disconnecting...' : 'Disconnect'}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <Label>API Key</Label>
            <Input
              mono
              type="password"
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setError(null) }}
              placeholder="sk-or-v1-..."
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              size="sm"
              onClick={() => void handleConnect()}
              disabled={connect.isPending || !apiKey.trim()}
            >
              {connect.isPending ? 'Connecting...' : 'Connect'}
            </Button>
            <a
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
            >
              Get API Key <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
