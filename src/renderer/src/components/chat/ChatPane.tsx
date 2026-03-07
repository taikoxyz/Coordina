import { useMemo, useState, useCallback } from 'react'
import {
  AssistantRuntimeProvider,
  useExternalStoreRuntime,
  ThreadPrimitive,
  MessagePrimitive,
  ComposerPrimitive,
  AttachmentPrimitive,
  useMessage,
} from '@assistant-ui/react'
import type { AppendMessage, ThreadMessageLike, AttachmentAdapter, PendingAttachment } from '@assistant-ui/react'
import { useGatewayChat } from '../../hooks/useGatewayChat'
import type { ChatMessage } from '../../hooks/useGatewayChat'

interface Props {
  teamSlug: string
  envSlug?: string
  agentSlug?: string
  agentName?: string
  onClose?: () => void
}

const attachmentAdapter: AttachmentAdapter = {
  accept: '*/*',
  async add({ file }) {
    return {
      id: `${Date.now()}-${Math.random()}`,
      type: file.type.startsWith('image/') ? 'image' : 'file',
      name: file.name,
      contentType: file.type || 'application/octet-stream',
      file,
      status: { type: 'requires-action', reason: 'composer-send' },
    }
  },
  async send(pending: PendingAttachment) {
    return { ...pending, status: { type: 'complete' }, content: [] }
  },
  async remove() {},
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
  const { message } = useMessage()
  const { role, content, createdAt } = message
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
        marginBottom: 2,
        padding: '0 8px',
      }}
    >
      <div style={{ position: 'relative', maxWidth: '72%' }}>
        {/* Bubble tail */}
        {isUser ? (
          <div
            style={{
              position: 'absolute',
              right: -5,
              bottom: 0,
              width: 0,
              height: 0,
              borderLeft: '6px solid #effdde',
              borderTop: '6px solid transparent',
            }}
          />
        ) : (
          <div
            style={{
              position: 'absolute',
              left: -5,
              bottom: 0,
              width: 0,
              height: 0,
              borderRight: '6px solid #ffffff',
              borderTop: '6px solid transparent',
            }}
          />
        )}
        <div
          style={{
            background: isUser ? '#effdde' : '#ffffff',
            color: '#000000',
            borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
            padding: '5px 9px 4px',
            fontSize: 13.5,
            lineHeight: 1.45,
            boxShadow: '0 1px 1px rgba(0,0,0,0.10)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {text}
          <span
            style={{
              fontSize: 11,
              color: isUser ? '#6daa5e' : '#aaaaaa',
              marginLeft: 6,
              float: 'right',
              marginTop: 3,
              lineHeight: 1,
            }}
          >
            {time}
          </span>
        </div>
      </div>
    </MessagePrimitive.Root>
  )
}

function ComposerAttachment() {
  return (
    <AttachmentPrimitive.Root
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 12,
        background: '#e8f4fb',
        color: '#2a7ae2',
        fontSize: 12,
        border: '1px solid #b8d9f5',
      }}
    >
      <AttachmentPrimitive.Name />
      <AttachmentPrimitive.Remove style={{ marginLeft: 2, color: '#7ab3e0', cursor: 'pointer' }}>
        ✕
      </AttachmentPrimitive.Remove>
    </AttachmentPrimitive.Root>
  )
}

export function ChatPane({ teamSlug, envSlug, agentSlug, agentName, onClose }: Props) {
  const { messages, connected, error, sendMessage, hasMore, loadingOlder, loadingInitial, loadOlderMessages } =
    useGatewayChat(teamSlug, agentSlug, envSlug)
  const [sending, setSending] = useState(false)

  const onNew = useCallback(
    async (appendMsg: AppendMessage) => {
      const text = appendMsg.content
        .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
        .map(p => p.text)
        .join('')
      const files = (appendMsg.attachments ?? [])
        .map(a => a.file)
        .filter((f): f is File => f instanceof File)
      setSending(true)
      await sendMessage(text, files)
      setSending(false)
    },
    [sendMessage],
  )

  const adapters = useMemo(() => ({ attachments: attachmentAdapter }), [])

  const runtime = useExternalStoreRuntime({
    messages,
    isRunning: sending,
    convertMessage,
    onNew,
    adapters,
  })

  const displayName = agentName ?? `${teamSlug} agent`

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#dae3ea' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 12px',
            background: '#f0f4f8',
            borderBottom: '1px solid #cdd5de',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #4a9eff 0%, #2266cc 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: 12,
              fontWeight: 700,
              flexShrink: 0,
              letterSpacing: 0.5,
            }}
          >
            {displayName.slice(0, 2).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: '#1a1a1a',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {displayName}
            </div>
            <div style={{ fontSize: 11.5, color: connected ? '#4daa6e' : '#999999', marginTop: 1 }}>
              {connected ? 'online' : 'offline'}
            </div>
          </div>
          {agentSlug && (
            <span
              style={{
                fontSize: 11,
                color: '#917a28',
                background: '#fef9e0',
                border: '1px solid #e8d97a',
                padding: '2px 7px',
                borderRadius: 10,
                whiteSpace: 'nowrap',
              }}
            >
              direct
            </span>
          )}
          {onClose && (
            <button
              onClick={onClose}
              style={{
                color: '#aaaaaa',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 16,
                padding: '2px 4px',
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Messages */}
        <div
          style={{ flex: 1, overflowY: 'auto', padding: '8px 0 4px' }}
        >
          {hasMore && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
              <button
                onClick={() => void loadOlderMessages()}
                disabled={loadingOlder}
                style={{
                  fontSize: 12,
                  color: '#5a8db5',
                  background: 'rgba(255,255,255,0.7)',
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
            background: '#f0f4f8',
            borderTop: '1px solid #cdd5de',
            padding: '7px 8px',
            flexShrink: 0,
          }}
        >
          <ComposerPrimitive.Root style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <ComposerPrimitive.Attachments components={{ Attachment: ComposerAttachment }} />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: '#ffffff',
                borderRadius: 22,
                padding: '4px 4px 4px 10px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
              }}
            >
              <ComposerPrimitive.AddAttachment
                style={{
                  color: '#aaaaaa',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0 2px',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                </svg>
              </ComposerPrimitive.AddAttachment>
              <ComposerPrimitive.Input
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  fontSize: 13.5,
                  background: 'transparent',
                  resize: 'none',
                  padding: '3px 0',
                  lineHeight: 1.4,
                  color: '#1a1a1a',
                  maxHeight: 80,
                  overflowY: 'auto',
                }}
                placeholder="Message…"
                rows={1}
                disabled={sending}
              />
              <ComposerPrimitive.Send
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  background: sending ? '#a0c4e8' : '#2196f3',
                  border: 'none',
                  cursor: sending ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'background 0.15s',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" fill="white" stroke="none" />
                </svg>
              </ComposerPrimitive.Send>
            </div>
          </ComposerPrimitive.Root>
        </div>
      </div>
    </AssistantRuntimeProvider>
  )
}
