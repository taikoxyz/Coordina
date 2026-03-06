import { create } from 'zustand'

export type Page = 'teams' | 'settings'
export type TeamTab = 'overview' | 'agents' | 'deploy'
export type SettingsTab = 'general' | 'providers' | 'environments'

interface NavStore {
  page: Page
  teamSlug: string | null
  teamTab: TeamTab
  settingsTab: SettingsTab
  setPage: (page: Page, teamSlug?: string | null) => void
  setTeamTab: (tab: TeamTab) => void
  setSettingsTab: (tab: SettingsTab) => void
}

export const useNav = create<NavStore>((set) => ({
  page: 'teams',
  teamSlug: null,
  teamTab: 'overview',
  settingsTab: 'general',
  setPage: (page, teamSlug = null) => set({ page, teamSlug, teamTab: 'overview' }),
  setTeamTab: (teamTab) => set({ teamTab }),
  setSettingsTab: (settingsTab) => set({ settingsTab }),
}))
