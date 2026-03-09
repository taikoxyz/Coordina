import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type SelectedItem =
  | { type: 'team'; slug: string }
  | { type: 'agent'; teamSlug: string; agentSlug: string }

export type ContentTab = 'deploy' | 'spec' | 'files' | 'connect'

interface NavStore {
  selectedItem: SelectedItem | null
  contentTab: ContentTab
  expandedTeams: string[]
  projectSlug: string | null
  isSettingsOpen: boolean
  isCreateDialogOpen: 'teams' | null
  deployingTeamSlug: string | null
  deployingAgentSlug: string | null

  selectItem: (item: SelectedItem) => void
  setContentTab: (tab: ContentTab) => void
  toggleTeam: (slug: string) => void
  setSettingsOpen: (open: boolean) => void
  setCreateDialogOpen: (group: 'teams' | null) => void
  selectProject: (slug: string | null) => void
  setDeploying: (teamSlug: string | null, agentSlug?: string | null) => void
}

export const useNav = create<NavStore>()(
  persist(
    (set) => ({
      selectedItem: null,
      contentTab: 'deploy',
      expandedTeams: [],
      projectSlug: null,
      isSettingsOpen: false,
      isCreateDialogOpen: null,
      deployingTeamSlug: null,
      deployingAgentSlug: null,

      selectItem: (item) => set({ selectedItem: item, contentTab: 'deploy' }),
      setContentTab: (contentTab) => set({ contentTab }),
      toggleTeam: (slug) =>
        set((s) => ({
          expandedTeams: s.expandedTeams.includes(slug)
            ? s.expandedTeams.filter((t) => t !== slug)
            : [...s.expandedTeams, slug],
        })),
      setSettingsOpen: (isSettingsOpen) => set({ isSettingsOpen }),
      setCreateDialogOpen: (isCreateDialogOpen) => set({ isCreateDialogOpen }),
      selectProject: (projectSlug) => set({ projectSlug }),
      setDeploying: (teamSlug, agentSlug) => set({ deployingTeamSlug: teamSlug, deployingAgentSlug: agentSlug ?? null }),
    }),
    {
      name: 'coordina-nav',
      partialize: (state) => ({
        selectedItem: state.selectedItem,
        contentTab: state.contentTab,
        expandedTeams: state.expandedTeams,
        projectSlug: state.projectSlug,
      }),
    },
  ),
)
