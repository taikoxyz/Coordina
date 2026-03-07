import { create } from 'zustand'

export type SidebarGroup = 'providers' | 'environments' | 'teams'

export type SelectedItem =
  | { type: 'provider'; slug: string }
  | { type: 'environment'; slug: string }
  | { type: 'team'; slug: string }

export type TeamTab = 'specs' | 'deployment' | 'chat'

interface NavStore {
  expandedGroups: SidebarGroup[]
  selectedItem: SelectedItem | null
  teamTab: TeamTab
  agentSlug: string | null
  isSettingsOpen: boolean
  isCreateDialogOpen: SidebarGroup | null

  toggleGroup: (group: SidebarGroup) => void
  selectItem: (item: SelectedItem) => void
  setTeamTab: (tab: TeamTab) => void
  selectAgent: (slug: string | null) => void
  setSettingsOpen: (open: boolean) => void
  setCreateDialogOpen: (group: SidebarGroup | null) => void
}

export const useNav = create<NavStore>((set) => ({
  expandedGroups: ['providers', 'environments', 'teams'],
  selectedItem: null,
  teamTab: 'specs',
  agentSlug: null,
  isSettingsOpen: false,
  isCreateDialogOpen: null,

  toggleGroup: (group) =>
    set((s) => ({
      expandedGroups: s.expandedGroups.includes(group)
        ? s.expandedGroups.filter((g) => g !== group)
        : [...s.expandedGroups, group],
    })),
  selectItem: (item) => set({ selectedItem: item, teamTab: 'specs', agentSlug: null }),
  setTeamTab: (teamTab) => set({ teamTab }),
  selectAgent: (slug) => set({ agentSlug: slug }),
  setSettingsOpen: (isSettingsOpen) => set({ isSettingsOpen }),
  setCreateDialogOpen: (isCreateDialogOpen) => set({ isCreateDialogOpen }),
}))
