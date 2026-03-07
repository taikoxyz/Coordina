import { useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TopBar } from './components/TopBar'
import { SetupView } from './views/SetupView'
import { WorkspaceView } from './views/WorkspaceView'
import { RuntimeView } from './views/RuntimeView'
import { SettingsDialog } from './components/SettingsDialog'
import { useTeams } from './hooks/useTeams'
import { useNav } from './store/nav'
import './assets/main.css'

const queryClient = new QueryClient()

function AppContent() {
  const { mode, teamSlug, selectTeam, setMode } = useNav()
  const { data: teams, isFetched } = useTeams()
  const [hasResolved, setHasResolved] = useState(false)

  useEffect(() => {
    if (hasResolved || !isFetched) return

    if (!teamSlug && teams?.length) {
      selectTeam(teams[0].slug)
    }

    if (!teams?.length) {
      setMode('setup')
    }

    setHasResolved(true)
  }, [hasResolved, isFetched, teams, teamSlug, selectTeam, setMode])

  return (
    <div className="flex flex-col h-screen bg-[var(--color-background)] text-[var(--color-foreground)]">
      <TopBar />
      <main className="flex-1 overflow-hidden">
        {mode === 'setup' && <SetupView />}
        {mode === 'workspace' && <WorkspaceView />}
        {mode === 'runtime' && <RuntimeView />}
      </main>
      <SettingsDialog />
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
