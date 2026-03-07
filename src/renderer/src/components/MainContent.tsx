import { Settings2 } from 'lucide-react'
import { useNav } from '../store/nav'
import { ProviderDetail } from './ProviderDetail'
import { EnvironmentDetail } from './EnvironmentDetail'
import { TeamContent } from './TeamContent'
import { EmptyState } from './EmptyState'

export function MainContent() {
  const { selectedItem } = useNav()

  if (!selectedItem) {
    return (
      <EmptyState
        icon={<Settings2 className="h-12 w-12" />}
        title="Welcome to Coordina"
        description="Select an item from the sidebar or add a new model provider, cloud provider, or team to get started."
      />
    )
  }

  switch (selectedItem.type) {
    case 'provider':
      return <ProviderDetail slug={selectedItem.slug} />
    case 'environment':
      return <EnvironmentDetail slug={selectedItem.slug} />
    case 'team':
      return <TeamContent slug={selectedItem.slug} />
  }
}
