import { useState, useRef, useEffect } from 'react'
import { useGatewayChat } from '../../hooks/useGatewayChat'
import { ChatMessage } from './ChatMessage'
import { Button, Textarea } from '../ui'

interface Props {
  teamSlug: string
  envSlug?: string
  agentSlug?: string
  agentName?: string
  onClose?: () => void
}

export function ChatPane({ teamSlug, envSlug, agentSlug, agentName, onClose }: Props) {
  const { messages, connected, error, sendMessage, hasMore, loadingOlder, loadingInitial, loadOlderMessages } = useGatewayChat(teamSlug, agentSlug, envSlug)
  const [input, setInput] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [sending, setSending] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const prevScrollHeightRef = useRef(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const lastMessageId = messages[messages.length - 1]?.id
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lastMessageId])

  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el || prevScrollHeightRef.current === 0) return
    el.scrollTop += el.scrollHeight - prevScrollHeightRef.current
    prevScrollHeightRef.current = 0
  }, [messages.length])

  async function handleLoadMore() {
    if (scrollContainerRef.current) {
      prevScrollHeightRef.current = scrollContainerRef.current.scrollHeight
    }
    await loadOlderMessages()
  }

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

  const title = agentName
    ? `Chat with ${agentName}`
    : `Chat with ${teamSlug} (Lead Agent)`

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-300'}`} />
          <span className="font-medium text-gray-900 text-sm">{title}</span>
          {agentSlug && (
            <span className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded">
              Direct — bypassing lead agent
            </span>
          )}
        </div>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 py-4 bg-gray-50">
        {hasMore && (
          <div className="flex justify-center mb-4">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void handleLoadMore()}
              disabled={loadingOlder}
            >
              {loadingOlder ? 'Loading…' : 'Load earlier messages'}
            </Button>
          </div>
        )}
        {loadingInitial && (
          <div className="text-center text-gray-400 py-4 text-xs">Loading history…</div>
        )}
        {error && (
          <div className="mb-4 bg-red-50 text-red-800 p-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Connection Error</span>
              {typeof error.status === 'number' && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 border border-red-200 font-mono text-red-600">
                  HTTP {error.status}
                </span>
              )}
            </div>
            <div className="text-sm mt-1">{error.message}</div>
            {error.detail && (
              <div className="text-xs mt-2 text-red-600 font-mono break-all">{error.detail}</div>
            )}
            <div className="mt-2">
              {error.hints.map((hint, idx) => (
                <div key={idx} className="text-xs text-red-700">• {hint}</div>
              ))}
            </div>
          </div>
        )}
        {messages.length === 0 && !error && !loadingInitial && (
          <div className="text-center text-gray-400 py-12 text-sm">
            {connected ? 'Connected. Say something to get started.' : 'Last request failed. You can retry now.'}
          </div>
        )}
        {messages.map(msg => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-200 flex-shrink-0 bg-white">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-gray-500">
            {selectedFiles.length > 0 ? `${selectedFiles.length} attachment${selectedFiles.length > 1 ? 's' : ''}` : 'No attachments'}
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            Attach files
          </Button>
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
              <span key={`${file.name}-${file.size}`} className="text-xs px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                {file.name}
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Textarea
            className="flex-1 rounded-lg resize-none"
            placeholder="Message the agent... (Enter to send)"
            rows={2}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sending}
          />
          <Button
            variant="primary"
            size="lg"
            className="self-end"
            onClick={() => void handleSend()}
            disabled={sending || (!input.trim() && selectedFiles.length === 0)}
          >
            {sending ? 'Sending…' : 'Send'}
          </Button>
        </div>
      </div>
    </div>
  )
}
