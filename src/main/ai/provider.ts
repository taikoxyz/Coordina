import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModel } from 'ai'

const DEFAULT_MODEL = 'openai/gpt-4o-mini'

export function createModel(
  config: { model?: string },
  apiKey: string,
): LanguageModel {
  const modelId = config.model || DEFAULT_MODEL
  return createOpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
  })(modelId)
}
