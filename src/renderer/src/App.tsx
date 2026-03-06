import { useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Sidebar } from './components/Sidebar'
import { TeamsPage } from './pages/TeamsPage'
import { TeamDetailPage } from './pages/TeamDetailPage'
import { SettingsPage } from './pages/SettingsPage'
import { useTeams } from './hooks/useTeams'
import { useNav } from './store/nav'
import './assets/main.css'

const queryClient = new QueryClient()

function AppContent() {
  const { page, teamSlug, teamsView, setPage } = useNav()
  const { data: teams, isFetched } = useTeams()
  const [hasResolvedInitialTeam, setHasResolvedInitialTeam] = useState(false)

  useEffect(() => {
    if (hasResolvedInitialTeam || page !== 'teams' || !isFetched) return

    if (teamSlug) {
      setHasResolvedInitialTeam(true)
      return
    }

    if (teams?.length) {
      setHasResolvedInitialTeam(true)
      setPage('teams', teams[0].slug)
      return
    }

    setHasResolvedInitialTeam(true)
  }, [hasResolvedInitialTeam, isFetched, page, setPage, teamSlug, teams])

  const isResolvingInitialTeam = page === 'teams' && !teamSlug && !hasResolvedInitialTeam
  const shouldShowTeamsPage = page === 'teams' && !teamSlug && hasResolvedInitialTeam && teamsView !== 'empty'
  const shouldShowEmptyMainView = page === 'teams' && !teamSlug && hasResolvedInitialTeam && teamsView === 'empty'

  return (
    <div className="flex h-screen bg-[var(--color-background)] text-[var(--color-foreground)]">
      <Sidebar />
      <main className="flex-1 overflow-hidden flex flex-col">
        {isResolvingInitialTeam && <div className="flex-1 bg-[var(--color-background)]" />}
        {shouldShowEmptyMainView && <div className="flex-1 bg-[var(--color-background)]" />}
        {shouldShowTeamsPage && <TeamsPage startCreating={teamsView === 'create'} />}
        {page === 'teams' && teamSlug && <TeamDetailPage teamSlug={teamSlug} />}
        {page === 'settings' && <SettingsPage />}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  )
}
