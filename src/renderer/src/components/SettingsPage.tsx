import { ArrowLeft, Github } from 'lucide-react'
import { useNav } from '../store/nav'
import type { SettingsSection } from '../store/nav'
import { useTeams } from '../hooks/useTeams'
import { GeneralSettings } from './settings/GeneralSettings'
import { OpenRouterSettings } from './settings/OpenRouterSettings'
import { GkeSettings, GkeHelpPanel } from './settings/GkeSettings'
import { SoulPatternsSettings } from './settings/SoulPatternsSettings'
import { AgentPatternsSettings } from './settings/AgentPatternsSettings'
import { LeadPatternsSettings } from './settings/LeadPatternsSettings'
import { UserPatternsSettings } from './settings/UserPatternsSettings'
import { cn } from '../lib/utils'

const sections: Array<{ id: SettingsSection; label: string; group?: string }> = [
  { id: 'general', label: 'General' },
  { id: 'openrouter', label: 'OpenRouter' },
  { id: 'google-cloud', label: 'Google Cloud' },
{ id: 'patterns-soul', label: 'Soul', group: 'Agent Patterns' },
  { id: 'patterns-agents', label: 'Behavior', group: 'Agent Patterns' },
  { id: 'patterns-lead', label: 'Team Lead', group: 'Agent Patterns' },
  { id: 'patterns-user', label: 'User', group: 'Agent Patterns' },
]

const sectionContent: Record<SettingsSection, () => JSX.Element> = {
  'general': GeneralSettings,
  'openrouter': OpenRouterSettings,
  'google-cloud': GkeSettings,
  'patterns-soul': SoulPatternsSettings,
  'patterns-agents': AgentPatternsSettings,
  'patterns-lead': LeadPatternsSettings,
  'patterns-user': UserPatternsSettings,
}

const sectionHelpPanel: Partial<Record<SettingsSection, () => JSX.Element>> = {
  'google-cloud': GkeHelpPanel,
}

function FallbackHelpPanel() {
  return (
    <div className="space-y-3">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Guide</p>
      <p className="text-xs text-gray-400 italic">Not available</p>
    </div>
  )
}

const sectionTitles: Record<SettingsSection, string> = {
  'general': 'General',
  'openrouter': 'OpenRouter',
  'google-cloud': 'Google Cloud',
  'patterns-soul': 'Soul Patterns',
  'patterns-agents': 'Agent Behavior Patterns',
  'patterns-lead': 'Team Lead Patterns',
  'patterns-user': 'User Patterns',
}

export function SettingsPage() {
  const { settingsSection, setSettingsSection, selectItem } = useNav()
  const { data: teams } = useTeams()
  const Content = sectionContent[settingsSection]

  const goBack = () => {
    if (teams?.length) {
      selectItem({ type: 'team', slug: teams[0].slug })
    } else {
      selectItem(null as never)
    }
  }

  const HelpPanel = sectionHelpPanel[settingsSection] ?? FallbackHelpPanel

  let lastGroup: string | undefined
  return (
    <div className="flex h-full">
      <nav className="w-56 shrink-0 border-r border-gray-100 bg-sidebar flex flex-col">
        <div className="flex-1 overflow-y-auto scrollbar-hide py-3">
          <button
            onClick={goBack}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors w-full"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to app
          </button>
          {sections.map((s) => {
            const showGroup = s.group && s.group !== lastGroup
            lastGroup = s.group
            return (
              <div key={s.id}>
                {showGroup && (
                  <p className="px-4 pt-4 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    {s.group}
                  </p>
                )}
                <button
                  onClick={() => setSettingsSection(s.id)}
                  className={cn(
                    'w-full text-left px-4 py-1.5 text-sm transition-colors',
                    settingsSection === s.id
                      ? 'bg-white/80 text-gray-900 font-medium'
                      : 'text-gray-500 hover:bg-white/50 hover:text-gray-700',
                  )}
                >
                  {s.label}
                </button>
              </div>
            )
          })}
        </div>
        <div className="shrink-0 border-t border-gray-100 px-3 py-2">
          <a
            href="https://github.com/taikoxyz/Coordina"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Github className="w-3.5 h-3.5" />
            GitHub
          </a>
        </div>
      </nav>

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="max-w-2xl px-10 py-8">
          <h1 className="text-lg font-semibold text-gray-900 mb-6">
            {sectionTitles[settingsSection]}
          </h1>
          <Content />
        </div>
      </div>

      <div className="w-56 shrink-0 border-l border-gray-100 overflow-y-auto scrollbar-hide px-6 py-8">
        <HelpPanel />
      </div>
    </div>
  )
}
