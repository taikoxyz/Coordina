import { useState, useEffect, useRef, useCallback } from 'react'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export function useGatewayChat(teamSlug: string, agentSlug?: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    const path = agentSlug
      ? `/proxy/${teamSlug}/${agentSlug}/ws`
      : `/proxy/${teamSlug}/ws`
    const wsUrl = `ws://localhost:19876${path}`

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      setError(null)
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        const msg: ChatMessage = {
          id: `${Date.now()}-${Math.random()}`,
          role: data.role ?? 'assistant',
          content: data.content ?? String(data),
          timestamp: Date.now(),
        }
        setMessages(prev => [...prev, msg])
      } catch {
        setMessages(prev => [...prev, {
          id: `${Date.now()}-${Math.random()}`,
          role: 'assistant',
          content: event.data,
          timestamp: Date.now(),
        }])
      }
    }

    ws.onerror = () => {
      setError('Connection failed. Is the team deployed?')
      setConnected(false)
    }

    ws.onclose = () => {
      setConnected(false)
    }

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [teamSlug, agentSlug])

  const sendMessage = useCallback((content: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError('Not connected to agent')
      return
    }
    const msg: ChatMessage = {
      id: `${Date.now()}-${Math.random()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
    }
    setMessages(prev => [...prev, msg])
    wsRef.current.send(JSON.stringify({ role: 'user', content }))
  }, [])

  return { messages, connected, error, sendMessage }
}
