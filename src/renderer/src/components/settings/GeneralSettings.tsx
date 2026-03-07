import { useState, useEffect } from 'react'
import type { AppSettings } from '../../../../shared/types'
import {
  DEFAULT_AGENT_NAME_THEME,
  type AgentNameTheme,
} from '../../../../shared/agentNames'
import { useSaveSettings, useSettings } from '../../hooks/useSettings'
import { Button, Input, Label } from '../ui'

const agentNameThemeOptions: Array<{ value: AgentNameTheme; label: string }> = [
  { value: 'sci-fi', label: 'Sci-Fi' },
  { value: 'movies', label: 'Movies' },
  { value: 'mixed', label: 'Mixed' },
]

export function GeneralSettings() {
  const [settings, setSettings] = useState<AppSettings>({})
  const [saved, setSaved] = useState(false)
  const { data: storedSettings } = useSettings()
  const saveSettings = useSaveSettings()

  useEffect(() => {
    if (storedSettings) {
      setSettings(storedSettings)
    }
  }, [storedSettings])

  const handleSave = async () => {
    await saveSettings.mutateAsync(settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="space-y-6 max-w-lg">
      {/* Git versioning */}
      <div className="border-b border-border pb-5">
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
            <Label>Repository path</Label>
            <Input
              mono
              value={settings.gitRepoPath ?? ''}
              onChange={e => setSettings({ ...settings, gitRepoPath: e.target.value || undefined })}
              placeholder="~/.coordina"
            />
          </div>
        )}
      </div>

      <div className="border-b border-border pb-5">
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Agent names</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Choose the global name pack for automatically added agents.
            </p>
          </div>
          <div className="inline-flex bg-gray-50 p-1 rounded-md">
            {agentNameThemeOptions.map((option) => {
              const active =
                (settings.agentNameTheme ?? DEFAULT_AGENT_NAME_THEME) ===
                option.value
              return (
                <button
                  key={option.value}
                  onClick={() =>
                    setSettings({ ...settings, agentNameTheme: option.value })
                  }
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <Button
        variant="primary"
        size="lg"
        onClick={handleSave}
        disabled={saveSettings.isPending}
      >
        {saveSettings.isPending ? 'Saving...' : saved ? 'Saved' : 'Save changes'}
      </Button>
    </div>
  )
}
