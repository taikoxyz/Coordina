import { useProviders } from '../hooks/useProviders'
import { useEnvironments } from '../hooks/useEnvironments'
import { useTeams } from '../hooks/useTeams'
import { cn } from '../lib/utils'

const steps = ['Providers', 'Environment', 'Team', 'Deployed'] as const

export function SetupProgress() {
  const { data: providers } = useProviders()
  const { data: environments } = useEnvironments()
  const { data: teams } = useTeams()

  const completed = [
    (providers?.length ?? 0) > 0,
    (environments?.length ?? 0) > 0,
    (teams?.length ?? 0) > 0,
    (teams ?? []).some((t) => !!t.lastDeployedAt),
  ]

  return (
    <div className="flex items-center gap-0">
      {steps.map((label, i) => (
        <div key={label} className="flex items-center">
          {i > 0 && (
            <div
              className={cn(
                'h-px w-5',
                completed[i - 1] && completed[i]
                  ? 'bg-emerald-400'
                  : 'bg-[var(--color-border)]',
              )}
            />
          )}
          <div className="flex flex-col items-center gap-1">
            <div
              className={cn(
                'h-2 w-2 rounded-full border transition-colors',
                completed[i]
                  ? 'border-emerald-500 bg-emerald-500'
                  : 'border-[var(--color-muted-foreground)] bg-transparent',
              )}
            />
            <span className="text-[9px] leading-none text-[var(--color-muted-foreground)]">
              {label}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
