import * as React from 'react'

import { cn } from '@renderer/lib/utils'

function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card"
      className={cn('border-b border-border bg-card', className)}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-content"
      className={cn('p-5 space-y-4', className)}
      {...props}
    />
  )
}

export { Card, CardContent }
