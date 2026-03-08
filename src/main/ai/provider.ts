import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createMistral } from '@ai-sdk/mistral'
import type { LanguageModel } from 'ai'

const OPENAI_COMPATIBLE_BASES: Record<string, string> = {
  deepseek: 'https://api.deepseek.com/v1',
  groq: 'https://api.groq.com/openai/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  together: 'https://api.together.xyz/v1',
  xai: 'https://api.x.ai/v1',
}

const DEFAULT_MODELS: Record<string, string> = {
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-4o-mini',
  deepseek: 'deepseek-chat',
  groq: 'llama-3.1-8b-instant',
  openrouter: 'openai/gpt-4o-mini',
  together: 'meta-llama/Llama-3-8b-chat-hf',
  xai: 'grok-2-latest',
  ollama: 'llama3.2',
  mistral: 'mistral-small-latest',
  google: 'gemini-2.0-flash',
  'openai-compatible': 'default',
}

export function createModel(
  type: string,
  config: Record<string, unknown>,
  apiKey: string | null
): LanguageModel {
  const modelId = (config.model as string | undefined) || DEFAULT_MODELS[type] || 'default'
  const key = apiKey ?? ''

  if (type === 'anthropic' || type === 'claude') {
    return createAnthropic({ apiKey: key })(modelId)
  }
  if (type === 'google') {
    return createGoogleGenerativeAI({ apiKey: key })(modelId)
  }
  if (type === 'mistral') {
    return createMistral({ apiKey: key })(modelId)
  }
  if (type === 'ollama') {
    const baseURL = (config.baseUrl as string | undefined) || 'http://localhost:11434/v1'
    return createOpenAI({ baseURL, apiKey: 'ollama' })(modelId)
  }
  if (type === 'openai-compatible') {
    const baseURL = config.baseUrl as string
    return createOpenAI({ baseURL, apiKey: key || undefined })(modelId)
  }

  const baseURL = OPENAI_COMPATIBLE_BASES[type]
  return createOpenAI({ apiKey: key, ...(baseURL ? { baseURL } : {}) })(modelId)
}
