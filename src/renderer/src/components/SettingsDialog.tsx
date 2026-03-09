import { useState } from 'react'
import { GeneralSettings } from './settings/GeneralSettings'
import { OpenRouterSettings } from './settings/OpenRouterSettings'
import { GkeSettings } from './settings/GkeSettings'
import { useNav } from '../store/nav'
import { DialogShell } from './ui'
import { cn } from '../lib/utils'

const tabs = [
  { id: 'general', label: 'General' },
  { id: 'openrouter', label: 'OpenRouter' },
  { id: 'google-cloud', label: 'Google Cloud' },
] as const

type SettingsTab = (typeof tabs)[number]['id']

export function SettingsDialog() {
  const { isSettingsOpen, setSettingsOpen } = useNav()
  const [tab, setTab] = useState<SettingsTab>('general')

  return (
    <DialogShell open={isSettingsOpen} onOpenChange={setSettingsOpen} title="Settings" maxWidth="max-w-2xl">
      <div className="flex gap-4 border-b border-gray-200 mb-6">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'text-sm font-medium pb-2 transition-colors relative',
              tab === t.id
                ? 'text-gray-900'
                : 'text-gray-400 hover:text-gray-600',
            )}
          >
            {t.label}
            {tab === t.id && (
              <span className="absolute -bottom-[1px] left-0 right-0 h-[2px] bg-gray-900 rounded-t" />
            )}
          </button>
        ))}
      </div>
      {tab === 'general' && <GeneralSettings />}
      {tab === 'openrouter' && <OpenRouterSettings />}
      {tab === 'google-cloud' && <GkeSettings />}
    </DialogShell>
  )
}
