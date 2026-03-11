import { useState } from 'react'
import { Pencil, X, Check } from 'lucide-react'
import { useTeam, useSaveTeam } from '../hooks/useTeams'
import { highlightContent } from '../lib/highlight'
import { validateTeamSpec } from '../../../shared/validateTeamSpec'
import { validateJsonEdit } from '../../../shared/validateJsonEdit'
import type { TeamSpec } from '../../../shared/types'

export function SpecJsonPanel({
  teamSlug,
  agentSlug,
}: {
  teamSlug: string
  agentSlug?: string
}) {
  const { data: spec } = useTeam(teamSlug)
  const saveTeam = useSaveTeam()
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const [errors, setErrors] = useState<string[]>([])

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
  const isTeamLevel = !agentSlug

  const handleEdit = () => {
    setEditText(json)
    setErrors([])
    setEditing(true)
  }

  const handleCancel = () => {
    setEditing(false)
    setErrors([])
  }

  const handleSave = () => {
    const errs: string[] = []

    let parsed: TeamSpec
    try {
      parsed = JSON.parse(editText)
    } catch (e) {
      setErrors([`Invalid JSON: ${(e as Error).message}`])
      return
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      setErrors(['JSON must be an object'])
      return
    }

    const structResult = validateTeamSpec(parsed)
    if (!structResult.valid) {
      errs.push(...structResult.errors.map((e) => `${e.field}: ${e.message}`))
    }

    const editResult = validateJsonEdit(spec, parsed)
    if (!editResult.valid) {
      errs.push(...editResult.errors)
    }

    if (errs.length > 0) {
      setErrors(errs)
      return
    }

    saveTeam.mutate(parsed, {
      onSuccess: () => {
        setEditing(false)
        setErrors([])
      },
      onError: (err) => {
        setErrors([`Save failed: ${(err as Error).message}`])
      },
    })
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <div className="flex items-center justify-end gap-2 px-6 pt-4 pb-2 shrink-0">
        {editing ? (
          <>
            <button
              onClick={handleCancel}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saveTeam.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-md transition-colors disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" />
              {saveTeam.isPending ? 'Saving...' : 'Save'}
            </button>
          </>
        ) : (
          isTeamLevel && (
            <button
              onClick={handleEdit}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </button>
          )
        )}
      </div>

      {errors.length > 0 && (
        <div className="mx-6 mb-2 p-3 bg-red-50 border border-red-200 rounded-md shrink-0">
          {errors.map((err, i) => (
            <p key={i} className="text-xs text-red-700">
              {err}
            </p>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-auto px-6 pb-6">
        {editing ? (
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            spellCheck={false}
            className="w-full h-full text-xs font-mono text-gray-700 bg-gray-50 border border-gray-200 rounded-md p-4 resize-none focus:outline-none focus:ring-2 focus:ring-gray-300 max-w-3xl"
          />
        ) : (
          <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap break-words max-w-3xl">
            {highlightContent(json, 'spec.json')}
          </pre>
        )}
      </div>
    </div>
  )
}
