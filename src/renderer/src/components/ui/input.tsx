import * as React from 'react'

import { cn } from '@renderer/lib/utils'

function Input({
  className,
  mono,
  type,
  ...props
}: React.ComponentProps<'input'> & { mono?: boolean }) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-xs transition-[color,box-shadow] outline-none',
        'placeholder:text-muted-foreground',
        'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
        'disabled:pointer-events-none disabled:opacity-50',
        mono && 'font-mono',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
