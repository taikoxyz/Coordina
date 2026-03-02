import React, { useState, useEffect } from 'react'

export function SettingsPage() {
  const [apiKey, setApiKey] = useState('')
  const [hasKey, setHasKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    window.api.invoke('settings:hasAnthropicKey').then(has => setHasKey(!!has))
  }, [])

  async function handleSave() {
    if (!apiKey.startsWith('sk-ant-')) {
      setMessage({ type: 'error', text: 'API key must start with sk-ant-' })
      return
    }
    setSaving(true)
    setMessage(null)
    try {
      const result = await window.api.invoke('settings:setAnthropicKey', apiKey) as { ok: boolean; error?: string }
      if (result.ok) {
        setHasKey(true)
        setApiKey('')
        setMessage({ type: 'success', text: 'API key saved. AI enhancement features are now available.' })
      } else {
        setMessage({ type: 'error', text: result.error ?? 'Failed to save key' })
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-xl font-semibold text-gray-100 mb-1">Settings</h1>
      <p className="text-sm text-gray-400 mb-8">Configure Coordina app settings.</p>

      <section className="bg-gray-800 border border-gray-700 rounded-xl p-6">
        <h2 className="text-base font-medium text-gray-100 mb-1">Coordina AI</h2>
        <p className="text-sm text-gray-400 mb-4">
          Used for AI-powered skill suggestions and soul description enhancement.
          This key is stored securely in your macOS Keychain and never sent to any server.
        </p>

        {hasKey && (
          <div className="mb-4 flex items-center gap-2 text-sm text-green-400">
            <span className="w-2 h-2 rounded-full bg-green-400 inline-block"></span>
            API key configured
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="sk-ant-..."
            className="flex-1 rounded bg-gray-700 border border-gray-600 text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-500"
            onKeyDown={e => e.key === 'Enter' && handleSave()}
          />
          <button
            onClick={handleSave}
            disabled={saving || !apiKey}
            className="px-4 py-2 rounded text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>

        {message && (
          <p className={`mt-3 text-sm ${message.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
            {message.text}
          </p>
        )}
      </section>
    </div>
  )
}
