import React from 'react'
import type { AgentRecord } from '../../hooks/useTeams'

interface AgentCardProps {
  agent: AgentRecord
  deploymentStatus?: 'running' | 'pending' | 'crashed' | 'undeployed'
  onEdit: () => void
  onDelete: () => void
  onChat: () => void
  onFiles: () => void
}

const STATUS_CONFIG = {
  running: { dot: 'bg-green-400', label: 'Running' },
  pending: { dot: 'bg-yellow-400', label: 'Starting' },
  crashed: { dot: 'bg-red-400', label: 'Crashed' },
  undeployed: { dot: 'bg-gray-500', label: 'Not deployed' },
}

export function AgentCard({ agent, deploymentStatus = 'undeployed', onEdit, onDelete, onChat, onFiles }: AgentCardProps) {
  const status = STATUS_CONFIG[deploymentStatus]

  return (
    <div className={`bg-gray-800 border rounded-lg p-4 ${agent.isLead ? 'border-blue-700' : 'border-gray-700'}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium text-gray-100">{agent.name}</h3>
            {agent.isLead && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-blue-900 text-blue-300 font-medium">Lead</span>
            )}
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <span className={`w-1.5 h-1.5 rounded-full ${status.dot} inline-block`}></span>
              {status.label}
            </span>
          </div>
          <p className="text-sm text-gray-400">{agent.role}</p>
        </div>
        <div className="flex gap-1 shrink-0">
          <button onClick={onChat}
            disabled={deploymentStatus !== 'running'}
            className="text-xs px-2.5 py-1 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-gray-200 transition-colors">
            Chat
          </button>
          <button onClick={onFiles}
            className="text-xs px-2.5 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors">
            Files
          </button>
          <button onClick={onEdit}
            className="text-xs px-2.5 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors">
            Edit
          </button>
          <button onClick={onDelete}
            className="text-xs px-2.5 py-1 rounded bg-gray-700 hover:bg-red-900 text-gray-200 hover:text-red-300 transition-colors">
            ×
          </button>
        </div>
      </div>

      {agent.skills.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {agent.skills.slice(0, 6).map(s => (
            <span key={s} className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-400">{s}</span>
          ))}
          {agent.skills.length > 6 && (
            <span className="text-xs px-2 py-0.5 text-gray-500">+{agent.skills.length - 6} more</span>
          )}
        </div>
      )}
    </div>
  )
}
