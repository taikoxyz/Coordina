'use client'
import { useState } from 'react'
import HelpPanel from './HelpPanel'

type Step = { title?: string; text: string }
type Props = { title: string; steps: Step[] }

export default function HelpPopover({ title, steps }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-4 h-4 rounded-full inline-flex items-center justify-center text-xs font-bold transition-colors shrink-0"
        style={{ background: 'var(--c-bg-elevated)', color: 'var(--c-text-muted)' }}
        aria-label="Help"
      >
        ?
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setOpen(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <HelpPanel title={title} steps={steps} onClose={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  )
}
