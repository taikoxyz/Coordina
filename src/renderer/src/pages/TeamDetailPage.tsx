// Team detail page with split view: spec form left, live JSON and status right
// FEATURE: Team management page with dense MaxClaw-inspired no-dialog layout
import { useState, useEffect } from 'react'
import { useTeam, useSaveTeam } from '../hooks/useTeams'
import { useNav } from '../store/nav'
import { SpecForm } from '../components/spec/SpecForm'
import { StatusPanel } from '../components/spec/StatusPanel'
import type { TeamSpec } from '../../../shared/types'

interface Props {
  teamSlug: string
}

export function TeamDetailPage({ teamSlug }: Props) {
  const { data: savedSpec, isLoading } = useTeam(teamSlug)
  const [localSpec, setLocalSpec] = useState<TeamSpec | null>(null)
  const { setPage } = useNav()
  const saveTeam = useSaveTeam()

  useEffect(() => {
    if (savedSpec) setLocalSpec(savedSpec)
  }, [savedSpec])

  if (isLoading) return <div className="p-4 text-[11px] text-gray-500">Loading…</div>
  if (!localSpec) return <div className="p-4 text-[11px] text-gray-500">Team not found.</div>

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-1.5 border-b border-gray-700/60 flex items-center gap-2">
        <button onClick={() => setPage('teams')} className="text-[10px] text-gray-600 hover:text-gray-400">← Teams</button>
        <span className="text-[10px] text-gray-600">/</span>
        <span className="text-[11px] text-gray-200">{localSpec.name || localSpec.slug}</span>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-[40%] min-w-0 overflow-hidden border-r border-gray-700/60">
          <SpecForm spec={localSpec} onSpecChange={setLocalSpec} />
        </div>
        <div className="flex-1 min-w-0 overflow-hidden">
          <StatusPanel
            spec={localSpec}
            onSave={() => saveTeam.mutateAsync(localSpec).then(() => undefined)}
            isSaving={saveTeam.isPending}
          />
        </div>
      </div>
    </div>
  )
}
