import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
      <div className="text-[var(--color-muted-foreground)] opacity-40">{icon}</div>
      <div className="text-center">
        <h2 className="text-sm font-semibold text-[var(--color-foreground)]">{title}</h2>
        <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">{description}</p>
      </div>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
