import { registerProvider, fetchWithTimeout, type ModelProvider } from './base'

const anthropic: ModelProvider = {
  id: 'anthropic',
  displayName: 'Anthropic',
  defaultModel: 'claude-sonnet-4-6',
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
  async testConnection(config) {
    try { await anthropic.listModels(config); return { valid: true } }
    catch (e) { return { valid: false, errors: [(e as Error).message] } }
  },
  async listModels(config) {
    const c = config as { apiKey?: string }
    const res = await fetchWithTimeout('https://api.anthropic.com/v1/models', {
      headers: { 'x-api-key': c.apiKey ?? '', 'anthropic-version': '2023-06-01' },
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: { message?: string } }
      throw new Error(body.error?.message ?? `HTTP ${res.status}`)
    }
    const body = await res.json() as { data?: { id: string }[] }
    return body.data?.map(m => m.id).sort() ?? []
  },
  toOpenClawJson(config) {
    const c = config as { model: string }
    return { agents: { defaults: { model: { primary: `anthropic/${c.model}` } } }, models: { providers: { anthropic: {} } } }
  },
  toEnvVars(config) {
    const c = config as { apiKey: string }
    return { ANTHROPIC_API_KEY: c.apiKey }
  },
}

registerProvider(anthropic)
