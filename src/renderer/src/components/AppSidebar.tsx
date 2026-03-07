import { useState } from 'react'
import { ChevronRight, ChevronDown, Plus, Settings, Trash2 } from 'lucide-react'
import { useNav, type SidebarGroup } from '../store/nav'
import { useProviders, useDeleteProvider } from '../hooks/useProviders'
import { useEnvironments, useDeleteEnvironment } from '../hooks/useEnvironments'
import { useTeams, useDeleteTeam } from '../hooks/useTeams'
import { cn } from '../lib/utils'

interface SidebarItem {
  slug: string
  label: string
  sublabel?: string
  badge?: string
  badgeColor?: string
  deployed?: boolean
}

function SidebarGroupSection({
  title,
  items,
  isExpanded,
  onToggle,
  onAdd,
  selectedSlug,
  onSelect,
  onDelete,
}: {
  title: string
  items: SidebarItem[]
  isExpanded: boolean
  onToggle: () => void
  onAdd: () => void
  selectedSlug: string | null
  onSelect: (slug: string) => void
  onDelete: (slug: string) => void
}) {
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  return (
    <div className="border-b border-gray-100">
      <div className="flex items-center justify-between px-3 py-2.5">
        <button onClick={onToggle} className="flex items-center gap-1.5 min-w-0">
          {isExpanded ? (
            <ChevronDown className="w-3 h-3 text-gray-400 shrink-0" />
          ) : (
            <ChevronRight className="w-3 h-3 text-gray-400 shrink-0" />
          )}
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400">
            {title}
          </span>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onAdd()
          }}
          className="inline-flex h-5 w-5 items-center justify-center rounded text-gray-400 transition-colors hover:bg-white hover:text-gray-700"
          title={`Add ${title.toLowerCase()}`}
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>

      {isExpanded && (
        <div>
          {items.length === 0 && (
            <p className="px-3 pb-3 text-[10px] text-gray-400 text-center">
              None configured
            </p>
          )}
          {items.map((item) => (
            <button
              key={item.slug}
              onClick={() => onSelect(item.slug)}
              className={cn(
                'group w-full border-b border-gray-100 px-3 py-2 text-left transition-colors',
                selectedSlug === item.slug
                  ? 'bg-white text-gray-900'
                  : 'text-gray-600 hover:bg-white/80 hover:text-gray-900',
              )}
            >
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {item.badge && (
                    <span
                      className={cn(
                        'flex items-center justify-center w-6 h-6 rounded text-[9px] font-semibold uppercase shrink-0',
                        item.badgeColor ?? 'bg-gray-100 text-gray-600',
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-medium truncate">{item.label}</div>
                    {item.sublabel && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-gray-400 truncate">{item.sublabel}</span>
                        {item.deployed && (
                          <span className="text-[10px] text-green-500 shrink-0">deployed</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                  {deleteTarget === item.slug ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          onDelete(item.slug)
                          setDeleteTarget(null)
                        }}
                        className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-red-600 text-white hover:bg-red-700"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setDeleteTarget(null)}
                        className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-gray-100 text-gray-600 hover:bg-gray-200"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteTarget(item.slug)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function AppSidebar() {
  const { expandedGroups, selectedItem, toggleGroup, selectItem, setSettingsOpen, setCreateDialogOpen } = useNav()
  const { data: providers } = useProviders()
  const { data: environments } = useEnvironments()
  const { data: teams } = useTeams()
  const deleteProvider = useDeleteProvider()
  const deleteEnvironment = useDeleteEnvironment()
  const deleteTeam = useDeleteTeam()

  const providerItems: SidebarItem[] = (providers ?? []).map((p) => ({
    slug: p.slug,
    label: p.name,
    sublabel: p.model,
    badge: p.type.slice(0, 2),
    badgeColor: 'bg-gray-100 text-gray-600',
  }))

  const environmentItems: SidebarItem[] = (environments ?? []).map((e) => ({
    slug: e.slug,
    label: e.name,
    sublabel: (e.config as { projectId?: string }).projectId,
    badge: 'GKE',
    badgeColor: 'bg-blue-50 text-blue-600',
  }))

  const teamItems: SidebarItem[] = (teams ?? []).map((t) => ({
    slug: t.slug,
    label: t.name,
    sublabel: `${t.agents.length} agent${t.agents.length !== 1 ? 's' : ''}`,
    deployed: !!t.lastDeployedAt,
  }))

  const selectedSlugForGroup = (group: SidebarGroup): string | null => {
    if (!selectedItem) return null
    if (group === 'providers' && selectedItem.type === 'provider') return selectedItem.slug
    if (group === 'environments' && selectedItem.type === 'environment') return selectedItem.slug
    if (group === 'teams' && selectedItem.type === 'team') return selectedItem.slug
    return null
  }

  return (
    <aside className="w-56 shrink-0 bg-[#f6f5f3] border-r border-gray-100 h-full flex flex-col">
      <div className="px-3 py-3 border-b border-gray-100 shrink-0 flex items-center justify-between">
        <span className="text-sm font-semibold tracking-tight select-none">Coordina</span>
        <button
          onClick={() => setSettingsOpen(true)}
          className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-white hover:text-gray-700"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <SidebarGroupSection
          title="Model Providers"
          items={providerItems}
          isExpanded={expandedGroups.includes('providers')}
          onToggle={() => toggleGroup('providers')}
          onAdd={() => setCreateDialogOpen('providers')}
          selectedSlug={selectedSlugForGroup('providers')}
          onSelect={(slug) => selectItem({ type: 'provider', slug })}
          onDelete={(slug) => deleteProvider.mutate(slug)}
        />
        <SidebarGroupSection
          title="Cloud Providers"
          items={environmentItems}
          isExpanded={expandedGroups.includes('environments')}
          onToggle={() => toggleGroup('environments')}
          onAdd={() => setCreateDialogOpen('environments')}
          selectedSlug={selectedSlugForGroup('environments')}
          onSelect={(slug) => selectItem({ type: 'environment', slug })}
          onDelete={(slug) => deleteEnvironment.mutate(slug)}
        />
        <SidebarGroupSection
          title="Teams"
          items={teamItems}
          isExpanded={expandedGroups.includes('teams')}
          onToggle={() => toggleGroup('teams')}
          onAdd={() => setCreateDialogOpen('teams')}
          selectedSlug={selectedSlugForGroup('teams')}
          onSelect={(slug) => selectItem({ type: 'team', slug })}
          onDelete={(slug) => deleteTeam.mutate(slug)}
        />
      </div>
    </aside>
  )
}
