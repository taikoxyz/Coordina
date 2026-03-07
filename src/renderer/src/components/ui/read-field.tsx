import { useState } from 'react'
import { cn } from '@renderer/lib/utils'

interface ReadFieldProps {
  label: string
  value?: string | number
  monospace?: boolean
  placeholder?: string
}

const LONG_THRESHOLD = 60

function ReadField({ label, value, monospace = false, placeholder = 'Not set' }: ReadFieldProps) {
  const hasValue = value !== undefined && value !== null && `${value}`.trim().length > 0
  const text = hasValue ? `${value}` : placeholder
  const isLong = hasValue && text.length > LONG_THRESHOLD
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="flex items-baseline justify-between gap-4 py-0.5">
      <div className="text-xs font-medium text-muted-foreground shrink-0">
        {label}
      </div>
      <div
        className={cn(
          'text-sm',
          monospace && 'font-mono',
          hasValue ? 'text-foreground' : 'text-muted-foreground/60',
          isLong && !expanded && 'text-right truncate cursor-pointer hover:text-muted-foreground',
          isLong && expanded && 'text-left whitespace-pre-wrap break-words cursor-pointer hover:text-muted-foreground',
          !isLong && 'text-right',
        )}
        onClick={isLong ? () => setExpanded((v) => !v) : undefined}
        title={isLong ? (expanded ? 'Click to collapse' : 'Click to expand') : undefined}
      >
        {text}
      </div>
    </div>
  )
}

export { ReadField }
export type { ReadFieldProps }
