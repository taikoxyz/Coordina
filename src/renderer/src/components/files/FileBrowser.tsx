import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { FileTree } from './FileTree'
import { FileTab } from './FileTab'
import { MarkdownViewer } from './MarkdownViewer'
interface Props {
  teamSlug: string
  agentSlug: string
  envSlug?: string
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
  error?: string
}

export function FileBrowser({ teamSlug, agentSlug, envSlug }: Props) {
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([])
  const [activeTab, setActiveTab] = useState<string | null>(null)
  const [refreshingTabs, setRefreshingTabs] = useState(false)

  const {
    data: fileList,
    isLoading: listLoading,
    isFetching: listFetching,
    refetch: refetchFileList,
  } = useQuery<{
    files: FileEntry[]
    error?: string
  }>({
    queryKey: ['files:list', teamSlug, agentSlug],
    queryFn: () => window.api.invoke('files:list', teamSlug, agentSlug, envSlug) as Promise<{ files: FileEntry[]; error?: string }>,
  })

  async function fetchFile(filePath: string): Promise<{ content: string | null; error?: string }> {
    return window.api.invoke('files:get', teamSlug, agentSlug, filePath, envSlug) as Promise<{ content: string | null; error?: string }>
  }

  async function openFile(filePath: string) {
    // If already open, just switch to it
    if (openTabs.some(t => t.path === filePath)) {
      setActiveTab(filePath)
      return
    }

    // Add loading tab
    setOpenTabs(prev => [...prev, { path: filePath, content: null, loading: true }])
    setActiveTab(filePath)

    const result = await fetchFile(filePath)
    setOpenTabs(prev => prev.map(t =>
      t.path === filePath ? { ...t, content: result.content, loading: false, error: result.error } : t
    ))
  }

  async function reloadFiles() {
    const tabsToRefresh = openTabs.map(tab => tab.path)
    setRefreshingTabs(true)
    setOpenTabs(prev => prev.map(tab => ({ ...tab, loading: true })))

    try {
      await refetchFileList()
      const refreshedTabs = await Promise.all(tabsToRefresh.map(async (path) => {
        const result = await fetchFile(path)
        return {
          path,
          content: result.content,
          loading: false,
          error: result.error,
        }
      }))
      setOpenTabs(refreshedTabs)
    } finally {
      setRefreshingTabs(false)
    }
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
  const isRefreshing = listFetching || refreshingTabs

  return (
    <div className="flex h-full bg-white">
      {/* Left: file tree */}
      <div className="w-56 flex-shrink-0 border-r border-gray-200 flex flex-col bg-white">
        <div className="px-3 py-2 border-b border-gray-200">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-[0.16em]">
                Files
              </p>
              {fileListError && (
                <p className="text-xs text-red-600 mt-0.5">{fileListError}</p>
              )}
            </div>
            <button
              onClick={reloadFiles}
              disabled={isRefreshing}
              className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-default transition-colors"
              title="Refresh files"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
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
          <div className="flex border-b border-gray-200 overflow-x-auto flex-shrink-0 bg-white">
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
              {activeTabData.error ?? 'Failed to load file'}
            </div>
          ) : (
            <MarkdownViewer content={activeTabData.content} filePath={activeTabData.path} />
          )}
        </div>
      </div>
    </div>
  )
}
