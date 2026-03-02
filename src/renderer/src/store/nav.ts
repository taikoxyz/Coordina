import { create } from 'zustand'

export type Page = 'teams' | 'providers' | 'environments' | 'settings'

interface NavStore {
  page: Page
  teamSlug: string | null
  setPage: (page: Page, teamSlug?: string | null) => void
}

export const useNav = create<NavStore>((set) => ({
  page: 'teams',
  teamSlug: null,
  setPage: (page, teamSlug = null) => set({ page, teamSlug }),
}))
