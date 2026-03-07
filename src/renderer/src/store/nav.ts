import { create } from 'zustand'

export type AppMode = 'setup' | 'workspace' | 'runtime'
export type SetupSection = 'providers' | 'environments'
export type WorkspacePanel = 'spec' | 'agents'
export type RuntimePanel = 'chat' | 'files'

export type Page = 'teams' | 'settings'
export type TeamTab = 'overview' | 'agents' | 'deploy'
export type SettingsTab = 'general' | 'providers' | 'environments'
export type TeamsView = 'empty' | 'list' | 'create'

interface NavStore {
  mode: AppMode
  teamSlug: string | null
  agentSlug: string | null
  setupSection: SetupSection
  workspacePanel: WorkspacePanel
  runtimePanel: RuntimePanel
  isDeployDrawerOpen: boolean
  isCreateTeamOpen: boolean
  isSettingsOpen: boolean

  setMode: (mode: AppMode) => void
  selectTeam: (slug: string) => void
  selectAgent: (slug: string | null) => void
  setSetupSection: (section: SetupSection) => void
  setWorkspacePanel: (panel: WorkspacePanel) => void
  setRuntimePanel: (panel: RuntimePanel) => void
  toggleDeployDrawer: () => void
  setDeployDrawerOpen: (open: boolean) => void
  setCreateTeamOpen: (open: boolean) => void
  setSettingsOpen: (open: boolean) => void

  page: Page
  teamTab: TeamTab
  settingsTab: SettingsTab
  teamsView: TeamsView
  setPage: (page: Page, teamSlug?: string | null) => void
  openTeamCreator: () => void
  setTeamTab: (tab: TeamTab) => void
  setSettingsTab: (tab: SettingsTab) => void
}

export const useNav = create<NavStore>((set) => ({
  mode: 'setup',
  teamSlug: null,
  agentSlug: null,
  setupSection: 'providers',
  workspacePanel: 'spec',
  runtimePanel: 'chat',
  isDeployDrawerOpen: false,
  isCreateTeamOpen: false,
  isSettingsOpen: false,

  setMode: (mode) => set({ mode }),
  selectTeam: (slug) => set({ teamSlug: slug }),
  selectAgent: (slug) => set({ agentSlug: slug }),
  setSetupSection: (setupSection) => set({ setupSection }),
  setWorkspacePanel: (workspacePanel) => set({ workspacePanel }),
  setRuntimePanel: (runtimePanel) => set({ runtimePanel }),
  toggleDeployDrawer: () => set((s) => ({ isDeployDrawerOpen: !s.isDeployDrawerOpen })),
  setDeployDrawerOpen: (isDeployDrawerOpen) => set({ isDeployDrawerOpen }),
  setCreateTeamOpen: (isCreateTeamOpen) => set({ isCreateTeamOpen }),
  setSettingsOpen: (isSettingsOpen) => set({ isSettingsOpen }),

  page: 'teams',
  teamTab: 'overview',
  settingsTab: 'general',
  teamsView: 'empty',
  setPage: (page, teamSlug = null) => set({
    page,
    teamSlug,
    teamTab: 'overview',
    teamsView: page === 'teams' && !teamSlug ? 'list' : 'empty',
  }),
  openTeamCreator: () => set({
    page: 'teams',
    teamSlug: null,
    teamTab: 'overview',
    teamsView: 'create',
  }),
  setTeamTab: (teamTab) => set({ teamTab }),
  setSettingsTab: (settingsTab) => set({ settingsTab }),
}))
