import { useState, useRef, useEffect } from 'react'
import { useGatewayChat } from '../../hooks/useGatewayChat'
import { ChatMessage } from './ChatMessage'

interface Props {
  teamSlug: string
  agentSlug?: string
  agentName?: string
  onClose?: () => void
}

export function ChatPane({ teamSlug, agentSlug, agentName, onClose }: Props) {
  const { messages, connected, error, sendMessage } = useGatewayChat(teamSlug, agentSlug)
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleSend() {
    const text = input.trim()
    if (!text) return
    sendMessage(text)
    setInput('')
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
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
          <div className="text-center text-red-400 text-sm py-4 bg-red-900/20 rounded-lg mb-4">
            {error}
          </div>
        )}
        {messages.length === 0 && !error && (
          <div className="text-center text-gray-500 py-12 text-sm">
            {connected ? 'Connected. Say something to get started.' : 'Connecting to agent…'}
          </div>
        )}
        {messages.map(msg => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-700 flex-shrink-0">
        <div className="flex gap-2">
          <textarea
            className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-blue-500"
            placeholder={connected ? 'Message the agent… (Enter to send)' : 'Not connected'}
            rows={2}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!connected}
          />
          <button
            onClick={handleSend}
            disabled={!connected || !input.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed self-end"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
