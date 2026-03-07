import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { FileTree } from './FileTree'
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

interface ActiveFile {
  path: string
  content: string | null
  loading: boolean
  error?: string
}

export function FileBrowser({ teamSlug, agentSlug, envSlug }: Props) {
  const [activeFile, setActiveFile] = useState<ActiveFile | null>(null)
  const [refreshingFile, setRefreshingFile] = useState(false)

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
    setActiveFile({ path: filePath, content: null, loading: true })
    const result = await fetchFile(filePath)
    setActiveFile({ path: filePath, content: result.content, loading: false, error: result.error })
  }

  async function reloadFiles() {
    setRefreshingFile(true)
    try {
      await refetchFileList()
      if (activeFile) {
        setActiveFile(prev => prev ? { ...prev, loading: true } : null)
        const result = await fetchFile(activeFile.path)
        setActiveFile({ path: activeFile.path, content: result.content, loading: false, error: result.error })
      }
    } finally {
      setRefreshingFile(false)
    }
  }

  const files = fileList?.files ?? []
  const fileListError = fileList?.error
  const isRefreshing = listFetching || refreshingFile

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
          <FileTree files={files} onSelect={openFile} activeFile={activeFile?.path} />
        )}
      </div>

      {/* Right: viewer */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 overflow-auto">
          {!activeFile ? (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              Select a file to view
            </div>
          ) : activeFile.loading ? (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              Loading…
            </div>
          ) : activeFile.content === null ? (
            <div className="flex items-center justify-center h-full text-red-500 text-sm">
              {activeFile.error ?? 'Failed to load file'}
            </div>
          ) : (
            <MarkdownViewer content={activeFile.content} filePath={activeFile.path} />
          )}
        </div>
      </div>
    </div>
  )
}
