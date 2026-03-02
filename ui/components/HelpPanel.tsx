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
      style={{ width: 360, background: '#0d0d0d', borderRight: '1px solid #222' }}
    >
      <div
        className="flex items-center justify-between px-5 py-4 shrink-0"
        style={{ borderBottom: '1px solid #222' }}
      >
        <span className="text-sm font-semibold text-white">{title}</span>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded hover:bg-white/10 transition-colors"
        >
          <X size={14} style={{ color: '#666' }} />
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
                <p className="text-sm font-semibold text-white mb-1">{step.title}</p>
              )}
              <p className="text-sm leading-relaxed" style={{ color: '#999' }}>
                {renderText(step.text)}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
