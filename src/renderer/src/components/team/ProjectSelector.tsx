// Compact dropdown for selecting a project within the chat header bar
// FEATURE: Project selection UI for scoping agent conversations
import { ChevronDown } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import type { Project } from '../../../../shared/types'

interface Props {
  projects: Project[]
  selectedSlug: string | null
  onSelect: (slug: string | null) => void
  allowUntagged?: boolean
}

export function ProjectSelector({ projects, selectedSlug, onSelect, allowUntagged }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const activeProjects = projects.filter((p) => p.status === 'active')
  const selected = activeProjects.find((p) => p.slug === selectedSlug)
  const label = selected ? selected.name : 'Select project\u2026'

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 rounded border border-gray-200 px-2 py-1 transition-colors"
      >
        <span className="truncate max-w-[140px]">{label}</span>
        <ChevronDown className="w-3 h-3 shrink-0" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[180px] bg-white border border-gray-200 rounded-md shadow-lg py-1">
          {allowUntagged && (
            <button
              onClick={() => { onSelect(null); setOpen(false) }}
              className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
                selectedSlug === null ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              All conversations
            </button>
          )}
          {activeProjects.map((project) => (
            <button
              key={project.slug}
              onClick={() => { onSelect(project.slug); setOpen(false) }}
              className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
                selectedSlug === project.slug ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {project.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
