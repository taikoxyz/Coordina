// Two-tab panel for viewing team specs and deploy specs side by side
// FEATURE: SpecsPanel for team and deployment spec file browsing

import React, { useState, useEffect } from 'react'
import { useTeamSpecs, useDeploySpecs, useIsDeployDirty, SpecFile } from '../../hooks/useSpecs'

interface SpecsPanelProps {
  teamSlug: string
  envId?: string
  onClose: () => void
  onApply: () => void
  isApplying?: boolean
}

type Tab = 'team' | 'deploy'

function highlightJson(json: string): React.ReactNode[] {
  const regex = /("(?:\\.|[^"\\])*")(?=\s*:)|("(?:\\.|[^"\\])*")|(true|false|null)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([:,{}[\]])/g
  const nodes: React.ReactNode[] = []
  let last = 0
  let idx = 0
  let m: RegExpExecArray | null
  while ((m = regex.exec(json)) !== null) {
    if (m.index > last) nodes.push(<span key={idx++} className="text-gray-500">{json.slice(last, m.index)}</span>)
    const [, key, str, keyword, num, punct] = m
    if (key) nodes.push(<span key={idx++} className="text-sky-300">{key}</span>)
    else if (str) nodes.push(<span key={idx++} className="text-emerald-300">{str}</span>)
    else if (keyword !== undefined) nodes.push(<span key={idx++} className="text-purple-300">{keyword}</span>)
    else if (num !== undefined) nodes.push(<span key={idx++} className="text-amber-300">{num}</span>)
    else if (punct) nodes.push(<span key={idx++} className="text-gray-500">{punct}</span>)
    last = regex.lastIndex
  }
  if (last < json.length) nodes.push(<span key={idx++} className="text-gray-500">{json.slice(last)}</span>)
  return nodes
}

function groupFiles(files: SpecFile[]): { root: SpecFile[]; folders: Record<string, SpecFile[]> } {
  const root: SpecFile[] = []
  const folders: Record<string, SpecFile[]> = {}
  for (const f of files) {
    const parts = f.path.split('/')
    if (parts.length === 1) {
      root.push(f)
    } else {
      const folder = parts.length >= 3 && parts[0] === 'agents' ? parts[1] : parts[0]
      folders[folder] = [...(folders[folder] ?? []), f]
    }
  }
  return { root, folders }
}

function fileName(path: string): string {
  return path.split('/').pop() ?? path
}

export function SpecsPanel({ teamSlug, envId, onClose, onApply, isApplying }: SpecsPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('team')
  const [selectedFile, setSelectedFile] = useState<string | null>(null)

  const teamSpecs = useTeamSpecs(teamSlug)
  const deploySpecs = useDeploySpecs(teamSlug, envId)
  const isDirty = useIsDeployDirty(teamSlug)

  const files: SpecFile[] = activeTab === 'team'
    ? (teamSpecs.data ?? [])
    : (deploySpecs.data ?? [])

  const isLoading = activeTab === 'team' ? teamSpecs.isLoading : deploySpecs.isLoading
  const showApply = isDirty.data === true || isApplying

  useEffect(() => {
    setSelectedFile(files.length > 0 ? files[0].path : null)
  }, [activeTab, teamSpecs.data, deploySpecs.data])

  function switchTab(tab: Tab) {
    setActiveTab(tab)
  }

  const selectedContent = files.find(f => f.path === selectedFile)?.content ?? null
  const { root, folders } = groupFiles(files)

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700 bg-gray-800 flex-shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => switchTab('team')}
            className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
              activeTab === 'team'
                ? 'bg-gray-700 text-gray-100'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
            }`}
          >
            Team Specs
          </button>
          <button
            onClick={() => switchTab('deploy')}
            className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
              activeTab === 'deploy'
                ? 'bg-gray-700 text-gray-100'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
            }`}
          >
            Deploy Specs
          </button>
        </div>
        <div className="flex items-center gap-2">
          {showApply && (
            <button
              onClick={onApply}
              disabled={isApplying}
              className="flex items-center gap-1.5 px-3 py-1 text-xs rounded font-medium bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
            >
              {isDirty.data === true && !isApplying && (
                <span className="w-1.5 h-1.5 rounded-full bg-orange-300 inline-block" />
              )}
              {isApplying ? 'Applying…' : 'Apply'}
            </button>
          )}
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 transition-colors text-sm px-1"
            aria-label="Close"
          >
            ×
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Left pane: file tree (deploy tab only) */}
        {activeTab === 'deploy' && (
          <div className="w-48 flex-shrink-0 border-r border-gray-700 overflow-y-auto">
            {isLoading ? (
              <div className="px-3 py-4 text-xs text-gray-500">Loading…</div>
            ) : !envId ? null : files.length === 0 ? (
              <div className="px-3 py-4 text-xs text-gray-500">No specs found</div>
            ) : (
              <div className="py-1">
                {root.map(f => (
                  <button
                    key={f.path}
                    onClick={() => setSelectedFile(f.path)}
                    className={`w-full text-left px-3 py-1 text-xs truncate transition-colors ${
                      selectedFile === f.path
                        ? 'bg-gray-700 text-gray-100'
                        : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'
                    }`}
                  >
                    {fileName(f.path)}
                  </button>
                ))}
                {Object.entries(folders).map(([folder, folderFiles]) => (
                  <div key={folder}>
                    <div className="px-3 py-1 text-xs text-gray-500 font-semibold uppercase tracking-wider mt-1">
                      {folder}/
                    </div>
                    {folderFiles.map(f => (
                      <button
                        key={f.path}
                        onClick={() => setSelectedFile(f.path)}
                        className={`w-full text-left pl-5 pr-3 py-1 text-xs truncate transition-colors ${
                          selectedFile === f.path
                            ? 'bg-gray-700 text-gray-100'
                            : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'
                        }`}
                      >
                        {fileName(f.path)}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Content pane */}
        <div className="flex-1 overflow-auto min-w-0">
          {activeTab === 'deploy' && !envId ? (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm px-6 text-center">
              Select an environment to preview deploy specs
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
              Loading…
            </div>
          ) : selectedContent === null ? (
            <div className="flex items-center justify-center h-full text-gray-600 text-sm">
              No file selected
            </div>
          ) : selectedFile?.endsWith('.json') ? (
            <pre className="text-xs font-mono whitespace-pre-wrap break-words p-4">
              {highlightJson(selectedContent)}
            </pre>
          ) : (
            <pre className="text-xs font-mono whitespace-pre-wrap break-words p-4 text-gray-300">
              {selectedContent}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}
