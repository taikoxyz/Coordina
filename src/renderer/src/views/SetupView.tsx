import * as Accordion from '@radix-ui/react-accordion'
import { ChevronDown, Settings2 } from 'lucide-react'
import { useNav } from '../store/nav'
import { useProviders } from '../hooks/useProviders'
import { useEnvironments } from '../hooks/useEnvironments'
import { ProvidersSettings } from '../components/settings/ProvidersSettings'
import { EnvironmentsSettings } from '../components/settings/EnvironmentsSettings'
import { EmptyState } from '../components/EmptyState'

export function SetupView() {
  const { setupSection, setSetupSection } = useNav()
  const { data: providers } = useProviders()
  const { data: environments } = useEnvironments()

  const hasProviders = (providers?.length ?? 0) > 0
  const hasEnvironments = (environments?.length ?? 0) > 0

  if (!hasProviders && !hasEnvironments) {
    return (
      <EmptyState
        icon={<Settings2 className="h-12 w-12" />}
        title="Welcome to Coordina"
        description="Configure your model providers and deployment environments to get started."
        actionLabel="Get Started"
        onAction={() => setSetupSection('providers')}
      />
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl p-6">
        <Accordion.Root
          type="single"
          value={setupSection}
          onValueChange={(value) => {
            if (value) setSetupSection(value as 'providers' | 'environments')
          }}
          collapsible
        >
          <Accordion.Item value="providers" className="mb-3 rounded-lg border border-[var(--color-border)] bg-white">
            <Accordion.Header>
              <Accordion.Trigger className="group flex w-full items-center justify-between px-5 py-4 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-gray-50 rounded-lg">
                Model Providers
                <ChevronDown className="h-4 w-4 text-[var(--color-muted-foreground)] transition-transform duration-200 group-data-[state=open]:rotate-180" />
              </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
              <div className="px-5 pb-5">
                <ProvidersSettings />
              </div>
            </Accordion.Content>
          </Accordion.Item>

          <Accordion.Item value="environments" className="rounded-lg border border-[var(--color-border)] bg-white">
            <Accordion.Header>
              <Accordion.Trigger className="group flex w-full items-center justify-between px-5 py-4 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-gray-50 rounded-lg">
                Deployment Environments
                <ChevronDown className="h-4 w-4 text-[var(--color-muted-foreground)] transition-transform duration-200 group-data-[state=open]:rotate-180" />
              </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
              <div className="px-5 pb-5">
                <EnvironmentsSettings />
              </div>
            </Accordion.Content>
          </Accordion.Item>
        </Accordion.Root>
      </div>
    </div>
  )
}
