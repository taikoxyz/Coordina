import { registerProvider, fetchWithTimeout, type ModelProvider } from './base'

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
  async testConnection(config) {
    try { await deepseek.listModels(config); return { valid: true } }
    catch (e) { return { valid: false, errors: [(e as Error).message] } }
  },
  async listModels(config) {
    const c = config as { apiKey?: string }
    const res = await fetchWithTimeout('https://api.deepseek.com/models', {
      headers: { Authorization: `Bearer ${c.apiKey ?? ''}` },
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: { message?: string } }
      throw new Error(body.error?.message ?? `HTTP ${res.status}`)
    }
    const body = await res.json() as { data?: { id: string }[] }
    return body.data?.map(m => m.id).sort() ?? []
  },
  toOpenClawJson(config) {
    const c = config as { apiKey: string; model: string }
    return { agents: { defaults: { model: { primary: `deepseek/${c.model}` } } }, models: { providers: { deepseek: { apiKey: c.apiKey } } } }
  },
}

registerProvider(deepseek)
