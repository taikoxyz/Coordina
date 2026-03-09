import { Settings2 } from 'lucide-react'
import { useNav } from '../store/nav'
import type { ContentTab } from '../store/nav'
import { TeamSpecPanel } from './TeamSpecPanel'
import { AgentSpecPanel } from './AgentSpecPanel'
import { DeployPanel } from './DeployPanel'
import { SpecJsonPanel } from './SpecJsonPanel'
import { FileBrowser } from './files/FileBrowser'
import { ConnectPane } from './agent/ConnectPane'
import { SettingsPage } from './SettingsPage'
import { EmptyState } from './EmptyState'
import { cn } from '../lib/utils'

function TabBar({ tabs, active, onSelect }: { tabs: { id: ContentTab; label: string }[]; active: ContentTab; onSelect: (tab: ContentTab) => void }) {
  return (
    <div className="border-b border-gray-200 shrink-0">
      <div className="flex items-center h-11 px-5">
        <div className="flex gap-6 h-full">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onSelect(tab.id)}
              className={cn(
                'text-sm font-medium transition-colors relative h-full flex items-center',
                active === tab.id
                  ? 'text-gray-900'
                  : 'text-gray-400 hover:text-gray-600',
              )}
            >
              {tab.label}
              {active === tab.id && (
                <span className="absolute -bottom-[1px] left-0 right-0 h-[2px] bg-gray-900 rounded-t" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

const teamTabs: { id: ContentTab; label: string }[] = [
  { id: 'spec', label: 'Spec' },
  { id: 'deploy', label: 'Deploy' },
]

const agentTabs: { id: ContentTab; label: string }[] = [
  { id: 'spec', label: 'Spec' },
  { id: 'deploy', label: 'Deploy' },
  { id: 'files', label: 'Files' },
  { id: 'connect', label: 'Connect' },
]

export function MainContent() {
  const { selectedItem, contentTab, setContentTab } = useNav()

  if (!selectedItem) {
    return (
      <EmptyState
        icon={<Settings2 className="h-12 w-12" />}
        title="Welcome to Coordina"
        description="Select a team from the sidebar or create a new one to get started."
      />
    )
  }

  if (selectedItem.type === 'settings') {
    return <SettingsPage />
  }

  const teamSlug = selectedItem.type === 'team' ? selectedItem.slug : selectedItem.teamSlug
  const agentSlug = selectedItem.type === 'agent' ? selectedItem.agentSlug : undefined
  const tabs = selectedItem.type === 'team' ? teamTabs : agentTabs
  const activeTab = tabs.some((t) => t.id === contentTab) ? contentTab : 'deploy'

  return (
    <div className="flex h-full">
      {/* Middle panel: spec editor */}
      <div className="w-[380px] shrink-0 border-r border-gray-200 overflow-hidden flex flex-col bg-white">
        {selectedItem.type === 'team' ? (
          <TeamSpecPanel slug={selectedItem.slug} />
        ) : (
          <AgentSpecPanel teamSlug={selectedItem.teamSlug} agentSlug={selectedItem.agentSlug} />
        )}
      </div>

      {/* Right panel: tabbed content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <TabBar tabs={tabs} active={activeTab} onSelect={setContentTab} />
        <div className="flex-1 min-h-0 overflow-hidden">
          {activeTab === 'deploy' && (
            <DeployPanel teamSlug={teamSlug} agentSlug={agentSlug} />
          )}
          {activeTab === 'spec' && (
            <SpecJsonPanel teamSlug={teamSlug} agentSlug={agentSlug} />
          )}
          {activeTab === 'files' && agentSlug && (
            <FileBrowser
              teamSlug={teamSlug}
              agentSlug={agentSlug}
              envSlug="gke"
            />
          )}
          {activeTab === 'connect' && agentSlug && (
            <ConnectPane teamSlug={teamSlug} agentSlug={agentSlug} />
          )}
        </div>
      </div>
    </div>
  )
}
