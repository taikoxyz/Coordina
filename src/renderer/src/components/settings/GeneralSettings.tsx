import { useState, useEffect } from 'react'
import type { AppSettings } from '../../../../shared/types'
import {
  DEFAULT_AGENT_NAME_THEME,
  type AgentNameTheme,
} from '../../../../shared/agentNames'
import { useSaveSettings, useSettings } from '../../hooks/useSettings'
import { Button } from '../ui'

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
