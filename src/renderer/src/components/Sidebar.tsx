import { useNav, type Page } from '../store/nav'

interface NavItem {
  id: Page
  label: string
  icon: string
}

const NAV_ITEMS: NavItem[] = [
  { id: 'teams', label: 'Teams', icon: '👥' },
  { id: 'providers', label: 'Model Providers', icon: '🤖' },
  { id: 'environments', label: 'Environments', icon: '☁️' },
]

export function Sidebar() {
  const { page, setPage } = useNav()

  return (
    <aside className="w-56 bg-gray-50 border-r border-gray-200 flex flex-col h-full shrink-0">
      <div className="px-4 py-5 border-b border-gray-200">
        <span className="text-lg font-bold text-gray-900">Coordina</span>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => setPage(item.id)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md text-left transition-colors ${
              page === item.id
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="px-2 py-3 border-t border-gray-200">
        <button
          onClick={() => setPage('settings')}
          className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md text-left transition-colors ${
            page === 'settings'
              ? 'bg-blue-50 text-blue-700 font-medium'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <span>⚙️</span>
          <span>Settings</span>
        </button>
      </div>
    </aside>
  )
}
