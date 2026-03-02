import { registerProvider, type ModelProvider } from './base'

const openrouter: ModelProvider = {
  id: 'openrouter',
  displayName: 'OpenRouter',
  configSchema: {
    type: 'object',
    required: ['apiKey', 'model'],
    properties: {
      apiKey: { type: 'string', title: 'API Key', description: 'Your OpenRouter API key (sk-or-...)', format: 'password' },
      model: { type: 'string', title: 'Model', description: 'Model identifier (e.g. openai/gpt-4o, anthropic/claude-sonnet-4-6)', default: 'openai/gpt-4o' },
    },
  },
  supportedModels: [
    { id: 'openai/gpt-4o', displayName: 'GPT-4o (via OpenRouter)' },
    { id: 'anthropic/claude-sonnet-4-6', displayName: 'Claude Sonnet 4.6 (via OpenRouter)' },
    { id: 'google/gemini-pro-1.5', displayName: 'Gemini Pro 1.5 (via OpenRouter)' },
    { id: 'meta-llama/llama-3.1-70b-instruct', displayName: 'Llama 3.1 70B (via OpenRouter)' },
  ],
  validate(config) {
    const c = config as { apiKey?: string; model?: string }
    if (!c.apiKey?.startsWith('sk-or-')) return { valid: false, errors: ['API key must start with sk-or-'] }
    return { valid: true }
  },
  toOpenClawJson(config) {
    const c = config as { apiKey: string; model: string }
    return { provider: 'openrouter', model: c.model, apiKey: c.apiKey, baseUrl: 'https://openrouter.ai/api/v1' }
  },
}

registerProvider(openrouter)
