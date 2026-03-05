import { useState, useEffect, useCallback } from 'react'

export interface ChatAttachment {
  name: string
  mimeType: string
  size: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  attachments?: ChatAttachment[]
}

export interface GatewayChatError {
  kind: 'connection' | 'auth' | 'not_found' | 'gateway'
  message: string
  status?: number
  detail?: string
  hints: string[]
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error(`Failed to read '${file.name}'`))
    reader.onload = () => {
      const result = String(reader.result)
      const base64 = result.split(',')[1]
      if (!base64) {
        reject(new Error(`Failed to encode '${file.name}'`))
        return
      }
      resolve(base64)
    }
    reader.readAsDataURL(file)
  })
}

function extractAssistantText(payload: unknown): string {
  const data = payload as {
    output_text?: string
    output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>
  }

  if (typeof data.output_text === 'string' && data.output_text.trim()) {
    return data.output_text
  }

  const texts = (data.output ?? [])
    .flatMap(item => item.type === 'message' ? (item.content ?? []) : [])
    .map(part => part.text)
    .filter((text): text is string => typeof text === 'string' && text.trim().length > 0)

  return texts.join('\n').trim() || 'No response text returned.'
}

function getHints(kind: GatewayChatError['kind']): string[] {
  if (kind === 'auth') {
    return [
      'Re-authenticate the selected environment in Environments.',
      'Verify your account still has IAP access to this gateway.',
    ]
  }
  if (kind === 'not_found') {
    return [
      'Confirm this team is deployed to the selected environment.',
      'If recently migrated, try redeploying once to refresh gateway metadata.',
    ]
  }
  if (kind === 'gateway') {
    return [
      'Check the selected environment domain settings.',
      'Confirm lead agent gateway is reachable from this machine.',
    ]
  }
  return [
    'Verify environment selection is correct for this team.',
    'Try re-authenticating the environment and reopen chat.',
  ]
}

function errorFromStatus(status: number, detail?: string): GatewayChatError {
  if (status === 401 || status === 403) {
    return {
      kind: 'auth',
      status,
      message: 'Authentication failed when connecting to gateway.',
      detail,
      hints: getHints('auth'),
    }
  }
  if (status === 404) {
    return {
      kind: 'not_found',
      status,
      message: 'Gateway route not found for this team/environment.',
      detail,
      hints: getHints('not_found'),
    }
  }
  return {
    kind: 'gateway',
    status,
    message: `Gateway returned HTTP ${status}.`,
    detail,
    hints: getHints('gateway'),
  }
}

export function useGatewayChat(teamSlug: string, agentSlug?: string, envSlug?: string) {
  const conversationKey = `${teamSlug}::${envSlug ?? '__default_env__'}::${agentSlug ?? '__lead__'}`
  const [messagesByConversation, setMessagesByConversation] = useState<Record<string, ChatMessage[]>>({})
  const [connected, setConnected] = useState(true)
  const [error, setError] = useState<GatewayChatError | null>(null)
  const messages = messagesByConversation[conversationKey] ?? []

  const appendMessage = useCallback((message: ChatMessage) => {
    setMessagesByConversation(prev => ({
      ...prev,
      [conversationKey]: [...(prev[conversationKey] ?? []), message],
    }))
  }, [conversationKey])

  useEffect(() => {
    setConnected(true)
    setError(null)
  }, [conversationKey])

  const sendMessage = useCallback(async (content: string, files: File[] = []) => {
    const text = content.trim()
    const attachments = files.map(file => ({ name: file.name, mimeType: file.type || 'application/octet-stream', size: file.size }))

    if (!text && attachments.length === 0) return

    const msg: ChatMessage = {
      id: `${Date.now()}-${Math.random()}`,
      role: 'user',
      content: text || '(sent attachments)',
      timestamp: Date.now(),
      attachments: attachments.length > 0 ? attachments : undefined,
    }
    appendMessage(msg)

    try {
      const contentParts: Array<Record<string, unknown>> = []
      if (text) contentParts.push({ type: 'input_text', text })
      for (const file of files) {
        const base64 = await toBase64(file)
        const mimeType = file.type || 'application/octet-stream'
        if (mimeType.startsWith('image/')) {
          contentParts.push({
            type: 'input_image',
            source: {
              type: 'base64',
              media_type: mimeType,
              data: base64,
            },
          })
          continue
        }
        contentParts.push({
          type: 'input_file',
          source: {
            type: 'base64',
            media_type: mimeType,
            data: base64,
            filename: file.name,
          },
        })
      }
      const result = await window.api.invoke('chat:send', {
        teamSlug,
        envSlug,
        agentSlug,
        body: {
          model: 'openclaw-gateway',
          input: [{ type: 'message', role: 'user', content: contentParts }],
        },
      }) as { ok: boolean; status?: number; payload?: unknown; error?: string; detail?: string }

      if (!result.ok) {
        if (typeof result.status === 'number') {
          setConnected(false)
          setError(errorFromStatus(result.status, result.detail ?? result.error))
          return
        }
        setConnected(false)
        setError({
          kind: 'connection',
          message: 'Failed to reach gateway via local proxy.',
          detail: `${result.error ?? 'Unknown IPC error'}${result.detail ? `: ${result.detail}` : ''} (${`team=${teamSlug}${envSlug ? ` env=${envSlug}` : ''}${agentSlug ? ` agent=${agentSlug}` : ''}`})`,
          hints: getHints('connection'),
        })
        return
      }

      const payload = result.payload
      appendMessage({
        id: `${Date.now()}-${Math.random()}`,
        role: 'assistant',
        content: extractAssistantText(payload),
        timestamp: Date.now(),
      })
      setConnected(true)
      setError(null)
    } catch (e) {
      setConnected(false)
      setError({
        kind: 'connection',
        message: 'Failed to reach gateway via local proxy.',
        detail: `${e instanceof Error ? e.message : String(e)} (${`team=${teamSlug}${envSlug ? ` env=${envSlug}` : ''}${agentSlug ? ` agent=${agentSlug}` : ''}`})`,
        hints: getHints('connection'),
      })
    }
  }, [agentSlug, appendMessage, envSlug, teamSlug])

  return { messages, connected, error, sendMessage }
}
