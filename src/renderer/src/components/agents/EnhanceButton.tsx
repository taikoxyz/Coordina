import React, { useState } from 'react'

interface BeforeAfterPreviewProps {
  before: string
  after: string
  onAccept: () => void
  onReject: () => void
}

function BeforeAfterPreview({ before, after, onAccept, onReject }: BeforeAfterPreviewProps) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]" onClick={onReject}>
      <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-gray-100 mb-4">AI Enhancement Preview</h3>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Original</p>
            <div className="bg-gray-900 rounded p-3 text-sm text-gray-400 h-40 overflow-y-auto whitespace-pre-wrap">{before}</div>
          </div>
          <div>
            <p className="text-xs font-medium text-blue-400 uppercase tracking-wider mb-2">Enhanced</p>
            <div className="bg-gray-900 rounded p-3 text-sm text-gray-200 h-40 overflow-y-auto whitespace-pre-wrap border border-blue-800">{after}</div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onReject} className="px-4 py-2 rounded text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors">
            Keep original
          </button>
          <button onClick={onAccept} className="px-4 py-2 rounded text-sm bg-blue-600 hover:bg-blue-500 text-white transition-colors">
            Use enhanced
          </button>
        </div>
      </div>
    </div>
  )
}

interface EnhanceButtonProps {
  label?: string
  onEnhance: () => Promise<string>
  currentValue: string
  onAccept: (enhanced: string) => void
}

export function EnhanceButton({ label = 'Enhance', onEnhance, currentValue, onAccept }: EnhanceButtonProps) {
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<{ before: string; after: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setError(null)
    setLoading(true)
    try {
      const enhanced = await onEnhance()
      setPreview({ before: currentValue, after: enhanced })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Enhancement failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleClick}
          disabled={loading}
          className="text-xs px-2.5 py-1 rounded bg-purple-900/60 hover:bg-purple-800 border border-purple-700 text-purple-300 hover:text-purple-200 transition-colors disabled:opacity-50"
        >
          {loading ? '✨ Enhancing...' : `✨ ${label}`}
        </button>
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
      {preview && (
        <BeforeAfterPreview
          before={preview.before}
          after={preview.after}
          onAccept={() => { onAccept(preview.after); setPreview(null) }}
          onReject={() => setPreview(null)}
        />
      )}
    </>
  )
}
