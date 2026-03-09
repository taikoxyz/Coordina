import { useEffect, useState } from 'react'
import { useTeam, useSaveTeam, useDeleteTeam } from '../hooks/useTeams'
import { useNav } from '../store/nav'
import { SpecEditor } from './SpecEditor'
import type { TeamSpec } from '../../../shared/types'

export function TeamSpecPanel({ slug }: { slug: string }) {
  const { data: savedSpec } = useTeam(slug)
  const saveTeam = useSaveTeam()
  const deleteTeam = useDeleteTeam()
  const [localSpec, setLocalSpec] = useState<TeamSpec | null>(null)
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    if (savedSpec) {
      setLocalSpec(savedSpec)
      setIsEditing(false)
    }
  }, [savedSpec])

  if (!localSpec) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-gray-400">
        Loading team...
      </div>
    )
  }

  return (
    <SpecEditor
      spec={localSpec}
      onSpecChange={setLocalSpec}
      isEditing={isEditing}
      onEdit={() => setIsEditing(true)}
      onCancel={() => {
        setLocalSpec(savedSpec ?? null)
        setIsEditing(false)
      }}
      onSave={async () => {
        if (localSpec) await saveTeam.mutateAsync(localSpec)
        setIsEditing(false)
      }}
      onDelete={async () => {
        await deleteTeam.mutateAsync(slug)
        useNav.setState({ selectedItem: null })
      }}
      isSaving={saveTeam.isPending}
    />
  )
}
