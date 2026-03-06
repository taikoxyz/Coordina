// Structured form for editing team spec fields inline without dialogs
// FEATURE: Team spec editor left panel with agents list and inline field editing
import { useCallback } from 'react'
import { useSaveTeam } from '../../hooks/useTeams'
import { useProviders } from '../../hooks/useProviders'
import { useSettings } from '../../hooks/useSettings'
import { AgentRow } from './AgentRow'
import type { TeamSpec, AgentSpec } from '../../../../shared/types'
import {
  DEFAULT_AGENT_NAME_THEME,
  generateAutoAgentIdentities,
} from '../../../../shared/agentNames'

interface Props {
  spec: TeamSpec
  onSpecChange: (spec: TeamSpec) => void
}

const inputCls = 'bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-[11px] text-gray-200 focus:outline-none focus:border-blue-600 w-full font-mono'
const labelCls = 'text-[10px] text-gray-500 block mb-0.5'

export function SpecForm({ spec, onSpecChange }: Props) {
  const saveTeam = useSaveTeam()
  const { data: providers } = useProviders()
  const { data: settings } = useSettings()
  const providerSlugs = (providers ?? []).map(p => p.slug)

  const set = useCallback((key: keyof TeamSpec) => (value: unknown) => {
    onSpecChange({ ...spec, [key]: value })
  }, [spec, onSpecChange])

  const applyAgents = (agents: AgentSpec[]) => {
    onSpecChange({ ...spec, agents, leadAgent: agents[0]?.slug || undefined })
  }

  const addAutoAgents = (count: number) => {
    const generated = generateAutoAgentIdentities(
      spec.agents,
      count,
      settings?.agentNameTheme ?? DEFAULT_AGENT_NAME_THEME,
    )
    if (!generated.length) return

    const newAgents: AgentSpec[] = generated.map((identity) => ({
      slug: identity.slug,
      name: identity.name,
      role: '',
      provider: '',
      skills: [],
      persona: '',
    }))

    applyAgents([...spec.agents, ...newAgents])
  }

  const updateAgent = (i: number, updated: AgentSpec) => {
    const agents = [...spec.agents]
    agents[i] = updated
    applyAgents(agents)
  }

  const deleteAgent = (i: number) => {
    applyAgents(spec.agents.filter((_, j) => j !== i))
  }

  const handleSave = () => saveTeam.mutate(spec)

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-3 py-2 border-b border-gray-700/60 flex items-center justify-between">
        <span className="text-[11px] text-gray-400 font-medium">Team Spec</span>
        <button
          onClick={handleSave}
          disabled={saveTeam.isPending}
          className="text-[10px] px-2 py-0.5 bg-blue-700 hover:bg-blue-600 disabled:bg-gray-700 text-white rounded transition-colors"
        >
          {saveTeam.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2.5">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelCls}>name</label>
            <input className={inputCls} value={spec.name} onChange={e => set('name')(e.target.value)} placeholder="My Team" />
          </div>
          <div>
            <label className={labelCls}>slug</label>
            <input className={inputCls} value={spec.slug} onChange={e => set('slug')(e.target.value)} placeholder="my-team" />
          </div>
        </div>

        <div>
          <label className={labelCls}>telegram group id</label>
          <input
            className={inputCls}
            value={spec.telegramGroupId ?? ''}
            onChange={e => set('telegramGroupId')(e.target.value || undefined)}
            placeholder="-1001234567890"
          />
        </div>

        <div>
          <label className={labelCls}>telegram admin id</label>
          <input
            className={inputCls}
            value={spec.telegramAdminId ?? ''}
            onChange={e => set('telegramAdminId')(e.target.value || undefined)}
            placeholder="123456789"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelCls}>default image</label>
            <input className={inputCls} value={spec.defaultImage ?? ''} onChange={e => set('defaultImage')(e.target.value || undefined)} placeholder="ghcr.io/org/openclaw:latest" />
          </div>
          <div>
            <label className={labelCls}>storage (Gi)</label>
            <input
              type="number"
              min={1}
              className={inputCls}
              value={spec.defaultDiskGi ?? ''}
              onChange={e => set('defaultDiskGi')(e.target.value ? parseInt(e.target.value, 10) : undefined)}
              placeholder="100"
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>startup instructions</label>
          <textarea
            className="bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-[11px] text-gray-200 focus:outline-none focus:border-blue-600 w-full resize-none font-mono"
            rows={3}
            value={spec.startupInstructions ?? ''}
            onChange={e => set('startupInstructions')(e.target.value || undefined)}
            placeholder="Custom startup instructions..."
          />
        </div>

        <div>
          <div className="mb-1.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider">Agents ({spec.agents.length})</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => addAutoAgents(1)}
                  className="text-[10px] px-1.5 py-0.5 rounded border border-blue-600/60 text-blue-300 hover:border-blue-500 hover:text-blue-200 transition-colors"
                >
                  +1 auto
                </button>
                <button
                  onClick={() => addAutoAgents(10)}
                  className="text-[10px] px-1.5 py-0.5 rounded border border-blue-600/60 text-blue-300 hover:border-blue-500 hover:text-blue-200 transition-colors"
                >
                  +10 auto
                </button>
              </div>
            </div>
          </div>
          <div className="space-y-1">
            {spec.agents.map((agent, i) => (
              <AgentRow
                key={i}
                teamSlug={spec.slug}
                agent={agent}
                isFirst={i === 0}
                providerSlugs={providerSlugs}
                onChange={updated => updateAgent(i, updated)}
                onDelete={() => deleteAgent(i)}
              />
            ))}
          </div>
        </div>
      </div>
      {saveTeam.error && (
        <div className="px-3 py-1.5 border-t border-red-800/50 text-[10px] text-red-300">
          {(saveTeam.error as Error).message}
        </div>
      )}
    </div>
  )
}
