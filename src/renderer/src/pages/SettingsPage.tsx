import { useNav, type SettingsTab } from '../store/nav'
import { GeneralSettings } from '../components/settings/GeneralSettings'
import { ProvidersSettings } from '../components/settings/ProvidersSettings'
import { EnvironmentsSettings } from '../components/settings/EnvironmentsSettings'
import { cn } from '../lib/utils'

const tabs: { id: SettingsTab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'providers', label: 'Providers' },
  { id: 'environments', label: 'Environments' },
]

export function SettingsPage() {
  const { settingsTab, setSettingsTab } = useNav()

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 pt-6 pb-0 shrink-0">
        <h1 className="text-lg font-semibold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage your app configuration, providers, and deployment environments.</p>

        <div className="flex gap-1 mt-4 border-b border-gray-200">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setSettingsTab(tab.id)}
              className={cn(
                'px-3 py-2 text-sm font-medium transition-colors relative',
                settingsTab === tab.id
                  ? 'text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {tab.label}
              {settingsTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {settingsTab === 'general' && <GeneralSettings />}
        {settingsTab === 'providers' && <ProvidersSettings />}
        {settingsTab === 'environments' && <EnvironmentsSettings />}
      </div>
    </div>
  )
}
