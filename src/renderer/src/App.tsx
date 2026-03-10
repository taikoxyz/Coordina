import { useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppSidebar } from './components/AppSidebar'
import { MainContent } from './components/MainContent'
import { CreateTeamDialog } from './components/CreateTeamDialog'
import { TooltipProvider } from './components/ui/tooltip'
import { useTeams } from './hooks/useTeams'
import { useNav } from './store/nav'
import './assets/main.css'

const queryClient = new QueryClient()

function AppContent() {
  const { selectedItem, selectItem } = useNav()
  const { data: teams, isFetched } = useTeams()

  useEffect(() => {
    if (!isFetched || !teams?.length) return
    const teamBySlug = new Map(teams.map((t) => [t.slug, t]))
    const validSelection =
      selectedItem?.type === 'settings' ||
      (selectedItem?.type === 'team' && teamBySlug.has(selectedItem.slug)) ||
      (selectedItem?.type === 'agent' &&
        teamBySlug.get(selectedItem.teamSlug)?.agents.some((a) => a.slug === selectedItem.agentSlug))
    if (!validSelection) {
      selectItem({ type: 'team', slug: teams[0].slug })
    }
  }, [isFetched, teams, selectedItem, selectItem])

  return (
    <div className="flex h-screen bg-background text-foreground">
      {selectedItem?.type !== 'settings' && <AppSidebar />}
      <main className="flex-1 overflow-hidden">
        <MainContent />
      </main>
      <CreateTeamDialog />
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppContent />
      </TooltipProvider>
    </QueryClientProvider>
  )
}
