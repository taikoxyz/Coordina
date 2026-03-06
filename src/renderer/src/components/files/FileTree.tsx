import { useState } from 'react'

interface FileEntry {
  path: string
  size: number | null
  isDir: boolean
}

interface Props {
  files: FileEntry[]
  onSelect: (path: string) => void
  activeFile?: string
}

function formatSize(size: number | null): string {
  if (size === null) return ''
  if (size < 1024) return `${size}B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}K`
  return `${(size / 1024 / 1024).toFixed(1)}M`
}

interface TreeNode {
  name: string
  path: string
  isDir: boolean
  size: number | null
  children: TreeNode[]
}

function buildTree(files: FileEntry[]): TreeNode[] {
  const root: TreeNode[] = []
  const dirs = new Map<string, TreeNode>()

  // Sort: directories first, then files
  const sorted = [...files].sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
    return a.path.localeCompare(b.path)
  })

  for (const file of sorted) {
    const parts = file.path.split('/')
    let current = root
    let currentPath = ''

    for (let i = 0; i < parts.length - 1; i++) {
      currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i]
      let dir = dirs.get(currentPath)
      if (!dir) {
        dir = { name: parts[i], path: currentPath, isDir: true, size: null, children: [] }
        dirs.set(currentPath, dir)
        current.push(dir)
      }
      current = dir.children
    }

    const name = parts[parts.length - 1]
    current.push({ name, path: file.path, isDir: file.isDir, size: file.size, children: [] })
  }

  return root
}

function TreeNodeView({ node, onSelect, activeFile, depth }: {
  node: TreeNode
  onSelect: (path: string) => void
  activeFile?: string
  depth: number
}) {
  const [expanded, setExpanded] = useState(true)

  if (node.isDir) {
    return (
      <div>
        <button
          className="flex items-center gap-1 w-full text-left px-2 py-0.5 hover:bg-gray-100 text-gray-600 text-xs"
          style={{ paddingLeft: `${8 + depth * 12}px` }}
          onClick={() => setExpanded(e => !e)}
        >
          <span>{expanded ? '▾' : '▸'}</span>
          <span>{node.name}/</span>
        </button>
        {expanded && node.children.map(child => (
          <TreeNodeView key={child.path} node={child} onSelect={onSelect} activeFile={activeFile} depth={depth + 1} />
        ))}
      </div>
    )
  }

  const isActive = activeFile === node.path
  return (
    <button
      className={`flex items-center justify-between w-full text-left px-2 py-0.5 text-xs group ${
        isActive ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100 text-gray-700'
      }`}
      style={{ paddingLeft: `${8 + depth * 12}px` }}
      onClick={() => onSelect(node.path)}
    >
      <span className="truncate">{node.name}</span>
      {node.size !== null && (
        <span className="text-gray-400 ml-1 flex-shrink-0 text-xs">{formatSize(node.size)}</span>
      )}
    </button>
  )
}

export function FileTree({ files, onSelect, activeFile }: Props) {
  const [search, setSearch] = useState('')

  const filtered = search
    ? files.filter(f => f.path.toLowerCase().includes(search.toLowerCase()))
    : files

  const tree = buildTree(filtered)

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-2 py-1.5">
        <input
          type="text"
          className="w-full border border-gray-200 rounded-md px-2 py-1 text-xs text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Search files..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      {tree.length === 0 ? (
        <p className="text-xs text-gray-400 px-3 py-2">No files</p>
      ) : (
        tree.map(node => (
          <TreeNodeView key={node.path} node={node} onSelect={onSelect} activeFile={activeFile} depth={0} />
        ))
      )}
    </div>
  )
}
