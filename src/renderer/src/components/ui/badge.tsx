import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@renderer/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 font-medium whitespace-nowrap',
  {
    variants: {
      variant: {
        default: 'bg-secondary text-secondary-foreground',
        primary: 'bg-blue-50 text-blue-600',
        success: 'bg-success-foreground text-green-600',
        destructive: 'bg-destructive/10 text-destructive',
        warning: 'bg-warning-foreground text-yellow-700',
        outline: 'border text-foreground',
      },
      size: {
        sm: 'text-xs px-1.5 py-0.5 rounded',
        default: 'text-xs px-2 py-0.5 rounded-full',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

function Badge({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
