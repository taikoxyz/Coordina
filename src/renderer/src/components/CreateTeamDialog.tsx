import { useState } from 'react'
import { useNav } from '../store/nav'
import { useSaveTeam } from '../hooks/useTeams'
import type { TeamSpec } from '../../../shared/types'
import { Button, Input, Label, DialogShell } from './ui'

const toSlug = (name: string) =>
  'team-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export function CreateTeamDialog() {
  const { isCreateDialogOpen, setCreateDialogOpen, selectItem } = useNav()
  const saveTeam = useSaveTeam()
  const [name, setName] = useState('')
  const slug = name.trim() ? toSlug(name) : ''
  const isOpen = isCreateDialogOpen === 'teams'

  const handleCreate = async () => {
    if (!name.trim() || !slug) return
    const newSpec: TeamSpec = { slug, name: name.trim(), agents: [] }
    await saveTeam.mutateAsync(newSpec)
    selectItem({ type: 'team', slug })
    setCreateDialogOpen(null)
    setName('')
  }

  return (
    <DialogShell
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setCreateDialogOpen(null)
          setName('')
        }
      }}
      title="Create team"
    >
      <div className="space-y-4">
        <div>
          <Label>Team name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Team"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleCreate()
            }}
          />
          {slug && (
            <div className="mt-1.5 text-xs text-gray-400 font-mono">
              {slug}
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button
            variant="primary"
            onClick={() => void handleCreate()}
            disabled={!name.trim() || !slug || saveTeam.isPending}
          >
            {saveTeam.isPending ? 'Creating...' : 'Create'}
          </Button>
        </div>
      </div>
    </DialogShell>
  )
}
