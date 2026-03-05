// Inline editable agent row for team spec form without modals or dialogs
// FEATURE: Agent editor component using inline expand pattern for dense layout
import { useEffect, useState } from 'react'
import type { AgentSpec } from '../../../../shared/types'
import { deriveSlug } from '../../../../shared/slug'

interface Props {
  teamSlug: string
  agent: AgentSpec
  isFirst: boolean
  providerSlugs: string[]
  onChange: (updated: AgentSpec) => void
  onDelete: () => void
}

const fieldRow = (label: string, value: string, onChange: (v: string) => void, opts?: { mono?: boolean; multiline?: boolean; placeholder?: string }) => (
  <div className="flex items-start gap-2">
    <label className="text-[10px] text-gray-500 w-20 shrink-0 pt-0.5">{label}</label>
    {opts?.multiline ? (
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={opts.placeholder}
        rows={3}
        className={`flex-1 bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-[11px] text-gray-200 resize-none focus:outline-none focus:border-blue-600 ${opts.mono ? 'font-mono' : ''}`}
      />
    ) : (
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={opts?.placeholder}
        className={`flex-1 bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-[11px] text-gray-200 focus:outline-none focus:border-blue-600 ${opts?.mono ? 'font-mono' : ''}`}
      />
    )}
  </div>
)

export function AgentRow({ teamSlug, agent, isFirst, providerSlugs, onChange, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [telegramToken, setTelegramToken] = useState('')
  const [tokenMasked, setTokenMasked] = useState<string | null>(null)
  const [tokenBusy, setTokenBusy] = useState(false)
  const [tokenError, setTokenError] = useState<string | null>(null)
  const set = (key: keyof AgentSpec) => (value: unknown) => onChange({ ...agent, [key]: value })

  const handleNameChange = (name: string) => {
    onChange({ ...agent, name, slug: name ? deriveSlug(name) : '' })
  }

  useEffect(() => {
    if (!teamSlug || !agent.slug) return
    let active = true
    window.api.invoke('teams:getAgentTelegramTokenMasked', { teamSlug, agentSlug: agent.slug })
      .then((value) => { if (active) setTokenMasked((value as string | null) ?? null) })
      .catch((e) => { if (active) setTokenError((e as Error).message) })
    return () => { active = false }
  }, [teamSlug, agent.slug])

  const saveToken = async () => {
    setTokenBusy(true)
    setTokenError(null)
    try {
      await window.api.invoke('teams:setAgentTelegramToken', { teamSlug, agentSlug: agent.slug, token: telegramToken }) as { ok: boolean }
      const masked = await window.api.invoke('teams:getAgentTelegramTokenMasked', { teamSlug, agentSlug: agent.slug }) as string | null
      setTokenMasked(masked)
      setTelegramToken('')
    } catch (e) {
      setTokenError((e as Error).message)
    } finally {
      setTokenBusy(false)
    }
  }

  const clearToken = async () => {
    setTokenBusy(true)
    setTokenError(null)
    try {
      await window.api.invoke('teams:setAgentTelegramToken', { teamSlug, agentSlug: agent.slug, token: '' }) as { ok: boolean }
      setTokenMasked(null)
      setTelegramToken('')
    } catch (e) {
      setTokenError((e as Error).message)
    } finally {
      setTokenBusy(false)
    }
  }

  return (
    <div className="border border-gray-700/60 rounded">
      <div className="flex items-center gap-2 px-2 py-1">
        <span className="text-[10px] text-gray-500">{isFirst ? '●' : '·'}</span>
        <span className="text-[11px] text-gray-200 flex-1 truncate">{agent.name || 'Unnamed agent'}</span>
        <span className="text-[10px] text-gray-600 font-mono truncate max-w-[80px]">{agent.providerSlug}</span>
        {tokenMasked && (
          <span className="text-[9px] px-1.5 py-0.5 rounded border border-green-800/60 text-green-300">
            tg token ✓
          </span>
        )}
        <button onClick={() => setExpanded(e => !e)} className="text-[9px] text-gray-600 hover:text-gray-400 px-1">{expanded ? '▲' : '▼'}</button>
        <button onClick={onDelete} className="text-[10px] text-red-700 hover:text-red-500 px-1">✕</button>
      </div>

      {expanded && (
        <div className="px-2 pb-2 space-y-1.5 border-t border-gray-700/40 pt-1.5">
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-gray-500 w-20 shrink-0">name</label>
            <div className="flex-1 min-w-0">
              <input
                type="text"
                value={agent.name}
                onChange={e => handleNameChange(e.target.value)}
                placeholder="Alice"
                className="w-full bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-[11px] text-gray-200 focus:outline-none focus:border-blue-600"
              />
              {agent.slug && (
                <p className="text-[10px] text-gray-600 font-mono mt-0.5 truncate">{agent.slug}</p>
              )}
            </div>
          </div>
          {fieldRow('role', agent.role, set('role'), { placeholder: 'Researcher' })}
          {fieldRow('emoji', agent.emoji ?? '', v => set('emoji')(v || undefined), { placeholder: '🤖' })}
          {fieldRow('avatar', agent.avatar ?? '', v => set('avatar')(v || undefined), { placeholder: '/avatar.png or https://…' })}
          {fieldRow('telegram id', agent.telegramBotId ?? '', v => set('telegramBotId')(v || undefined), { mono: true, placeholder: '123456789' })}
          <div className="flex items-start gap-2">
            <label className="text-[10px] text-gray-500 w-20 shrink-0 pt-0.5">telegram token</label>
            <div className="flex-1 min-w-0 space-y-1">
              <input
                type="password"
                value={telegramToken}
                onChange={e => setTelegramToken(e.target.value)}
                placeholder={tokenMasked ? 'Update token' : '123456:ABC...'}
                className="w-full bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-[11px] text-gray-200 focus:outline-none focus:border-blue-600 font-mono"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={saveToken}
                  disabled={tokenBusy || !teamSlug || !agent.slug}
                  className="text-[10px] px-2 py-0.5 bg-blue-700 hover:bg-blue-600 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded"
                >
                  {tokenBusy ? 'Saving…' : 'Save token'}
                </button>
                <button
                  type="button"
                  onClick={clearToken}
                  disabled={tokenBusy || !tokenMasked}
                  className="text-[10px] px-2 py-0.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-200 rounded"
                >
                  Clear
                </button>
                {tokenMasked && <span className="text-[10px] text-gray-500 font-mono">{tokenMasked}</span>}
              </div>
              {tokenError && <p className="text-[10px] text-red-400">{tokenError}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-gray-500 w-20 shrink-0">provider</label>
            <select
              value={agent.providerSlug}
              onChange={e => set('providerSlug')(e.target.value)}
              className="flex-1 bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-[11px] text-gray-200 focus:outline-none focus:border-blue-600"
            >
              <option value="">— select —</option>
              {providerSlugs.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {fieldRow('image', agent.image ?? '', v => set('image')(v || undefined), { mono: true, placeholder: 'ghcr.io/org/openclaw:latest' })}
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-gray-500 w-20 shrink-0">cpu</label>
            <input
              type="number"
              min={0.1}
              step={0.5}
              value={agent.cpu ?? ''}
              onChange={e => set('cpu')(e.target.value ? parseFloat(e.target.value) : undefined)}
              placeholder="1 (default)"
              className="w-24 bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-[11px] text-gray-200 focus:outline-none focus:border-blue-600"
            />
            <span className="text-[10px] text-gray-600">cores</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-gray-500 w-20 shrink-0">disk</label>
            <input
              type="number"
              min={1}
              step={1}
              value={agent.storageGi ?? ''}
              onChange={e => set('storageGi')(e.target.value ? parseInt(e.target.value) : undefined)}
              placeholder="10 (default)"
              className="w-24 bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-[11px] text-gray-200 focus:outline-none focus:border-blue-600"
            />
            <span className="text-[10px] text-gray-600">Gi</span>
          </div>
          {fieldRow('soul', agent.soul, set('soul'), { multiline: true, placeholder: "Describe this agent's personality..." })}
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-gray-500 w-20 shrink-0">skills</label>
            <input
              type="text"
              value={agent.skills.join(', ')}
              onChange={e => set('skills')(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              placeholder="research, writing"
              className="flex-1 bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-[11px] text-gray-200 focus:outline-none focus:border-blue-600"
            />
          </div>
          {isFirst && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 w-20 shrink-0">lead</span>
              <span className="text-[10px] text-gray-600">● always lead</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
