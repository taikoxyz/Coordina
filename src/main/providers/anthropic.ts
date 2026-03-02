import { registerProvider, type ModelProvider } from './base'

const anthropic: ModelProvider = {
  id: 'anthropic',
  displayName: 'Anthropic',
  configSchema: {
    type: 'object',
    required: ['apiKey', 'model'],
    properties: {
      apiKey: { type: 'string', title: 'API Key', description: 'Your Anthropic API key (sk-ant-...)', format: 'password' },
      model: { type: 'string', title: 'Model', enum: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'], default: 'claude-sonnet-4-6' },
    },
  },
  supportedModels: [
    { id: 'claude-opus-4-6', displayName: 'Claude Opus 4.6' },
    { id: 'claude-sonnet-4-6', displayName: 'Claude Sonnet 4.6' },
    { id: 'claude-haiku-4-5-20251001', displayName: 'Claude Haiku 4.5' },
  ],
  validate(config) {
    const c = config as { apiKey?: string; model?: string }
    if (!c.apiKey?.startsWith('sk-ant-')) return { valid: false, errors: ['API key must start with sk-ant-'] }
    return { valid: true }
  },
  toOpenClawJson(config) {
    const c = config as { apiKey: string; model: string }
    return { provider: 'anthropic', model: c.model, apiKey: c.apiKey }
  },
}

registerProvider(anthropic)
