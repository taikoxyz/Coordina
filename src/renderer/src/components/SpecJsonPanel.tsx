import { useTeam } from '../hooks/useTeams'
import { highlightContent } from '../lib/highlight'

export function SpecJsonPanel({
  teamSlug,
  agentSlug,
}: {
  teamSlug: string
  agentSlug?: string
}) {
  const { data: spec } = useTeam(teamSlug)

  if (!spec) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-gray-400">
        Loading...
      </div>
    )
  }

  const data = agentSlug
    ? spec.agents.find((a) => a.slug === agentSlug) ?? null
    : spec

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-gray-400">
        Agent not found.
      </div>
    )
  }

  const json = JSON.stringify(data, null, 2)

  return (
    <div className="flex-1 overflow-auto p-6">
      <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap break-words max-w-3xl">
        {highlightContent(json, 'spec.json')}
      </pre>
    </div>
  )
}
