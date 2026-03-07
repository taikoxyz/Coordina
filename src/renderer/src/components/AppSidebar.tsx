import { Plus, Settings } from 'lucide-react'
import { useNav, type SidebarGroup } from '../store/nav'
import { useProviders } from '../hooks/useProviders'
import { useEnvironments } from '../hooks/useEnvironments'
import { useTeams } from '../hooks/useTeams'
import { cn } from '../lib/utils'

interface SidebarItem {
  slug: string
  label: string
  initial: string
  badgeColor: string
  count?: number
}

function SidebarGroupSection({
  title,
  items,
  onAdd,
  selectedSlug,
  onSelect,
}: {
  title: string
  items: SidebarItem[]
  onAdd: () => void
  selectedSlug: string | null
  onSelect: (slug: string) => void
}) {
  return (
    <div className="py-2">
      <div className="flex items-center justify-between px-4 mb-1">
        <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-gray-400">
          {title}
        </span>
        <button
          onClick={onAdd}
          className="inline-flex h-5 w-5 items-center justify-center rounded text-gray-400 transition-colors hover:bg-white hover:text-gray-700"
          title={`Add ${title.toLowerCase()}`}
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>

      {items.length === 0 && (
        <p className="px-4 py-2 text-xs text-gray-400">
          None configured
        </p>
      )}

      {items.map((item) => (
        <button
          key={item.slug}
          onClick={() => onSelect(item.slug)}
          className={cn(
            'w-full px-4 py-1.5 text-left transition-colors flex items-center gap-2.5',
            selectedSlug === item.slug
              ? 'bg-white/80 text-gray-900'
              : 'text-gray-600 hover:bg-white/50 hover:text-gray-900',
          )}
        >
          <span
            className={cn(
              'flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-semibold uppercase shrink-0',
              item.badgeColor,
            )}
          >
            {item.initial}
          </span>
          <span className="text-sm font-medium truncate min-w-0">{item.label}</span>
          {item.count !== undefined && (
            <span className="text-xs text-gray-400 shrink-0 ml-auto">{item.count}</span>
          )}
        </button>
      ))}
    </div>
  )
}

export function AppSidebar() {
  const { selectedItem, selectItem, setSettingsOpen, setCreateDialogOpen } = useNav()
  const { data: providers } = useProviders()
  const { data: environments } = useEnvironments()
  const { data: teams } = useTeams()

  const providerItems: SidebarItem[] = (providers ?? []).map((p) => {
    const label = p.model ? `${p.type}/${p.model}` : p.slug
    return {
      slug: p.slug,
      label,
      initial: p.type.charAt(0).toUpperCase(),
      badgeColor: 'bg-gray-100 text-gray-600',
    }
  })

  const environmentItems: SidebarItem[] = (environments ?? []).map((e) => {
    const cfg = e.config as { clusterName?: string }
    const label = cfg.clusterName ? `${e.type}-${cfg.clusterName}` : e.slug
    return {
      slug: e.slug,
      label,
      initial: label.charAt(0).toUpperCase(),
      badgeColor: 'bg-blue-50 text-blue-600',
    }
  })

  const teamItems: SidebarItem[] = (teams ?? []).map((t) => ({
    slug: t.slug,
    label: t.slug,
    initial: t.slug.charAt(0).toUpperCase(),
    badgeColor: 'bg-orange-50 text-orange-600',
    count: t.agents.length,
  }))

  const selectedSlugForGroup = (group: SidebarGroup): string | null => {
    if (!selectedItem) return null
    if (group === 'providers' && selectedItem.type === 'provider') return selectedItem.slug
    if (group === 'environments' && selectedItem.type === 'environment') return selectedItem.slug
    if (group === 'teams' && selectedItem.type === 'team') return selectedItem.slug
    return null
  }

  return (
    <aside className="w-56 shrink-0 bg-sidebar border-r border-gray-100 h-full flex flex-col">
      <div className="px-4 py-3 shrink-0 flex items-center justify-between">
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
          onAdd={() => setCreateDialogOpen('providers')}
          selectedSlug={selectedSlugForGroup('providers')}
          onSelect={(slug) => selectItem({ type: 'provider', slug })}
        />
        <SidebarGroupSection
          title="Cloud Providers"
          items={environmentItems}
          onAdd={() => setCreateDialogOpen('environments')}
          selectedSlug={selectedSlugForGroup('environments')}
          onSelect={(slug) => selectItem({ type: 'environment', slug })}
        />
        <SidebarGroupSection
          title="Teams"
          items={teamItems}
          onAdd={() => setCreateDialogOpen('teams')}
          selectedSlug={selectedSlugForGroup('teams')}
          onSelect={(slug) => selectItem({ type: 'team', slug })}
        />
      </div>
    </aside>
  )
}
