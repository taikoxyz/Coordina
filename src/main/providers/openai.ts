import { registerProvider, type ModelProvider } from './base'

const openai: ModelProvider = {
  id: 'openai',
  displayName: 'OpenAI',
  defaultModel: 'gpt-4o',
  configSchema: {
    type: 'object',
    required: ['apiKey', 'model'],
    properties: {
      apiKey: { type: 'string', title: 'API Key', description: 'Your OpenAI API key (sk-...)', format: 'password' },
      model: { type: 'string', title: 'Model', enum: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o1-mini', 'o3-mini'], default: 'gpt-4o' },
    },
  },
  supportedModels: [
    { id: 'gpt-4o', displayName: 'GPT-4o' },
    { id: 'gpt-4o-mini', displayName: 'GPT-4o Mini' },
    { id: 'o1', displayName: 'o1' },
    { id: 'o1-mini', displayName: 'o1 Mini' },
    { id: 'o3-mini', displayName: 'o3 Mini' },
  ],
  validate(config) {
    const c = config as { apiKey?: string; model?: string }
    if (!c.apiKey?.startsWith('sk-')) return { valid: false, errors: ['API key must start with sk-'] }
    return { valid: true }
  },
  toOpenClawJson(config) {
    const c = config as { apiKey: string; model: string }
    return { provider: 'openai', model: c.model, apiKey: c.apiKey }
  },
}

registerProvider(openai)
