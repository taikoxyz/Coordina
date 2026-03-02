import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileTree } from './FileTree'
import { FileTab } from './FileTab'
import { MarkdownViewer } from './MarkdownViewer'

interface Props {
  teamSlug: string
  agentSlug: string
  agentName?: string
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

export function FileBrowser({ teamSlug, agentSlug, agentName }: Props) {
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([])
  const [activeTab, setActiveTab] = useState<string | null>(null)

  const { data: fileList, isLoading: listLoading } = useQuery<{
    files: FileEntry[]
    offline: boolean
    error?: string
  }>({
    queryKey: ['files:list', teamSlug, agentSlug],
    queryFn: () => window.api.invoke('files:list', teamSlug, agentSlug),
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

    const result = await window.api.invoke('files:get', teamSlug, agentSlug, filePath)
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

  return (
    <div className="flex h-full bg-gray-900">
      {/* Left: file tree */}
      <div className="w-56 flex-shrink-0 border-r border-gray-700 flex flex-col">
        <div className="px-3 py-2 border-b border-gray-700">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            {agentName ?? agentSlug}
          </p>
          {fileList?.offline && (
            <p className="text-xs text-yellow-400 mt-0.5">Showing last committed state</p>
          )}
        </div>
        {listLoading ? (
          <div className="px-3 py-4 text-xs text-gray-500">Loading…</div>
        ) : (
          <FileTree files={files} onSelect={openFile} activeFile={activeTab ?? undefined} />
        )}
      </div>

      {/* Right: tabs + viewer */}
      <div className="flex-1 flex flex-col min-w-0">
        {openTabs.length > 0 && (
          <div className="flex border-b border-gray-700 overflow-x-auto flex-shrink-0 bg-gray-800">
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
            <div className="flex items-center justify-center h-full text-gray-600 text-sm">
              Select a file to view
            </div>
          ) : activeTabData.loading ? (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
              Loading…
            </div>
          ) : activeTabData.content === null ? (
            <div className="flex items-center justify-center h-full text-red-400 text-sm">
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
