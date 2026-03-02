'use client'
import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { api } from '@/lib/api'
import type { ChatMessage, Member } from '@/lib/types'
import { cn, formatTime } from '@/lib/utils'

type Props = { teamId: string; memberId: string }

type WsMsg =
  | { type: 'message'; message: ChatMessage }
  | { type: 'token'; content: string }
  | { type: 'done' }

export default function ChatPanel({ teamId, memberId }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [member, setMember] = useState<Member | null>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [typing, setTyping] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    async function loadMember() {
      try {
        const m = await api.getMember(teamId, memberId)
        setMember(m)
      } catch {
        // ignore
      }
    }
    loadMember()
  }, [teamId, memberId])

  useEffect(() => {
    // Load history first
    api.getChatHistory(teamId, memberId)
      .then((msgs) => setMessages(msgs))
      .catch(() => {})
      .finally(() => setLoading(false))

    // Connect WebSocket
    const ws = new WebSocket(
      `ws://localhost:8080/api/teams/${teamId}/members/${memberId}/stream`,
    )
    wsRef.current = ws

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data) as WsMsg
      if (data.type === 'message') {
        setMessages((prev) => {
          const exists = prev.find((m) => m.id === data.message.id)
          if (exists) return prev
          return [...prev, data.message]
        })
        setTyping(false)
        setStreamingContent('')
      } else if (data.type === 'token') {
        setTyping(true)
        setStreamingContent((prev) => prev + data.content)
      } else if (data.type === 'done') {
        setTyping(false)
        setStreamingContent('')
      }
    }

    ws.onerror = () => {}
    ws.onclose = () => {}

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [teamId, memberId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  function sendMessage() {
    const content = input.trim()
    if (!content) return
    setInput('')

    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ content }))
    } else {
      // Fallback to HTTP
      api.sendMessage(teamId, memberId, content)
        .then(({ messages: msgs }) => setMessages((prev) => [...prev, ...msgs]))
        .catch(() => {})
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const memberName = member ? `${member.prefix} ${member.display_name}` : memberId

  return (
    <div className="flex flex-col h-full min-w-0 flex-1">
      {/* Header */}
      <div
        className="shrink-0 flex items-center px-5 py-3"
        style={{ borderBottom: '1px solid #1e1e1e', background: '#0f0f0f' }}
      >
        <span className="font-medium text-white text-sm">{memberName}</span>
        {member?.is_team_lead && (
          <span className="ml-2 text-xs text-yellow-500/70">Team Lead</span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {loading && (
          <div className="text-center text-sm py-4" style={{ color: '#555' }}>
            Loading history...
          </div>
        )}
        {!loading && messages.length === 0 && (
          <div className="text-center text-sm py-8" style={{ color: '#555' }}>
            No messages yet. Start the conversation!
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
        {typing && streamingContent && (
          <div className="flex justify-start">
            <div
              className="max-w-[70%] px-4 py-2.5 rounded-2xl rounded-bl-sm text-sm"
              style={{ background: '#1e1e1e', color: '#e5e5e5' }}
            >
              {streamingContent}
              <span className="ml-1 inline-block w-1.5 h-3.5 bg-blue-400 animate-pulse" />
            </div>
          </div>
        )}
        {typing && !streamingContent && (
          <div className="flex justify-start">
            <div
              className="px-4 py-2.5 rounded-2xl rounded-bl-sm text-sm"
              style={{ background: '#1e1e1e', color: '#666' }}
            >
              <span className="animate-pulse">···</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        className="shrink-0 px-4 py-3"
        style={{ borderTop: '1px solid #1e1e1e', background: '#0f0f0f' }}
      >
        <div
          className="flex items-end gap-2 px-4 py-2 rounded-xl"
          style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}
        >
          <textarea
            ref={inputRef}
            className="flex-1 bg-transparent text-sm text-white outline-none resize-none leading-relaxed"
            style={{ maxHeight: 120, minHeight: 24 }}
            placeholder={`Message ${memberName}…`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim()}
            className={cn(
              'shrink-0 p-1.5 rounded-lg transition-colors',
              input.trim() ? 'bg-blue-600 hover:bg-blue-500' : 'opacity-30 cursor-not-allowed',
            )}
          >
            <Send size={14} className="text-white" />
          </button>
        </div>
        <p className="text-center text-xs mt-1" style={{ color: '#444' }}>
          Enter to send · Shift+Enter for newline
        </p>
      </div>
    </div>
  )
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user'
  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[70%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed',
          isUser ? 'rounded-br-sm' : 'rounded-bl-sm',
        )}
        style={{
          background: isUser ? '#2563eb' : '#1e1e1e',
          color: isUser ? '#fff' : '#e5e5e5',
        }}
      >
        {msg.status === 'queued' && (
          <span className="mr-1 text-yellow-400">⏳</span>
        )}
        <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
        <div
          className={cn('text-xs mt-1', isUser ? 'text-right' : 'text-left')}
          style={{ color: isUser ? 'rgba(255,255,255,0.5)' : '#555' }}
        >
          {formatTime(msg.created_at)}
        </div>
      </div>
    </div>
  )
}
