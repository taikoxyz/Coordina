import { useState, useEffect } from 'react'
import { deriveSlug } from '../../../../shared/slug'
import { useCreateTeam } from '../../hooks/useTeams'
import { useNav } from '../../store/nav'

interface CreateTeamWizardProps {
  onClose: () => void
  asPanel?: boolean
}

type Step = 'name' | 'repo'

export function CreateTeamWizard({ onClose, asPanel }: CreateTeamWizardProps) {
  const [step, setStep] = useState<Step>('name')
  const [teamName, setTeamName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugManual, setSlugManual] = useState(false)
  const [domain, setDomain] = useState('')
  const [image, setImage] = useState('')
  const [createRepo, setCreateRepo] = useState(true)
  const [errors, setErrors] = useState<string[]>([])
  const [ghConnected, setGhConnected] = useState<boolean | null>(null)

  const createTeam = useCreateTeam()
  const { setPage } = useNav()

  useEffect(() => {
    if (step === 'repo') {
      window.api.invoke('settings:githubAuth:status').then(connected => setGhConnected(!!connected))
    }
  }, [step])

  function handleNameChange(val: string) {
    setTeamName(val)
    if (!slugManual) setSlug(deriveSlug(val))
  }

  function handleSlugChange(val: string) {
    setSlug(val)
    setSlugManual(true)
  }

  async function handleCreate() {
    setErrors([])
    if (!teamName.trim()) { setErrors(['Team name is required']); return }
    if (!slug.trim()) { setErrors(['Slug is required']); return }

    try {
      const result = await createTeam.mutateAsync({ slug, name: teamName, domain: domain.trim() || undefined, image: image.trim() || undefined, createRepo })
      if (!result.ok) { setErrors(result.errors ?? ['Failed to create team']); return }

      onClose()
      setPage('teams', result.slug ?? slug)
    } catch (e) {
      setErrors([(e as Error).message ?? 'Failed to create team'])
    }
  }

  const content = (
    <>
      <h2 className="text-lg font-semibold text-gray-100 mb-4">Create Team</h2>

      {step === 'name' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Team Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={teamName}
              onChange={e => handleNameChange(e.target.value)}
              placeholder="e.g. Engineering Alpha"
              autoFocus
              className="w-full rounded bg-gray-700 border border-gray-600 text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Slug</label>
            <input
              type="text"
              value={slug}
              onChange={e => handleSlugChange(e.target.value)}
              placeholder="e.g. engineering-alpha"
              className="w-full rounded bg-gray-700 border border-gray-600 text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-500 font-mono"
            />
            <p className="text-xs text-gray-500 mt-1">Used as folder name and in URLs. Cannot be changed after creation.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Domain</label>
            <input
              type="text"
              value={domain}
              onChange={e => setDomain(e.target.value)}
              placeholder="e.g. acme.com"
              className="w-full rounded bg-gray-700 border border-gray-600 text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-500 font-mono"
            />
            <p className="text-xs text-gray-500 mt-1">Agent emails will default to <span className="font-mono">[team]-[agent]@domain</span></p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Default Container Image</label>
            <input
              type="text"
              value={image}
              onChange={e => setImage(e.target.value)}
              placeholder="e.g. alpine/openclaw:latest"
              className="w-full rounded bg-gray-700 border border-gray-600 text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-500 font-mono"
            />
            <p className="text-xs text-gray-500 mt-1">All agents will inherit this image unless overridden individually.</p>
          </div>
          {errors.length > 0 && (
            <div className="p-3 bg-red-900/50 border border-red-700 rounded text-sm text-red-300">
              {errors.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          )}
        </div>
      )}

      {step === 'repo' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-300">
            Coordina stores your team's agent configuration files in a private GitHub repo.
          </p>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={createRepo}
              onChange={e => setCreateRepo(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-600 bg-gray-700"
            />
            <div>
              <span className="text-sm font-medium text-gray-200">Create GitHub repo automatically</span>
              <p className="text-xs text-gray-400 mt-0.5">
                Creates a private repo <code className="font-mono">{slug}</code> in your GitHub account.
              </p>
            </div>
          </label>
          {createRepo && ghConnected === false && (
            <div className="p-3 bg-yellow-900/30 border border-yellow-700/50 rounded text-sm text-yellow-300">
              GitHub is not connected.{' '}
              <button
                onClick={() => { onClose(); setPage('settings') }}
                className="underline hover:text-yellow-200 transition-colors"
              >
                Connect it in Settings →
              </button>
            </div>
          )}
          {!createRepo && (
            <p className="text-sm text-yellow-400 bg-yellow-900/30 border border-yellow-700/50 rounded p-3">
              You'll need to connect a GitHub repo manually after team creation.
            </p>
          )}
          {errors.length > 0 && (
            <div className="p-3 bg-red-900/50 border border-red-700 rounded text-sm text-red-300">
              {errors.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-between items-center mt-6">
        {!asPanel && (
          <button
            onClick={onClose}
            className="px-4 py-2 rounded text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
          >
            Cancel
          </button>
        )}
        <div className="flex gap-2">
          {step === 'repo' && (
            <button
              onClick={() => setStep('name')}
              className="px-4 py-2 rounded text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
            >
              Back
            </button>
          )}
          {step === 'name' && (
            <button
              onClick={() => { if (teamName && slug) setStep('repo') }}
              disabled={!teamName || !slug}
              className="px-4 py-2 rounded text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white transition-colors"
            >
              Next
            </button>
          )}
          {step === 'repo' && (
            <button
              onClick={handleCreate}
              disabled={createTeam.isPending}
              className="px-4 py-2 rounded text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white transition-colors"
            >
              {createTeam.isPending ? 'Creating...' : 'Create Team'}
            </button>
          )}
        </div>
      </div>
    </>
  )

  if (asPanel) {
    return content
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md p-6"
        onClick={e => e.stopPropagation()}
      >
        {content}
      </div>
    </div>
  )
}
