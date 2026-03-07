import { useState, useEffect, useCallback } from 'react'

export type { ChatMessage } from '../../../shared/types'
import type { ChatMessage } from '../../../shared/types'

export interface GatewayChatError {
  kind: 'connection' | 'auth' | 'not_found' | 'gateway'
  message: string
  status?: number
  detail?: string
  hints: string[]
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

const MAX_MESSAGES = 500

export function useGatewayChat(teamSlug: string, agentSlug?: string, envSlug?: string) {
  const conversationKey = `${teamSlug}::${envSlug ?? '__default_env__'}::${agentSlug ?? '__lead__'}`
  const [messagesByConversation, setMessagesByConversation] = useState<Record<string, ChatMessage[]>>({})
  const [hasMoreByConversation, setHasMoreByConversation] = useState<Record<string, boolean>>({})
  const [connected, setConnected] = useState(true)
  const [error, setError] = useState<GatewayChatError | null>(null)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [loadingInitial, setLoadingInitial] = useState(false)

  const messages = messagesByConversation[conversationKey] ?? []
  const hasMore = hasMoreByConversation[conversationKey] ?? false

  const appendMessage = useCallback((message: ChatMessage) => {
    setMessagesByConversation(prev => {
      const updated = [...(prev[conversationKey] ?? []), message]
      return { ...prev, [conversationKey]: updated.length > MAX_MESSAGES ? updated.slice(-MAX_MESSAGES) : updated }
    })
    void window.api.invoke('chat:history:append', {
      teamSlug,
      envSlug: envSlug ?? '__default_env__',
      agentSlug: agentSlug ?? '__lead__',
      message,
    }).catch(() => undefined)
  }, [conversationKey, teamSlug, envSlug, agentSlug])

  useEffect(() => {
    setConnected(true)
    setError(null)

    if (messagesByConversation[conversationKey] !== undefined) return

    setLoadingInitial(true)
    void window.api.invoke('chat:history:load', {
      teamSlug,
      envSlug: envSlug ?? '__default_env__',
      agentSlug: agentSlug ?? '__lead__',
    }).then((result: unknown) => {
      const { messages: loaded, hasMore: more } = result as { messages: ChatMessage[]; hasMore: boolean }
      setMessagesByConversation(prev => ({ ...prev, [conversationKey]: loaded }))
      setHasMoreByConversation(prev => ({ ...prev, [conversationKey]: more }))
    }).catch(() => {
      setMessagesByConversation(prev => ({ ...prev, [conversationKey]: [] }))
    }).finally(() => setLoadingInitial(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationKey])

  const loadOlderMessages = useCallback(async () => {
    if (loadingOlder || !hasMore) return
    setLoadingOlder(true)
    const offset = (messagesByConversation[conversationKey] ?? []).length
    try {
      const result = await window.api.invoke('chat:history:loadOlder', {
        teamSlug,
        envSlug: envSlug ?? '__default_env__',
        agentSlug: agentSlug ?? '__lead__',
        offset,
      }) as { messages: ChatMessage[]; hasMore: boolean }
      setMessagesByConversation(prev => ({
        ...prev,
        [conversationKey]: [...result.messages, ...(prev[conversationKey] ?? [])],
      }))
      setHasMoreByConversation(prev => ({ ...prev, [conversationKey]: result.hasMore }))
    } finally {
      setLoadingOlder(false)
    }
  }, [conversationKey, hasMore, loadingOlder, messagesByConversation, teamSlug, envSlug, agentSlug])

  const sendMessage = useCallback(async (content: string) => {
    const text = content.trim()
    if (!text) return

    const msg: ChatMessage = {
      id: `${Date.now()}-${Math.random()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    }
    appendMessage(msg)

    try {
      const result = await window.api.invoke('chat:send', {
        teamSlug,
        envSlug,
        agentSlug,
        body: {
          model: 'openclaw-gateway',
          input: [{ type: 'message', role: 'user', content: [{ type: 'input_text', text }] }],
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

  return { messages, connected, error, sendMessage, hasMore, loadingOlder, loadingInitial, loadOlderMessages }
}
