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

const LOCAL_PROXY_BASE = 'http://localhost:19876'

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
      'Check the selected environment and team domain settings.',
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

async function readErrorDetail(res: Response): Promise<string | undefined> {
  const raw = await res.text().catch(() => '')
  if (!raw) return undefined

  try {
    const payload = JSON.parse(raw) as { error?: unknown; message?: unknown }
    if (typeof payload.error === 'string') return payload.error
    if (payload.error) return JSON.stringify(payload.error)
    if (typeof payload.message === 'string') return payload.message
  } catch {
    // Non-JSON error payload.
  }

  const normalized = raw.trim().replace(/\s+/g, ' ')
  return normalized ? normalized.slice(0, 400) : undefined
}

export function useGatewayChat(teamSlug: string, agentSlug?: string, envSlug?: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [connected, setConnected] = useState(true)
  const [error, setError] = useState<GatewayChatError | null>(null)

  useEffect(() => {
    setConnected(true)
    setError(null)
  }, [teamSlug, agentSlug, envSlug])

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
    setMessages(prev => [...prev, msg])

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
      const path = agentSlug
        ? `/proxy/${teamSlug}/agents/${agentSlug}/v1/responses`
        : `/proxy/${teamSlug}/v1/responses`
      const query = envSlug ? `?envSlug=${encodeURIComponent(envSlug)}` : ''
      const res = await fetch(`${LOCAL_PROXY_BASE}${path}${query}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'openclaw-gateway',
          input: [{ type: 'message', role: 'user', content: contentParts }],
        }),
      })

      if (!res.ok) {
        const detail = await readErrorDetail(res)
        setConnected(false)
        setError(errorFromStatus(res.status, detail))
        return
      }

      const payload = await res.json()
      setMessages(prev => [...prev, {
        id: `${Date.now()}-${Math.random()}`,
        role: 'assistant',
        content: extractAssistantText(payload),
        timestamp: Date.now(),
      }])
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
  }, [agentSlug, teamSlug, envSlug])

  return { messages, connected, error, sendMessage }
}
