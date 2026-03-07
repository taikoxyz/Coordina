import * as React from 'react'

import { cn } from '@renderer/lib/utils'

function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return (
    <label
      data-slot="label"
      className={cn(
        'block text-xs font-medium text-muted-foreground mb-1',
        className,
      )}
      {...props}
    />
  )
}

export { Label }
