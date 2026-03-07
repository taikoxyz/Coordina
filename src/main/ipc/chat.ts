import { ipcMain } from 'electron'
import { loadRecentMessages, loadOlderMessages, appendChatMessage } from '../store/chatHistory'
import type { ChatMessage } from '../../shared/types'

const LOCAL_PORT = 19876

interface ChatSendRequest {
  teamSlug: string
  envSlug?: string
  agentSlug?: string
  body: unknown
}

interface ChatSendResponse {
  ok: boolean
  status?: number
  payload?: unknown
  error?: string
  detail?: string
}

async function readErrorDetail(res: Response): Promise<string | undefined> {
  const raw = await res.text().catch(() => '')
  if (!raw) return undefined
  try {
    const parsed = JSON.parse(raw) as { error?: unknown; detail?: unknown; message?: unknown }
    if (typeof parsed.detail === 'string' && parsed.detail.length > 0) return parsed.detail
    if (typeof parsed.error === 'string' && parsed.error.length > 0) return parsed.error
    if (typeof parsed.message === 'string' && parsed.message.length > 0) return parsed.message
  } catch {
    // Non-JSON payload.
  }
  const normalized = raw.trim().replace(/\s+/g, ' ')
  return normalized ? normalized.slice(0, 400) : undefined
}

export function registerChatHandlers() {
  ipcMain.handle('chat:send', async (_event, request: ChatSendRequest): Promise<ChatSendResponse> => {
    const { teamSlug, envSlug, agentSlug, body } = request
    if (!teamSlug || !body) {
      return { ok: false, error: 'Invalid chat request' }
    }

    const path = agentSlug
      ? `/proxy/${teamSlug}/agents/${agentSlug}/v1/responses`
      : `/proxy/${teamSlug}/v1/responses`
    const query = envSlug ? `?envSlug=${encodeURIComponent(envSlug)}` : ''
    const url = `http://127.0.0.1:${LOCAL_PORT}${path}${query}`

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        return {
          ok: false,
          status: response.status,
          error: `Gateway returned HTTP ${response.status}`,
          detail: await readErrorDetail(response),
        }
      }

      const payload = await response.json().catch(() => null)
      return { ok: true, payload }
    } catch (e) {
      return {
        ok: false,
        error: 'Failed to reach local proxy',
        detail: e instanceof Error ? e.message : String(e),
      }
    }
  })

  ipcMain.handle('chat:history:load', async (_event, req: { teamSlug: string; envSlug?: string; agentSlug?: string }) => {
    const { teamSlug, envSlug = '__default_env__', agentSlug = '__lead__' } = req
    return loadRecentMessages(teamSlug, envSlug, agentSlug)
  })

  ipcMain.handle('chat:history:loadOlder', async (_event, req: { teamSlug: string; envSlug?: string; agentSlug?: string; offset: number }) => {
    const { teamSlug, envSlug = '__default_env__', agentSlug = '__lead__', offset } = req
    return loadOlderMessages(teamSlug, envSlug, agentSlug, offset)
  })

  ipcMain.handle('chat:history:append', async (_event, req: { teamSlug: string; envSlug?: string; agentSlug?: string; message: ChatMessage }) => {
    const { teamSlug, envSlug = '__default_env__', agentSlug = '__lead__', message } = req
    await appendChatMessage(teamSlug, envSlug, agentSlug, message)
    return { ok: true }
  })
}
