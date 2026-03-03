import { useState } from 'react'
import { deriveSlug } from '../../../../shared/slug'
import { EnhanceButton } from './EnhanceButton'
import type { AgentRecord } from '../../hooks/useTeams'
import { useProviders } from '../../hooks/useProviders'
import { useModels } from '../../hooks/useModels'

interface AgentFormProps {
  agent?: AgentRecord
  teamSlug: string
  teamDomain?: string
  teamDefaultImage?: string
  hasAiKey: boolean
  forceLead?: boolean
  asPanel?: boolean
  onSave: (data: Omit<AgentRecord, 'teamSlug'>) => void
  onClose: () => void
}

function autoEmail(teamSlug: string, agentSlug: string, domain: string) {
  return `${teamSlug}-${agentSlug}@${domain}`
}

export function AgentForm({ agent, teamSlug, teamDomain, teamDefaultImage, hasAiKey, forceLead, asPanel, onSave, onClose }: AgentFormProps) {
  const { data: providers } = useProviders()

  const [name, setName] = useState(agent?.name ?? '')
  const [slug, setSlug] = useState(agent?.slug ?? '')
  const slugLocked = !!agent
  const [role, setRole] = useState(agent?.role ?? '')
  const [email, setEmail] = useState(agent?.email ?? '')
  const [emailManual, setEmailManual] = useState(!!agent?.email)
  const [slackHandle, setSlackHandle] = useState(agent?.slackHandle ?? '')
  const [githubId, setGithubId] = useState(agent?.githubId ?? '')
  const [skills, setSkills] = useState<string[]>(agent?.skills ?? [])
  const [skillInput, setSkillInput] = useState('')
  const [soul, setSoul] = useState(agent?.soul ?? '')
  const [providerId, setProviderId] = useState(agent?.providerId ?? '')
  const [model, setModel] = useState(agent?.model ?? '')
  const [image, setImage] = useState(agent?.image ?? '')
  const selectedProviderType = providers?.find(p => p.id === providerId)?.type ?? ''
  const { data: models, isLoading: modelsLoading } = useModels(selectedProviderType)
  const isLead = forceLead ?? agent?.isLead ?? false

  function handleNameChange(val: string) {
    setName(val)
    if (!slugLocked) {
      const newSlug = deriveSlug(val)
      setSlug(newSlug)
      if (!emailManual && teamDomain) setEmail(autoEmail(teamSlug, newSlug, teamDomain))
    }
  }

  function handleEmailChange(val: string) {
    setEmail(val)
    setEmailManual(true)
  }

  function addSkill() {
    const trimmed = skillInput.trim()
    if (trimmed && !skills.includes(trimmed)) {
      setSkills([...skills, trimmed])
      setSkillInput('')
    }
  }

  function removeSkill(s: string) {
    setSkills(skills.filter(sk => sk !== s))
  }

  async function enhanceSoul(): Promise<string> {
    const result = await window.api.invoke('ai:enhanceSoul', role, soul) as string
    return result
  }

  async function enhanceSkills(): Promise<string> {
    const result = await window.api.invoke('ai:enhanceSkills', role, skills) as string[]
    return result.join(', ')
  }

  const formFields = (
    <div className="space-y-4">
      {/* Name + Slug */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Name *</label>
          <input type="text" value={name} onChange={e => handleNameChange(e.target.value)}
            placeholder="Alice Chen"
            className="w-full rounded bg-gray-700 border border-gray-600 text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">
            Slug * {slugLocked && <span className="text-gray-500">(locked)</span>}
          </label>
          <input type="text" value={slug} readOnly={slugLocked} onChange={e => setSlug(e.target.value)}
            className="w-full rounded bg-gray-700 border border-gray-600 text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono disabled:opacity-60"
            style={{ cursor: slugLocked ? 'not-allowed' : undefined }} />
        </div>
      </div>

      {/* Role */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">Role *</label>
        <input type="text" value={role} onChange={e => setRole(e.target.value)}
          placeholder="e.g. Senior Engineer"
          className="w-full rounded bg-gray-700 border border-gray-600 text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
      </div>

      {/* Contact fields */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Email', val: email, set: handleEmailChange, ph: teamDomain ? autoEmail(teamSlug, slug || 'agent', teamDomain) : 'alice@co.com' },
          { label: 'Slack', val: slackHandle, set: setSlackHandle, ph: '@alice' },
          { label: 'GitHub', val: githubId, set: setGithubId, ph: 'alice-dev' },
        ].map(f => (
          <div key={f.label}>
            <label className="block text-xs font-medium text-gray-400 mb-1">{f.label}</label>
            <input type="text" value={f.val} onChange={e => f.set(e.target.value)}
              placeholder={f.ph}
              className="w-full rounded bg-gray-700 border border-gray-600 text-gray-100 px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
        ))}
      </div>

      {/* Model Provider */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">Model Provider</label>
        <select value={providerId} onChange={e => { setProviderId(e.target.value); setModel('') }}
          className="w-full rounded bg-gray-700 border border-gray-600 text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
          <option value="">— select provider —</option>
          {providers?.map(p => <option key={p.id} value={p.id}>{p.name} ({p.type})</option>)}
        </select>
      </div>

      {/* Model */}
      {providerId && (
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Model</label>
          {modelsLoading ? (
            <div className="text-xs text-gray-500 py-2">Loading models...</div>
          ) : models && models.length > 0 ? (
            <select
              value={model}
              onChange={e => setModel(e.target.value)}
              className="w-full rounded bg-gray-700 border border-gray-600 text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">— use provider default —</option>
              {models.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name}{m.contextWindow ? ` (${Math.round(m.contextWindow / 1000)}k ctx)` : ''}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={model}
              onChange={e => setModel(e.target.value)}
              placeholder="e.g. llama3.2, mistral"
              className="w-full rounded bg-gray-700 border border-gray-600 text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          )}
        </div>
      )}

      {/* Container Image */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">Container Image</label>
        <input type="text" value={image} onChange={e => setImage(e.target.value)}
          placeholder={teamDefaultImage || 'e.g. alpine/openclaw:latest'}
          className="w-full rounded bg-gray-700 border border-gray-600 text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono" />
        <p className="text-xs text-gray-500 mt-0.5">
          {teamDefaultImage
            ? <>Leave blank to use team default: <span className="font-mono text-gray-400">{teamDefaultImage}</span></>
            : 'Docker image used when deploying this agent to GKE'}
        </p>
      </div>

      {/* Skills */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium text-gray-400">Skills</label>
          {hasAiKey && (
            <EnhanceButton
              label="Suggest skills"
              currentValue={skills.join(', ')}
              onEnhance={enhanceSkills}
              onAccept={val => setSkills(val.split(',').map(s => s.trim()).filter(Boolean))}
            />
          )}
        </div>
        <div className="flex gap-2 mb-2">
          <input type="text" value={skillInput} onChange={e => setSkillInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill() } }}
            placeholder="Add a skill, press Enter"
            className="flex-1 rounded bg-gray-700 border border-gray-600 text-gray-100 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
          <button onClick={addSkill} type="button"
            className="px-3 py-1.5 rounded bg-gray-600 hover:bg-gray-500 text-sm text-gray-200">Add</button>
        </div>
        {skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {skills.map(s => (
              <span key={s} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-700 text-xs text-gray-300">
                {s}
                <button onClick={() => removeSkill(s)} className="text-gray-500 hover:text-gray-200">×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Soul */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium text-gray-400">Personality / Soul</label>
          {hasAiKey && (
            <EnhanceButton
              currentValue={soul}
              onEnhance={enhanceSoul}
              onAccept={setSoul}
            />
          )}
        </div>
        <textarea value={soul} onChange={e => setSoul(e.target.value)}
          placeholder="Describe this agent's personality and working style..."
          rows={4}
          className="w-full rounded bg-gray-700 border border-gray-600 text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none" />
      </div>
    </div>
  )

  const saveButton = (
    <button
      onClick={() => onSave({ slug, name, role, email, slackHandle, githubId, skills, soul, providerId, model, image: image || undefined, isLead })}
      disabled={!name || !slug || !role}
      className="px-4 py-2 rounded text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white transition-colors">
      {agent ? 'Save Changes' : forceLead ? 'Add Lead Agent' : 'Add Agent'}
    </button>
  )

  if (asPanel) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 flex-shrink-0">
          <span className="font-medium text-white text-sm">
            {agent ? 'Edit Agent' : forceLead ? 'Add Lead Agent' : 'Add Agent'}
          </span>
          <button onClick={onClose} className="text-gray-400 hover:text-white">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {formFields}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-700 flex-shrink-0">
          <button onClick={onClose}
            className="px-4 py-2 rounded text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors">
            Cancel
          </button>
          {saveButton}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-gray-100 mb-5">
          {agent ? 'Edit Agent' : forceLead ? 'Add Lead Agent' : 'Add Agent'}
        </h2>

        {formFields}

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose}
            className="px-4 py-2 rounded text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors">
            Cancel
          </button>
          {saveButton}
        </div>
      </div>
    </div>
  )
}
