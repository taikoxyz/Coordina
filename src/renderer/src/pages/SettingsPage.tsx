import { useState, useEffect } from 'react'

type GitHubStatus = 'loading' | 'no-gh' | 'idle' | 'connecting' | 'connected' | 'error'

export function SettingsPage() {
  const [ghStatus, setGhStatus] = useState<GitHubStatus>('loading')
  const [ghError, setGhError] = useState('')

  useEffect(() => {
    (window.api.invoke('settings:githubAuth:check') as Promise<{ installed: boolean; connected: boolean }>).then(res => {
      if (res.connected) setGhStatus('connected')
      else if (!res.installed) setGhStatus('no-gh')
      else setGhStatus('idle')
    })
  }, [])

  async function handleConnect() {
    setGhError('')
    setGhStatus('connecting')
    const result = await window.api.invoke('settings:githubAuth:login') as { ok: boolean; error?: string }
    if (result.ok) {
      setGhStatus('connected')
    } else {
      setGhError(result.error ?? 'Authorization failed')
      setGhStatus('error')
    }
  }

  async function handleDisconnect() {
    await window.api.invoke('settings:githubAuth:disconnect')
    setGhStatus('idle')
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-xl font-semibold text-gray-100 mb-1">Settings</h1>
      <p className="text-sm text-gray-400 mb-8">Configure Coordina app settings.</p>

      <section className="bg-gray-800 border border-gray-700 rounded-xl p-6">
        <h2 className="text-base font-medium text-gray-100 mb-1">GitHub</h2>
        <p className="text-sm text-gray-400 mb-4">
          Required to create and update team repositories.
        </p>

        {ghStatus === 'loading' && (
          <p className="text-sm text-gray-500">Checking...</p>
        )}

        {ghStatus === 'no-gh' && (
          <div className="space-y-3">
            <div className="p-3 bg-yellow-900/30 border border-yellow-700/50 rounded text-sm text-yellow-300">
              <p className="font-medium mb-1">GitHub CLI required</p>
              <p className="text-yellow-400 mb-2">Install it, then run <code className="font-mono bg-black/30 px-1 rounded">gh auth login</code> in your terminal:</p>
              <code className="block font-mono text-xs bg-black/30 rounded px-3 py-2 text-gray-200 select-all">brew install gh && gh auth login</code>
              <p className="text-xs text-yellow-500 mt-2">
                Or download from{' '}
                <button onClick={() => window.open('https://cli.github.com')} className="underline hover:text-yellow-300">
                  cli.github.com
                </button>
              </p>
            </div>
            <button
              onClick={() => (window.api.invoke('settings:githubAuth:check') as Promise<{ installed: boolean; connected: boolean }>).then(res => {
                setGhStatus(res.connected ? 'connected' : res.installed ? 'idle' : 'no-gh')
              })}
              className="text-sm px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
            >
              Check again
            </button>
          </div>
        )}

        {ghStatus === 'connected' && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-green-400">
              <span className="w-2 h-2 rounded-full bg-green-400 inline-block"></span>
              GitHub connected
            </div>
            <button
              onClick={handleDisconnect}
              className="text-sm px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
            >
              Disconnect
            </button>
          </div>
        )}

        {(ghStatus === 'idle' || ghStatus === 'error') && (
          <div className="space-y-3">
            <div className="p-3 bg-gray-700/50 border border-gray-600 rounded text-sm text-gray-300">
              <p className="mb-2">First, make sure you're logged in to GitHub CLI:</p>
              <code className="block font-mono text-xs bg-black/30 rounded px-3 py-2 text-gray-200 select-all">gh auth login</code>
              <p className="text-xs text-gray-500 mt-2">Run this in your terminal, then click Connect below.</p>
            </div>
            <button
              onClick={handleConnect}
              className="px-4 py-2 rounded text-sm bg-blue-600 hover:bg-blue-500 text-white transition-colors"
            >
              Connect GitHub account
            </button>
            {ghStatus === 'error' && (
              <p className="text-sm text-red-400">{ghError}</p>
            )}
          </div>
        )}

        {ghStatus === 'connecting' && (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span className="inline-block w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></span>
            Reading GitHub credentials...
          </div>
        )}
      </section>
    </div>
  )
}
