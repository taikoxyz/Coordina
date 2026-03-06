import { useState, useEffect } from 'react'
import type { AppSettings } from '../../../../shared/types'

export function GeneralSettings() {
  const [settings, setSettings] = useState<AppSettings>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    (window.api.invoke('settings:get') as Promise<AppSettings>).then(setSettings)
  }, [])

  const handleSave = async () => {
    setSaving(true)
    await window.api.invoke('settings:save', settings)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="space-y-6 max-w-lg">
      {/* Git versioning */}
      <div className="rounded-lg border border-[var(--color-border)] bg-white p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Git versioning</h3>
            <p className="text-xs text-gray-500 mt-0.5">Track team spec changes in git. API keys and derived files are never committed.</p>
          </div>
          <button
            role="switch"
            aria-checked={settings.gitEnabled ?? false}
            onClick={() => setSettings({ ...settings, gitEnabled: !(settings.gitEnabled ?? false) })}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${settings.gitEnabled ? 'bg-blue-600' : 'bg-gray-200'}`}
          >
            <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition-transform mt-0.5 ${settings.gitEnabled ? 'translate-x-4 ml-0.5' : 'translate-x-0.5'}`} />
          </button>
        </div>

        {settings.gitEnabled && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Repository path</label>
            <input
              className="w-full rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 font-mono placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={settings.gitRepoPath ?? ''}
              onChange={e => setSettings({ ...settings, gitRepoPath: e.target.value || undefined })}
              placeholder="~/.coordina"
            />
          </div>
        )}
      </div>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {saving ? 'Saving...' : saved ? 'Saved' : 'Save changes'}
      </button>
    </div>
  )
}
