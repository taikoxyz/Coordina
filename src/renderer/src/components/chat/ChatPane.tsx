import { useState, useRef, useEffect } from 'react'
import { useGatewayChat } from '../../hooks/useGatewayChat'
import { ChatMessage } from './ChatMessage'

interface Props {
  teamSlug: string
  envSlug?: string
  agentSlug?: string
  agentName?: string
  onClose?: () => void
}

export function ChatPane({ teamSlug, envSlug, agentSlug, agentName, onClose }: Props) {
  const { messages, connected, error, sendMessage } = useGatewayChat(teamSlug, agentSlug, envSlug)
  const [input, setInput] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    const text = input.trim()
    if (!text && selectedFiles.length === 0) return
    setSending(true)
    await sendMessage(text, selectedFiles)
    setSending(false)
    setInput('')
    setSelectedFiles([])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  const title = agentSlug && agentName
    ? `Chat with ${agentName}`
    : `Chat with ${teamSlug} (Lead Agent)`

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-gray-500'}`} />
          <span className="font-medium text-white">{title}</span>
          {agentSlug && (
            <span className="text-xs text-yellow-400 bg-yellow-900/30 border border-yellow-700/50 px-2 py-0.5 rounded">
              Direct — bypassing lead agent
            </span>
          )}
        </div>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {error && (
          <div className="mb-4 rounded-lg border border-red-700/60 bg-red-950/40 text-red-100 p-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Connection Error</span>
              {typeof error.status === 'number' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-900/70 border border-red-700/60 font-mono">
                  HTTP {error.status}
                </span>
              )}
            </div>
            <div className="text-sm mt-1">{error.message}</div>
            {error.detail && (
              <div className="text-[11px] mt-2 text-red-200/80 font-mono break-all">{error.detail}</div>
            )}
            <div className="mt-2">
              {error.hints.map((hint, idx) => (
                <div key={idx} className="text-[11px] text-red-200/90">• {hint}</div>
              ))}
            </div>
          </div>
        )}
        {messages.length === 0 && !error && (
          <div className="text-center text-gray-500 py-12 text-sm">
            {connected ? 'Connected. Say something to get started.' : 'Last request failed. You can retry now.'}
          </div>
        )}
        {messages.map(msg => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-700 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-gray-500">
            {selectedFiles.length > 0 ? `${selectedFiles.length} attachment${selectedFiles.length > 1 ? 's' : ''}` : 'No attachments'}
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-xs px-2 py-1 bg-gray-800 text-gray-300 rounded hover:bg-gray-700 disabled:opacity-40"
          >
            Attach files
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={e => setSelectedFiles(Array.from(e.target.files ?? []))}
          />
        </div>
        {selectedFiles.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {selectedFiles.map(file => (
              <span key={`${file.name}-${file.size}`} className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-300 border border-gray-700">
                {file.name}
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <textarea
            className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-blue-500"
            placeholder="Message the agent… (Enter to send)"
            rows={2}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sending}
          />
          <button
            onClick={() => void handleSend()}
            disabled={sending || (!input.trim() && selectedFiles.length === 0)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed self-end"
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}
