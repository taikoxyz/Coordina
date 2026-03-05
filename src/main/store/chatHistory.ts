// File-based store for persisting chat messages per conversation to JSON
// FEATURE: Chat persistence layer with paginated loading for conversation history
import fs from 'fs/promises'
import path from 'path'
import { getDataDir } from './dataDir'
import type { ChatMessage } from '../../shared/types'

const PAGE_SIZE = 50

const chatDir = (teamSlug: string, envSlug: string, agentSlug: string): string =>
  path.join(getDataDir(), 'chat', teamSlug, envSlug, agentSlug)

const chatPath = (teamSlug: string, envSlug: string, agentSlug: string): string =>
  path.join(chatDir(teamSlug, envSlug, agentSlug), 'messages.json')

const ensureDir = (teamSlug: string, envSlug: string, agentSlug: string): Promise<void> =>
  fs.mkdir(chatDir(teamSlug, envSlug, agentSlug), { recursive: true }).then(() => undefined)

const readMessages = async (teamSlug: string, envSlug: string, agentSlug: string): Promise<ChatMessage[]> => {
  const content = await fs.readFile(chatPath(teamSlug, envSlug, agentSlug), 'utf-8').catch(() => null)
  if (!content) return []
  try {
    const parsed = JSON.parse(content) as { messages?: unknown }
    return Array.isArray(parsed.messages) ? (parsed.messages as ChatMessage[]) : []
  } catch {
    return []
  }
}

export const loadRecentMessages = async (
  teamSlug: string,
  envSlug: string,
  agentSlug: string
): Promise<{ messages: ChatMessage[]; hasMore: boolean }> => {
  const all = await readMessages(teamSlug, envSlug, agentSlug)
  return { messages: all.slice(-PAGE_SIZE), hasMore: all.length > PAGE_SIZE }
}

export const loadOlderMessages = async (
  teamSlug: string,
  envSlug: string,
  agentSlug: string,
  offset: number
): Promise<{ messages: ChatMessage[]; hasMore: boolean }> => {
  const all = await readMessages(teamSlug, envSlug, agentSlug)
  const end = all.length - offset
  const start = Math.max(0, end - PAGE_SIZE)
  return { messages: all.slice(start, end), hasMore: start > 0 }
}

export const appendChatMessage = async (
  teamSlug: string,
  envSlug: string,
  agentSlug: string,
  message: ChatMessage
): Promise<void> => {
  await ensureDir(teamSlug, envSlug, agentSlug)
  const all = await readMessages(teamSlug, envSlug, agentSlug)
  all.push(message)
  await fs.writeFile(chatPath(teamSlug, envSlug, agentSlug), JSON.stringify({ messages: all }, null, 2), 'utf-8')
}
