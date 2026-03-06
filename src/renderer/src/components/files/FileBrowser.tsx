import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileTree } from './FileTree'
import { FileTab } from './FileTab'
import { MarkdownViewer } from './MarkdownViewer'
import type { TeamSpec } from '../../../../shared/types'

interface Props {
  teamSlug: string
  agentSlug: string
  agentName?: string
  teamSnapshot?: TeamSpec
}

interface FileEntry {
  path: string
  size: number | null
  isDir: boolean
}

interface OpenTab {
  path: string
  content: string | null
  loading: boolean
}

export function FileBrowser({ teamSlug, agentSlug, agentName, teamSnapshot }: Props) {
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([])
  const [activeTab, setActiveTab] = useState<string | null>(null)

  const { data: fileList, isLoading: listLoading } = useQuery<{
    files: FileEntry[]
    offline: boolean
    error?: string
  }>({
    queryKey: ['files:list', teamSlug, agentSlug],
    queryFn: () => window.api.invoke('files:list', teamSlug, agentSlug, teamSnapshot ?? null) as Promise<{ files: FileEntry[]; offline: boolean; error?: string }>,
  })

  async function openFile(filePath: string) {
    // If already open, just switch to it
    if (openTabs.some(t => t.path === filePath)) {
      setActiveTab(filePath)
      return
    }

    // Add loading tab
    setOpenTabs(prev => [...prev, { path: filePath, content: null, loading: true }])
    setActiveTab(filePath)

    const result = await window.api.invoke('files:get', teamSlug, agentSlug, filePath, teamSnapshot ?? null) as { content: string | null }
    setOpenTabs(prev => prev.map(t =>
      t.path === filePath ? { ...t, content: result.content, loading: false } : t
    ))
  }

  function closeTab(filePath: string) {
    setOpenTabs(prev => {
      const next = prev.filter(t => t.path !== filePath)
      if (activeTab === filePath) {
        setActiveTab(next.length > 0 ? next[next.length - 1].path : null)
      }
      return next
    })
  }

  const activeTabData = openTabs.find(t => t.path === activeTab)
  const files = fileList?.files ?? []
  const fileListError = fileList?.error

  return (
    <div className="flex h-full bg-white">
      {/* Left: file tree */}
      <div className="w-56 flex-shrink-0 border-r border-gray-200 flex flex-col bg-gray-50">
        <div className="px-3 py-2 border-b border-gray-200">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            {agentName ?? agentSlug}
          </p>
          {fileList?.offline && (
            <p className="text-xs text-yellow-600 mt-0.5">Preview — showing files that will be seeded on deploy</p>
          )}
          {!fileList?.offline && fileListError && (
            <p className="text-xs text-red-600 mt-0.5">{fileListError}</p>
          )}
        </div>
        {listLoading ? (
          <div className="px-3 py-4 text-xs text-gray-400">Loading…</div>
        ) : files.length === 0 ? (
          <div className="px-3 py-4 text-xs text-gray-400">
            {fileListError ?? 'No files available'}
          </div>
        ) : (
          <FileTree files={files} onSelect={openFile} activeFile={activeTab ?? undefined} />
        )}
      </div>

      {/* Right: tabs + viewer */}
      <div className="flex-1 flex flex-col min-w-0">
        {openTabs.length > 0 && (
          <div className="flex border-b border-gray-200 overflow-x-auto flex-shrink-0 bg-gray-50">
            {openTabs.map(tab => (
              <FileTab
                key={tab.path}
                path={tab.path}
                isActive={activeTab === tab.path}
                onClick={() => setActiveTab(tab.path)}
                onClose={() => closeTab(tab.path)}
              />
            ))}
          </div>
        )}

        <div className="flex-1 overflow-auto">
          {!activeTabData ? (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              Select a file to view
            </div>
          ) : activeTabData.loading ? (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              Loading…
            </div>
          ) : activeTabData.content === null ? (
            <div className="flex items-center justify-center h-full text-red-500 text-sm">
              Failed to load file
            </div>
          ) : (
            <MarkdownViewer content={activeTabData.content} filePath={activeTabData.path} />
          )}
        </div>
      </div>
    </div>
  )
}
