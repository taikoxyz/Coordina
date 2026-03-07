import * as React from 'react'

import { cn } from '@renderer/lib/utils'

function Textarea({
  className,
  mono,
  ...props
}: React.ComponentProps<'textarea'> & { mono?: boolean }) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none resize-none',
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

export { Textarea }
