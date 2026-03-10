import { useState } from 'react'
import { Check, ExternalLink, X } from 'lucide-react'
import { useOpenRouterStatus, useConnectOpenRouter, useDisconnectOpenRouter, useTestOpenRouter } from '../../hooks/useProviders'
import { Button, Input, Label } from '../ui'

export function OpenRouterStatusBadge() {
  const { data: status } = useOpenRouterStatus()
  if (status?.connected) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
        <Check className="w-3 h-3" /> Connected
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
      <X className="w-3 h-3" /> Not configured
    </span>
  )
}

export function OpenRouterSettings() {
  const { data: status } = useOpenRouterStatus()
  const connect = useConnectOpenRouter()
  const disconnect = useDisconnectOpenRouter()
  const testConnection = useTestOpenRouter()
  const [apiKey, setApiKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<'idle' | 'ok' | 'fail'>('idle')
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)

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

  const handleTest = async () => {
    setTestResult('idle')
    setError(null)
    const result = await testConnection.mutateAsync()
    if (result.ok) {
      setTestResult('ok')
      setTimeout(() => setTestResult('idle'), 3000)
    } else {
      setTestResult('fail')
      setError(result.error ?? 'Authentication failed')
    }
  }

  const handleDisconnect = async () => {
    await disconnect.mutateAsync()
    setApiKey('')
    setError(null)
    setTestResult('idle')
  }

  return (
    <div className="space-y-3 max-w-lg">
      <p className="text-xs text-gray-500">
        Connect your OpenRouter account to use AI models for your agents.
      </p>

      {status?.connected ? (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            Your OpenRouter API key is stored securely in the system keychain.
          </p>
          {status.maskedKey && (
            <p className="text-xs font-mono text-gray-400">{status.maskedKey}</p>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void handleTest()}
              disabled={testConnection.isPending}
            >
              {testConnection.isPending ? 'Testing...' : testResult === 'ok' ? 'Connection valid' : 'Test connection'}
            </Button>
            {testResult === 'ok' && <Check className="w-4 h-4 text-green-600" />}
            {confirmDisconnect ? (
              <>
                <span className="text-xs text-gray-500">Are you sure?</span>
                <Button variant="destructive" size="sm" onClick={() => { void handleDisconnect(); setConfirmDisconnect(false) }} disabled={disconnect.isPending}>
                  {disconnect.isPending ? 'Disconnecting...' : 'Yes, disconnect'}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmDisconnect(false)}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button variant="ghost-destructive" size="sm" onClick={() => setConfirmDisconnect(true)}>
                Disconnect
              </Button>
            )}
          </div>
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
