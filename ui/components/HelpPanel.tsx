'use client'
import { X } from 'lucide-react'

type Step = { title?: string; text: string }
type Props = { title: string; steps: Step[]; onClose: () => void }

function renderText(text: string) {
  const parts = text.split(/(https?:\/\/\S+)/g)
  return parts.map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: '#60a5fa', textDecoration: 'underline' }}
        className="hover:text-blue-300 transition-colors"
      >
        {part}
      </a>
    ) : (
      part
    ),
  )
}

export default function HelpPanel({ title, steps, onClose }: Props) {
  return (
    <div
      className="h-full overflow-y-auto flex flex-col shrink-0"
      style={{ width: 360, background: 'var(--c-bg-subtle)', borderRight: '1px solid var(--c-border)' }}
    >
      <div
        className="flex items-center justify-between px-5 py-4 shrink-0"
        style={{ borderBottom: '1px solid var(--c-border)' }}
      >
        <span className="text-sm font-semibold" style={{ color: 'var(--c-text-primary)' }}>{title}</span>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded hover:bg-white/10 transition-colors"
        >
          <X size={14} style={{ color: 'var(--c-text-muted)' }} />
        </button>
      </div>

      <ol className="px-5 py-5 space-y-5 flex-1">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-3">
            <span
              className="flex-none w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0 mt-0.5"
              style={{ background: '#1d4ed8' }}
            >
              {i + 1}
            </span>
            <div className="min-w-0">
              {step.title && (
                <p className="text-sm font-semibold mb-1" style={{ color: 'var(--c-text-primary)' }}>{step.title}</p>
              )}
              <p className="text-sm leading-relaxed" style={{ color: 'var(--c-text-secondary)' }}>
                {renderText(step.text)}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
