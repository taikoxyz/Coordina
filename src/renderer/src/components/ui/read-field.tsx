import { useState } from 'react'
import { cn } from '@renderer/lib/utils'

interface ReadFieldProps {
  label: string
  value?: string | number
  monospace?: boolean
  defaultValue?: string | number
  full?: boolean
  tooltip?: string
}

const LONG_THRESHOLD = 60

function ReadField({ label, value, monospace = false, defaultValue, full = false, tooltip }: ReadFieldProps) {
  const hasValue = value !== undefined && value !== null && `${value}`.trim().length > 0
  const displayText = hasValue ? `${value}` : defaultValue !== undefined ? `${defaultValue}` : undefined
  const isDefault = !hasValue && defaultValue !== undefined
  const isLong = hasValue && !!displayText && displayText.length > LONG_THRESHOLD
  const [expanded, setExpanded] = useState(false)

  if (full) {
    return (
      <div className="py-0.5">
        <div className="text-xs font-medium text-muted-foreground mb-0.5" title={tooltip}>
          {label}{tooltip && <span className="text-gray-300 cursor-help ml-0.5">ⓘ</span>}
        </div>
        <div
          className={cn(
            'text-sm text-left whitespace-pre-wrap break-words px-2 py-1.5 rounded-sm bg-gray-50 min-h-[60px]',
            hasValue ? 'text-foreground' : 'text-muted-foreground/60',
            monospace && 'font-mono text-xs',
          )}
        >
          {displayText ?? <span className="italic">—</span>}
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-baseline justify-between gap-4 py-0.5">
      <div className="text-xs font-medium text-muted-foreground shrink-0">
        {label}
      </div>
      <div
        className={cn(
          'text-sm',
          hasValue ? 'text-foreground' : 'text-muted-foreground/60',
          isLong && !expanded && 'text-right truncate cursor-pointer hover:text-muted-foreground',
          isLong && expanded && 'text-left whitespace-pre-wrap break-words cursor-pointer hover:text-muted-foreground',
          !isLong && 'text-right',
        )}
        onClick={isLong ? () => setExpanded((v) => !v) : undefined}
        title={isLong ? (expanded ? 'Click to collapse' : 'Click to expand') : undefined}
      >
        {displayText !== undefined
          ? <>{displayText}{isDefault && <span className="text-muted-foreground/50 text-xs ml-1">(default)</span>}</>
          : <span className="italic text-muted-foreground/40">—</span>
        }
      </div>
    </div>
  )
}

export { ReadField }
export type { ReadFieldProps }
