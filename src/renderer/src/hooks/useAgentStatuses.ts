// Hook for polling agent readiness status from the deployment environment
// FEATURE: Agent readiness probe to gate chat and file browser interactions
import { useState, useEffect } from 'react'
import type { AgentStatus } from '../../../shared/types'

const POLL_INTERVAL_MS = 30_000

export const useAgentStatuses = (
  teamSlug: string,
  envSlug: string | undefined,
): { statuses: Map<string, AgentStatus['status']>; isLoading: boolean } => {
  const [statuses, setStatuses] = useState<Map<string, AgentStatus['status']>>(new Map())
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!envSlug) {
      setStatuses(new Map())
      return
    }

    let cancelled = false

    const poll = async () => {
      setIsLoading(true)
      try {
        const result = await window.api.invoke('deploy:getStatus', { teamSlug, envSlug }) as AgentStatus[]
        if (!cancelled) {
          setStatuses(new Map(result.map((s) => [s.agentSlug, s.status])))
        }
      } catch {
        // leave previous statuses on error
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void poll()
    const interval = setInterval(() => { void poll() }, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [teamSlug, envSlug])

  return { statuses, isLoading }
}
