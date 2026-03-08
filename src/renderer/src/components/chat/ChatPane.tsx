import { useState, useCallback, useRef, useEffect } from 'react'
import {
  AssistantRuntimeProvider,
  useExternalStoreRuntime,
  ThreadPrimitive,
  MessagePrimitive,
  ComposerPrimitive,
  useMessage,
} from '@assistant-ui/react'
import type { AppendMessage, ThreadMessageLike } from '@assistant-ui/react'
import { useGatewayChat } from '../../hooks/useGatewayChat'
import type { ChatMessage } from '../../hooks/useGatewayChat'

interface Props {
  teamSlug: string
  envSlug?: string
  agentSlug?: string
  agentName?: string
  projectSlug?: string
  onClose?: () => void
}

function convertMessage(msg: ChatMessage): ThreadMessageLike {
  return {
    id: msg.id,
    role: msg.role,
    content: [{ type: 'text', text: msg.content }],
    createdAt: new Date(msg.timestamp),
  }
}

function Message() {
  const { role, content, createdAt } = useMessage()
  const isUser = role === 'user'
  const text = content
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map(p => p.text)
    .join('')
  const time = createdAt
    ? createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : ''

  return (
    <MessagePrimitive.Root
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        marginBottom: 8,
        padding: '0 16px',
      }}
    >
      <div style={{ maxWidth: '72%' }}>
        <div
          style={{
            background: isUser ? '#d1e8ff' : '#f6f5f3',
            color: '#1a1a1a',
            borderRadius: 18,
            padding: '10px 14px',
            fontSize: 14,
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {text}
        </div>
        <div
          style={{
            fontSize: 11,
            color: '#999',
            marginTop: 2,
            textAlign: isUser ? 'right' : 'left',
            padding: '0 4px',
          }}
        >
          {time}
        </div>
      </div>
    </MessagePrimitive.Root>
  )
}

export function ChatPane({ teamSlug, envSlug, agentSlug, agentName, projectSlug, onClose }: Props) {
  const { messages, connected, error, sendMessage, hasMore, loadingOlder, loadingInitial, loadOlderMessages } =
    useGatewayChat(teamSlug, agentSlug, envSlug, projectSlug)
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, sending])

  const onNew = useCallback(
    async (appendMsg: AppendMessage) => {
      const text = appendMsg.content
        .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
        .map(p => p.text)
        .join('')
      setSending(true)
      await sendMessage(text)
      setSending(false)
    },
    [sendMessage],
  )

  const runtime = useExternalStoreRuntime({
    messages,
    isRunning: sending,
    convertMessage,
    onNew,
  })

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadPrimitive.Root style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#ffffff' }}>
        {/* Messages */}
        <div
          ref={scrollRef}
          style={{ flex: 1, overflowY: 'auto', padding: '16px 0 8px' }}
        >
          {hasMore && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
              <button
                onClick={() => void loadOlderMessages()}
                disabled={loadingOlder}
                style={{
                  fontSize: 12,
                  color: '#666',
                  background: '#f7f7f8',
                  border: 'none',
                  borderRadius: 12,
                  padding: '4px 12px',
                  cursor: loadingOlder ? 'default' : 'pointer',
                  opacity: loadingOlder ? 0.6 : 1,
                }}
              >
                {loadingOlder ? 'Loading…' : 'Load earlier messages'}
              </button>
            </div>
          )}
          {loadingInitial && (
            <div style={{ textAlign: 'center', color: '#888', padding: '12px 0', fontSize: 12 }}>
              Loading history…
            </div>
          )}
          {error && (
            <div
              style={{
                margin: '4px 8px 6px',
                background: '#fff0f0',
                border: '1px solid #f5c6c6',
                borderRadius: 10,
                padding: '8px 10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#c00' }}>Connection Error</span>
                {typeof error.status === 'number' && (
                  <span
                    style={{
                      fontSize: 11,
                      padding: '1px 5px',
                      borderRadius: 6,
                      background: '#fde8e8',
                      border: '1px solid #f5c6c6',
                      fontFamily: 'monospace',
                      color: '#c00',
                    }}
                  >
                    HTTP {error.status}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 13, marginTop: 3, color: '#600' }}>{error.message}</div>
              {error.detail && (
                <div style={{ fontSize: 11, marginTop: 4, color: '#900', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                  {error.detail}
                </div>
              )}
              {error.hints.map((hint, idx) => (
                <div key={idx} style={{ fontSize: 11, color: '#b00', marginTop: 2 }}>
                  • {hint}
                </div>
              ))}
            </div>
          )}
          <ThreadPrimitive.Empty>
            <div style={{ textAlign: 'center', color: '#888', padding: '40px 16px', fontSize: 13 }}>
              {connected ? 'Say something to get started.' : 'Reconnecting…'}
            </div>
          </ThreadPrimitive.Empty>
          <ThreadPrimitive.Messages components={{ Message }} />
          <div style={{ height: 4 }} />
        </div>

        {/* Composer */}
        <div
          style={{
            background: '#ffffff',
            borderTop: 'none',
            padding: '12px 16px',
            flexShrink: 0,
          }}
        >
          <ComposerPrimitive.Root
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: '#f7f7f8',
              borderRadius: 24,
              padding: '4px 4px 4px 16px',
              border: '1px solid #e5e5e5',
            }}
          >
              <ComposerPrimitive.Input
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  fontSize: 14,
                  background: 'transparent',
                  resize: 'none',
                  padding: '6px 0',
                  lineHeight: 1.5,
                  color: '#1a1a1a',
                }}
                placeholder="Message…"
                rows={1}
                disabled={sending}
              />
              <ComposerPrimitive.Send
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: sending ? '#ccc' : '#1a1a1a',
                  border: 'none',
                  cursor: sending ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'background 0.15s',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5" />
                  <polyline points="5 12 12 5 19 12" />
                </svg>
              </ComposerPrimitive.Send>
          </ComposerPrimitive.Root>
        </div>
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider>
  )
}
