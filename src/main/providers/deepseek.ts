import { registerProvider, type ModelProvider } from './base'

const deepseek: ModelProvider = {
  id: 'deepseek',
  displayName: 'DeepSeek',
  defaultModel: 'deepseek-chat',
  configSchema: {
    type: 'object',
    required: ['apiKey', 'model'],
    properties: {
      apiKey: { type: 'string', title: 'API Key', description: 'Your DeepSeek API key', format: 'password' },
      model: { type: 'string', title: 'Model', enum: ['deepseek-chat', 'deepseek-reasoner'], default: 'deepseek-chat' },
    },
  },
  supportedModels: [
    { id: 'deepseek-chat', displayName: 'DeepSeek Chat' },
    { id: 'deepseek-reasoner', displayName: 'DeepSeek Reasoner' },
  ],
  validate(config) {
    const c = config as { apiKey?: string; model?: string }
    if (!c.apiKey) return { valid: false, errors: ['API key is required'] }
    return { valid: true }
  },
  toOpenClawJson(config) {
    const c = config as { apiKey: string; model: string }
    return { provider: 'deepseek', model: c.model, apiKey: c.apiKey }
  },
}

registerProvider(deepseek)
