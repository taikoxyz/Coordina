import { create } from 'zustand'

export type Page = 'teams' | 'settings'
export type TeamTab = 'overview' | 'agents' | 'deploy'
export type SettingsTab = 'general' | 'providers' | 'environments'
export type TeamsView = 'empty' | 'list' | 'create'

interface NavStore {
  page: Page
  teamSlug: string | null
  teamTab: TeamTab
  settingsTab: SettingsTab
  teamsView: TeamsView
  setPage: (page: Page, teamSlug?: string | null) => void
  openTeamCreator: () => void
  setTeamTab: (tab: TeamTab) => void
  setSettingsTab: (tab: SettingsTab) => void
}

export const useNav = create<NavStore>((set) => ({
  page: 'teams',
  teamSlug: null,
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
