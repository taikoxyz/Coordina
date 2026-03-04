// Settings page with dense layout for git versioning and app configuration
// FEATURE: Settings page with inline form for git versioning toggle and repo path
import { useState, useEffect } from 'react'
import type { AppSettings } from '../../../shared/types'

const inputCls = 'bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-[11px] text-gray-200 focus:outline-none focus:border-blue-600 w-full font-mono'
const sectionCls = 'border border-gray-700/60 rounded p-2.5 space-y-1.5'
const headCls = 'text-[11px] font-medium text-gray-300'

export function SettingsPage() {
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
    <div className="h-full overflow-y-auto p-4 max-w-lg space-y-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[12px] font-medium text-gray-300">Settings</span>
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-[10px] px-2 py-0.5 bg-blue-700 hover:bg-blue-600 disabled:bg-gray-700 text-white rounded"
        >
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}
        </button>
      </div>

      <div className={sectionCls}>
        <div className={headCls}>Git versioning</div>
        <p className="text-[10px] text-gray-500">Track team spec changes in git. API keys and derived files are never committed.</p>
        <label className="flex items-center gap-1.5 text-[11px] text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.gitEnabled ?? false}
            onChange={e => setSettings({ ...settings, gitEnabled: e.target.checked })}
            className="accent-blue-500"
          />
          Enable git versioning
        </label>
        {settings.gitEnabled && (
          <div>
            <label className="text-[10px] text-gray-500 block mb-0.5">repo path (default: ~/.coordina)</label>
            <input
              className={inputCls}
              value={settings.gitRepoPath ?? ''}
              onChange={e => setSettings({ ...settings, gitRepoPath: e.target.value || undefined })}
              placeholder="~/.coordina"
            />
          </div>
        )}
      </div>
    </div>
  )
}
