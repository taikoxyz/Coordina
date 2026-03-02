import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Sidebar } from './components/Sidebar'
import { TeamsPage } from './pages/TeamsPage'
import { TeamDetailPage } from './pages/TeamDetailPage'
import { ProvidersPage } from './pages/ProvidersPage'
import { EnvironmentsPage } from './pages/EnvironmentsPage'
import { SettingsPage } from './pages/SettingsPage'
import { useNav } from './store/nav'
import './assets/main.css'

const queryClient = new QueryClient()

function AppContent() {
  const { page, teamSlug } = useNav()

  return (
    <div className="flex h-screen bg-gray-900">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        {page === 'teams' && !teamSlug && <TeamsPage />}
        {page === 'teams' && teamSlug && <TeamDetailPage teamSlug={teamSlug} />}
        {page === 'providers' && <ProvidersPage />}
        {page === 'environments' && <EnvironmentsPage />}
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
