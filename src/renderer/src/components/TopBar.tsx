import { Settings } from 'lucide-react'
import { type AppMode, useNav } from '../store/nav'
import { cn } from '../lib/utils'
import { SetupProgress } from './SetupProgress'

const modes: { value: AppMode; label: string }[] = [
  { value: 'setup', label: 'Setup' },
  { value: 'workspace', label: 'Workspace' },
  { value: 'runtime', label: 'Runtime' },
]

export function TopBar() {
  const { mode, setMode, setSettingsOpen } = useNav()

  return (
    <header className="flex h-12 shrink-0 items-center border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4">
      <span className="text-sm font-semibold tracking-tight select-none">Coordina</span>

      <nav className="mx-auto flex gap-1">
        {modes.map((m) => (
          <button
            key={m.value}
            onClick={() => setMode(m.value)}
            className={cn(
              'relative px-3 py-1.5 text-sm font-medium transition-colors',
              mode === m.value
                ? 'text-[var(--color-foreground)]'
                : 'text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]',
            )}
          >
            {m.label}
            {mode === m.value && (
              <span className="absolute inset-x-1 -bottom-[7px] h-0.5 rounded-full bg-[var(--color-foreground)]" />
            )}
          </button>
        ))}
      </nav>

      <SetupProgress />

      <div className="ml-3" />
      <button
        onClick={() => setSettingsOpen(true)}
        className="rounded-md p-1.5 text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-accent)] hover:text-[var(--color-foreground)]"
      >
        <Settings className="h-4 w-4" />
      </button>
    </header>
  )
}
