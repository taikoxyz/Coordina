import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { RefreshCw, Download } from 'lucide-react'
import { useTeam } from '../hooks/useTeams'
import { useGkeConfig } from '../hooks/useEnvironments'
import { cn } from '../lib/utils'
import type { AgentLogEntry } from '../../../shared/types'

interface Props {
  teamSlug: string
  agentSlug?: string
}

type LogResult = { ok: true; logs: string } | { ok: true; entries: AgentLogEntry[] } | { ok: false; reason: string }

interface MergedLine {
  agent: string
  text: string
  ts: number
}

const AGENT_COLORS = [
  'text-blue-600', 'text-emerald-600', 'text-violet-600', 'text-amber-600',
  'text-rose-600', 'text-cyan-600', 'text-pink-600', 'text-teal-600',
]

const TS_REGEX = /^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})/

function parseTimestamp(line: string): number {
  const m = line.match(TS_REGEX)
  if (m) { const t = Date.parse(m[1]); if (!isNaN(t)) return t }
  return 0
}

function mergeAndSort(entries: AgentLogEntry[], filter: string | null): MergedLine[] {
  const lines: MergedLine[] = []
  for (const entry of entries) {
    if (filter && entry.agentSlug !== filter) continue
    if (!entry.logs) continue
    for (const line of entry.logs.split('\n')) {
      if (!line) continue
      lines.push({ agent: entry.agentSlug, text: line, ts: parseTimestamp(line) })
    }
  }
  if (lines.some((l) => l.ts > 0)) {
    lines.sort((a, b) => a.ts - b.ts)
  }
  return lines
}

export function LogsPanel({ teamSlug, agentSlug }: Props) {
  const { data: team } = useTeam(teamSlug)
  const { data: gkeConfig } = useGkeConfig()
  const [logs, setLogs] = useState<AgentLogEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [tailLines, setTailLines] = useState(200)
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const logRef = useRef<HTMLPreElement>(null)

  const envSlug = gkeConfig?.slug

  const fetchLogs = useCallback(async () => {
    if (!envSlug) return
    setLoading(true)
    setError(null)
    try {
      if (agentSlug) {
        const result = await window.api.invoke('agent:getLogs', { teamSlug, agentSlug, envSlug, opts: { tailLines } }) as LogResult
        if (!result.ok) { setError((result as { ok: false; reason: string }).reason); setLogs([]); return }
        setLogs([{ agentSlug, logs: (result as { ok: true; logs: string }).logs }])
      } else {
        const result = await window.api.invoke('team:getLogs', { teamSlug, envSlug, opts: { tailLines } }) as LogResult
        if (!result.ok) { setError((result as { ok: false; reason: string }).reason); setLogs([]); return }
        setLogs((result as { ok: true; entries: AgentLogEntry[] }).entries)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [teamSlug, agentSlug, envSlug, tailLines])

  useEffect(() => { void fetchLogs() }, [fetchLogs])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logs, selectedAgent])

  const agentSlugs = agentSlug ? [agentSlug] : (team?.agents.map((a) => a.slug) ?? [])

  const colorMap = useMemo(() => {
    const m = new Map<string, string>()
    agentSlugs.forEach((s, i) => m.set(s, AGENT_COLORS[i % AGENT_COLORS.length]))
    return m
  }, [agentSlugs.join(',')])

  const isTeamView = !agentSlug
  const mergedLines = useMemo(
    () => isTeamView ? mergeAndSort(logs, selectedAgent) : [],
    [logs, selectedAgent, isTeamView],
  )

  if (!gkeConfig) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-gray-400">
        Deploy to a GKE environment to view logs.
      </div>
    )
  }

  const handleDownload = () => {
    let text: string
    if (isTeamView) {
      text = mergedLines.map((l) => `[${l.agent}] ${l.text}`).join('\n')
    } else {
      text = logs[0]?.logs ?? ''
    }
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${teamSlug}${agentSlug ? `-${agentSlug}` : ''}-logs.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 border-b border-gray-200 px-4 py-2 flex items-center gap-3">
        {isTeamView && agentSlugs.length > 1 && (
          <select
            className="h-7 rounded-md border border-gray-200 bg-white px-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400"
            value={selectedAgent ?? ''}
            onChange={(e) => setSelectedAgent(e.target.value || null)}
          >
            <option value="">All agents</option>
            {agentSlugs.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}

        <select
          className="h-7 rounded-md border border-gray-200 bg-white px-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400"
          value={tailLines}
          onChange={(e) => setTailLines(parseInt(e.target.value))}
        >
          <option value={50}>50 lines</option>
          <option value={200}>200 lines</option>
          <option value={500}>500 lines</option>
          <option value={1000}>1000 lines</option>
        </select>

        <div className="flex-1" />

        <button
          onClick={handleDownload}
          disabled={(isTeamView ? mergedLines.length : logs.length) === 0}
          className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Download logs"
        >
          <Download className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => void fetchLogs()}
          disabled={loading}
          className={cn(
            'p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors',
            loading && 'animate-spin',
          )}
          title="Refresh"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {error ? (
          <div className="p-4 text-sm text-red-600">{error}</div>
        ) : isTeamView ? (
          mergedLines.length === 0 && !loading ? (
            <div className="flex items-center justify-center h-full text-sm text-gray-400">
              No logs available.
            </div>
          ) : (
            <pre
              ref={logRef}
              className="h-full overflow-auto p-4 text-xs font-mono text-gray-700 bg-gray-50 leading-relaxed"
            >
              {mergedLines.map((line, i) => (
                <div key={i}>
                  <span className={cn('font-semibold', colorMap.get(line.agent))}>[{line.agent}]</span>{' '}
                  {line.text}
                </div>
              ))}
            </pre>
          )
        ) : (
          !logs[0]?.logs && !loading ? (
            <div className="flex items-center justify-center h-full text-sm text-gray-400">
              No logs available.
            </div>
          ) : (
            <pre
              ref={logRef}
              className="h-full overflow-auto p-4 text-xs font-mono text-gray-700 bg-gray-50 leading-relaxed"
            >
              {logs[0]?.logs}
            </pre>
          )
        )}
      </div>
    </div>
  )
}
