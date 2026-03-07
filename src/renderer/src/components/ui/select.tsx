import * as React from 'react'

import { cn } from '@renderer/lib/utils'

function Select({
  className,
  mono,
  ...props
}: React.ComponentProps<'select'> & { mono?: boolean }) {
  return (
    <select
      data-slot="select"
      className={cn(
        'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-xs transition-[color,box-shadow] outline-none',
        'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
        'disabled:pointer-events-none disabled:opacity-50',
        mono && 'font-mono',
        className,
      )}
      {...props}
    />
  )
}

export { Select }
