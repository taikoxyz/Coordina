import type { ReactNode } from 'react'

interface InfoGroupProps {
  title: string
  children: ReactNode
}

interface InfoRowProps {
  label: string
  value?: string | number
}

interface InfoBlockProps {
  value?: string
}

export function InfoGroup({ title, children }: InfoGroupProps) {
  return (
    <div className="pb-5">
      <div className="mb-2">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
          {title}
        </span>
        <div className="mt-1.5 h-px bg-gray-100" />
      </div>
      <div>
        {children}
      </div>
    </div>
  )
}

export function InfoRow({ label, value }: InfoRowProps) {
  const hasValue = value !== undefined && value !== null && `${value}`.trim().length > 0
  return (
    <div className="flex items-start gap-4 py-2">
      <span className="w-36 shrink-0 text-base font-medium text-gray-400 leading-snug">
        {label}
      </span>
      <span className={`flex-1 min-w-0 text-base leading-snug ${hasValue ? 'text-gray-800' : 'text-gray-300'}`}>
        {hasValue ? value : 'Not set'}
      </span>
    </div>
  )
}

export function InfoBlock({ value }: InfoBlockProps) {
  const hasValue = value !== undefined && value !== null && value.trim().length > 0
  return (
    <div className="py-2.5">
      <div className={`text-base whitespace-pre-wrap leading-relaxed ${hasValue ? 'text-gray-800' : 'text-gray-300'}`}>
        {hasValue ? value : 'Not set'}
      </div>
    </div>
  )
}
