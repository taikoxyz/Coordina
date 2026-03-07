import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useNav } from '../store/nav'
import { useSaveTeam } from '../hooks/useTeams'
import type { TeamSpec } from '../../../shared/types'

const toSlug = (name: string) =>
  'team-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export function CreateTeamDialog() {
  const { isCreateTeamOpen, setCreateTeamOpen, selectTeam } = useNav()
  const saveTeam = useSaveTeam()
  const [name, setName] = useState('')
  const slug = name.trim() ? toSlug(name) : ''

  const handleCreate = async () => {
    if (!name.trim() || !slug) return
    const newSpec: TeamSpec = { slug, name: name.trim(), agents: [] }
    await saveTeam.mutateAsync(newSpec)
    selectTeam(slug)
    setCreateTeamOpen(false)
    setName('')
  }

  return (
    <Dialog.Root
      open={isCreateTeamOpen}
      onOpenChange={(open) => {
        setCreateTeamOpen(open)
        if (!open) setName('')
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-lg bg-white p-6 shadow-xl focus:outline-none">
          <div className="flex items-center justify-between mb-5">
            <Dialog.Title className="text-sm font-semibold text-gray-900">
              Create team
            </Dialog.Title>
            <Dialog.Close className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
              <X className="w-4 h-4" />
            </Dialog.Close>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Team name
              </label>
              <input
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              <button
                onClick={() => void handleCreate()}
                disabled={!name.trim() || !slug || saveTeam.isPending}
                className="px-4 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saveTeam.isPending ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
