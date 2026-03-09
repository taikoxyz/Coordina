import { useMemo } from 'react'
import { createAvatar } from '@dicebear/core'
import * as bottts from '@dicebear/bottts-neutral'
import { cn } from '../lib/utils'
import { agentHexColor } from '../lib/agentColors'

interface AgentAvatarProps {
  slug: string
  colorIndex: number
  size?: number
  className?: string
}

export function AgentAvatar({ slug, colorIndex, size = 20, className }: AgentAvatarProps) {
  const svgDataUrl = useMemo(() => {
    const avatar = createAvatar(bottts, { seed: slug, size, backgroundColor: [agentHexColor(colorIndex)] })
    const svg = avatar.toString()
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  }, [slug, size, colorIndex])

  return (
    <img
      src={svgDataUrl}
      alt={slug}
      width={size}
      height={size}
      className={cn('rounded shrink-0', className)}
      draggable={false}
    />
  )
}
